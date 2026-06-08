#!/usr/bin/env node
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { URL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_FILE = path.join(ROOT, "data", "daily-news-config.json");
const DAILY_DIR = path.join(ROOT, "data", "daily");
const DEFAULT_BRANCH = "main";
const GIT_ADD_PATHS = [
  "buzz-mobile-para-enviar.html",
  "data",
  "package.json",
  "package-lock.json",
  "public/images",
  "scripts",
  "src/components/news",
  "src/lib/news-data.ts",
  "src/routes",
  "src/routeTree.gen.ts",
];

function parseArgs(argv) {
  const args = {
    push: false,
    skipFetch: false,
    images: false,
    ai: true,
    date: new Date().toISOString().slice(0, 10),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--push") {
      args.push = true;
    } else if (arg === "--skip-fetch") {
      args.skipFetch = true;
    } else if (arg === "--images") {
      args.images = true;
    } else if (arg === "--no-ai") {
      args.ai = false;
    } else if (arg === "--date" && next) {
      args.date = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function usage() {
  console.log(`
Uso:
  npm run daily
  npm run daily:push
  node scripts/daily-news-pipeline.cjs --date 2026-05-22 --push

O pipeline:
  1. busca candidatos no Google News RSS;
  2. usa OpenAI para montar as noticias do dia;
  3. salva relatorios em data/daily/;
  4. valida as noticias;
  5. roda build;
  6. gera buzz-mobile-para-enviar.html;
  7. com --push, commita e envia para o GitHub se houver mudancas.

Por padrao, o pipeline nao busca imagens automaticamente. Use --images apenas
quando houver uma fonte de imagem revisada/configurada; busca textual pode
escolher fotos de pessoas ou assuntos errados.
`);
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeXml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "user-agent": "BuzzPopDailyBot/1.0 (+https://github.com/criatixagencia-collab/buzzpop)",
        },
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          fetchText(new URL(response.headers.location, url).toString()).then(resolve, reject);
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode >= 400) {
            reject(new Error(`HTTP ${response.statusCode}: ${url}`));
            return;
          }
          resolve(body);
        });
      },
    );

    request.setTimeout(20000, () => request.destroy(new Error(`Timeout: ${url}`)));
    request.on("error", reject);
  });
}

function googleNewsUrl(term) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${term} when:1d`);
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "BR");
  url.searchParams.set("ceid", "BR:pt-BR");
  return url.toString();
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? escapeXml(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : "";
}

function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const item = match[1];
    const title = getTag(item, "title");
    const link = getTag(item, "link");
    const pubDate = getTag(item, "pubDate");
    const source = getTag(item, "source");
    let host = source || "";

    if (!host) {
      try {
        host = new URL(link).hostname.replace(/^www\./, "");
      } catch {
        host = "";
      }
    }

    return { title, link, pubDate, source: source || host, host: host.toLowerCase() };
  });
}

function scoreItem(item, config) {
  let score = 0;
  if (config.preferredHosts.some((host) => item.host.includes(host))) score += 4;
  if (/celebr|famos|influenci|reality|tv|cinema|m[uú]sica|cannes/i.test(item.title)) score += 2;
  if (/hoje|nesta|sexta|quinta|quarta|terça|segunda|domingo|sábado/i.test(item.title)) score += 1;
  return score;
}

function shouldBlock(item, config) {
  return config.blockedTitleTerms.some((term) => item.title.toLowerCase().includes(term.toLowerCase()));
}

function normalizeTopic(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(o|a|os|as|um|uma|uns|umas|de|da|do|das|dos|em|no|na|nos|nas|com|para|por|e|ou|que|sobre|apos|ap[oó]s)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 9)
    .join(" ");
}

function topicSimilarity(a, b) {
  const left = new Set(normalizeTopic(a).split(/\s+/).filter(Boolean));
  const right = new Set(normalizeTopic(b).split(/\s+/).filter(Boolean));
  if (!left.size || !right.size) return 0;

  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / Math.min(left.size, right.size);
}

function hasStrongSharedTerms(a, b) {
  const important = (value) =>
    normalizeTopic(value)
      .split(/\s+/)
      .filter((word) => word.length > 4 && !/famosos?|entretenimento|saiba|entenda|brasil/.test(word));
  const left = new Set(important(a));
  const right = new Set(important(b));
  const shared = [...left].filter((word) => right.has(word));
  return shared.length >= 2;
}

function isReliableHost(host) {
  return host && !/facebook|instagram|x\.com|twitter|youtube|tiktok|gov\.br/i.test(host);
}

function isIndependentCluster(cluster) {
  const clusterText = cluster.articles.map((article) => article.title).join(" ");
  if (/\buni[aã]o brasil\b|\bc[aâ]mara\b|\bpol[ií]tic|\bopera[cç][aã]o\b|\bfraude\b|\bjogos?\b|\btrump\b/i.test(clusterText)) {
    return false;
  }

  if (cluster.hosts.length >= 3) return true;
  if (cluster.hosts.length < 2) return false;

  const titles = cluster.articles.map((article) => article.title);
  const maxSimilarity = titles.flatMap((title, index) =>
    titles.slice(index + 1).map((other) => topicSimilarity(title, other)),
  );
  const almostSameTitle = maxSimilarity.some((similarity) => similarity >= 0.9);
  const localPair = cluster.hosts.every((host) =>
    /bahia|paran[aá]|curitiba|agreste|sert[aã]o|uai|minuto mt|portal uai/i.test(host),
  );

  return !almostSameTitle && !localPair;
}

function entityKey(title) {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\bgugu\b|joao augusto liberato/.test(normalized)) return "gugu liberato";
  const entities = [
    "boninho",
    "casa do patrao",
    "virginia fonseca",
    "deolane bezerra",
    "ticiane pinheiro",
    "barbara bandeira",
    "cannes",
  ];

  return entities.find((entity) => normalized.includes(entity)) || normalizeTopic(title).split(/\s+/).slice(0, 3).join(" ");
}

async function collectCandidates(config) {
  const reports = [];
  const seen = new Set();

  for (const term of config.seedTerms) {
    const report = {
      term,
      rss: googleNewsUrl(term),
      articles: [],
      error: null,
    };

    try {
      const xml = await fetchText(report.rss);
      const items = parseItems(xml)
        .filter((item) => item.title && item.link && !shouldBlock(item, config))
        .filter((item) => {
          const key = `${item.title.toLowerCase()}|${item.host}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((item) => ({
          ...item,
          score: scoreItem(item, config),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, config.maxArticlesPerTerm);

      report.articles = items;
    } catch (error) {
      report.error = error.message;
    }

    reports.push(report);
  }

  return reports;
}

function buildSummary(reports) {
  const all = reports.flatMap((report) =>
    report.articles.map((article) => ({
      term: report.term,
      ...article,
    })),
  );

  const clusters = [];
  for (const article of all.sort((a, b) => b.score - a.score)) {
    const cluster = clusters.find(
      (entry) => topicSimilarity(entry.title, article.title) >= 0.62 || hasStrongSharedTerms(entry.title, article.title),
    );
    const reliableHost = isReliableHost(article.host) ? article.host : null;
    if (cluster) {
      cluster.articles.push(article);
      cluster.hosts = [...new Set([...cluster.hosts, reliableHost].filter(Boolean))];
      cluster.score = Math.max(cluster.score, article.score) + cluster.hosts.length;
    } else {
      clusters.push({
        id: normalizeTopic(article.title),
        title: article.title,
        score: article.score,
        hosts: reliableHost ? [reliableHost] : [],
        articles: [article],
      });
    }
  }

  const multiSourceArticles = clusters
    .filter((cluster) => cluster.hosts.length >= 2)
    .filter(isIndependentCluster)
    .map((cluster) => {
      const representative =
        cluster.articles.find((article) => isReliableHost(article.host) && article.score >= Math.max(...cluster.articles.map((entry) => entry.score))) ||
        cluster.articles.find((article) => isReliableHost(article.host)) ||
        cluster.articles[0];

      return {
        ...representative,
        clusterId: cluster.id,
        clusterHosts: cluster.hosts.length,
        clusterSources: cluster.hosts,
        clusterTitles: cluster.articles.map((entry) => entry.title).slice(0, 6),
        score: representative.score + cluster.hosts.length * 5,
      };
    });

  const seenEntities = new Set();
  const uniqueMultiSourceArticles = [];
  for (const article of multiSourceArticles.sort((a, b) => b.score - a.score)) {
    const key = entityKey(article.title);
    if (seenEntities.has(key)) continue;
    seenEntities.add(key);
    uniqueMultiSourceArticles.push(article);
  }

  const ranked = uniqueMultiSourceArticles.slice(0, 40);

  return {
    totalTerms: reports.length,
    totalArticles: all.length,
    totalMultiSourceArticles: multiSourceArticles.length,
    topCandidates: ranked,
    errors: reports.filter((report) => report.error).map((report) => ({
      term: report.term,
      error: report.error,
    })),
  };
}

function assertFetchWorked(summary) {
  if (summary.totalArticles > 0) return;

  const errors = summary.errors.map((entry) => `${entry.term}: ${entry.error}`).join(" | ");
  throw new Error(`Nenhum candidato encontrado na coleta RSS. Erros: ${errors || "sem detalhes"}`);
}

function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (options.allowExitCodes?.includes(result.status)) {
    return result.status;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(output || `Comando falhou: ${command} ${args.join(" ")}`);
  }

  return result.stdout || "";
}

function hasGitChanges() {
  return run("git", ["status", "--porcelain"], { capture: true }).trim().length > 0;
}

function hasStagedGitChanges() {
  return run("git", ["diff", "--cached", "--quiet", "--", ...GIT_ADD_PATHS], { allowExitCodes: [0, 1] }) === 1;
}

function gitPush(date) {
  if (!hasGitChanges()) {
    console.log("\nSem mudancas para enviar ao GitHub.");
    return;
  }

  const branch = run("git", ["branch", "--show-current"], { capture: true }).trim() || DEFAULT_BRANCH;
  run("git", ["add", ...GIT_ADD_PATHS]);
  if (!hasStagedGitChanges()) {
    console.log("\nSem mudancas controladas para enviar ao GitHub.");
    return;
  }
  run("git", ["commit", "-m", `chore: daily buzz update ${date}`, "--", ...GIT_ADD_PATHS]);
  run("git", ["push", "origin", branch]);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  ensureDir(DAILY_DIR);
  const config = readConfig();
  const reportPath = path.join(DAILY_DIR, `${args.date}.json`);
  const summaryPath = path.join(DAILY_DIR, `${args.date}.summary.json`);

  if (!args.skipFetch) {
    console.log(`Coletando candidatos de noticia para ${args.date}...`);
    const reports = await collectCandidates(config);
    const summary = buildSummary(reports);
    fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2));
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Relatorio: ${path.relative(ROOT, reportPath)}`);
    console.log(`Resumo: ${path.relative(ROOT, summaryPath)}`);
    console.log(`Candidatos encontrados: ${summary.totalArticles}`);
    console.log(`Candidatos em 2+ sites: ${summary.totalMultiSourceArticles}`);
    assertFetchWorked(summary);
  }

  if (args.ai) {
    run("node", ["scripts/generate-news-with-openai.cjs", "--date", args.date, "--limit", "6"]);
    if (args.images) {
      run("node", ["scripts/apply-instagram-images.cjs", "--date", args.date, "--write-candidates"]);
      run("node", ["scripts/apply-instagram-images.cjs", "--date", args.date]);
    } else {
      console.log("\nBusca automatica de imagens pulada. Use --images somente apos revisar/configurar a fonte de imagens.");
    }
  }

  run("npm", ["run", "validate:news"]);
  run("npm", ["run", "build"]);
  run("node", ["scripts/export-mobile-html.cjs"]);

  if (args.push) {
    gitPush(args.date);
  } else {
    console.log("\nPipeline concluido sem push. Use npm run daily:push para enviar ao GitHub.");
  }
}

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`);
  process.exit(1);
});
