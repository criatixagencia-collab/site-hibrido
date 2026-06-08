#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const NEWS_FILE = path.join(ROOT, "src", "lib", "news-data.ts");
const OUT_DIR = path.join(ROOT, "public", "images", "search");
const MIN_BYTES = 12000;
const MIN_WIDTH = 500;
const MIN_HEIGHT = 500;
const REQUIRE_INSTAGRAM_IMAGE = true;

function parseArgs(argv) {
  const args = {
    date: new Date().toISOString().slice(0, 10),
    limit: Infinity,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--date" && next) {
      args.date = next;
      index += 1;
    } else if (arg === "--limit" && next) {
      args.limit = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--allow-unsafe-search") {
      args.allowUnsafeSearch = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function usage() {
  console.log(`
Uso:
  npm run images:search
  node scripts/collect-google-images.cjs --date 2026-05-22

Padrao: busca gratis via DuckDuckGo Images.
Opcional: usa BRAVE_SEARCH_API_KEY ou Google Custom Search se estiverem no .env.

ATENCAO: este script nao faz parte do fluxo editorial aprovado. Use
npm run images:instagram / npm run images:search para o fluxo via Instagram
oficial e Apify. Para rodar mesmo assim, informe --allow-unsafe-search.
`);
}

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return;

  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function readNewsItems() {
  const source = fs.readFileSync(NEWS_FILE, "utf8").replace(/import\.meta\.env\.DEV/g, "false");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const sandbox = {
    exports: {},
    require,
    console,
  };

  vm.runInNewContext(compiled, sandbox, { filename: NEWS_FILE });
  return sandbox.exports.getNewsPage(0);
}

function unique(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function queriesForItem(item) {
  const terms = unique(item.imageSearchTerms?.length ? item.imageSearchTerms : [item.title]);
  const queries = [];

  for (const term of terms) {
    queries.push(`instagram ${term}`);
    queries.push(`${term} instagram`);
  }

  queries.push(`site:instagram.com ${item.title}`);
  return unique(queries).slice(0, 7);
}

async function googleImageSearch({ apiKey, cx, query }) {
  const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("imgType", "photo");
  url.searchParams.set("safe", "active");
  url.searchParams.set("num", "10");
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "br");

  const response = await fetch(url, {
    headers: {
      "user-agent": "BuzzPopImageCollector/1.0",
    },
  });
  const body = await response.text();
  let data;

  try {
    data = JSON.parse(body);
  } catch {
    data = { raw: body };
  }

  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new Error(`Google Custom Search ${response.status}: ${message}`);
  }

  return data.items || [];
}

async function braveImageSearch({ apiKey, query }) {
  const url = new URL("https://api.search.brave.com/res/v1/images/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "20");
  url.searchParams.set("country", "BR");
  url.searchParams.set("search_lang", "pt-br");
  url.searchParams.set("safesearch", "strict");
  url.searchParams.set("spellcheck", "1");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "x-subscription-token": apiKey,
    },
  });
  const body = await response.text();
  let data;

  try {
    data = JSON.parse(body);
  } catch {
    data = { raw: body };
  }

  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new Error(`Brave Image Search ${response.status}: ${message}`);
  }

  return data.results || [];
}

async function duckDuckGoToken(query) {
  const url = new URL("https://duckduckgo.com/");
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const html = await response.text();
  const match = html.match(/vqd=([\d-]+)&/) || html.match(/"vqd":"([^"]+)"/);

  if (!response.ok || !match) {
    throw new Error(`DuckDuckGo token indisponivel para: ${query}`);
  }

  return match[1];
}

async function duckDuckGoImageSearch({ query }) {
  const token = await duckDuckGoToken(query);
  const url = new URL("https://duckduckgo.com/i.js");
  url.searchParams.set("l", "br-pt");
  url.searchParams.set("o", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("vqd", token);
  url.searchParams.set("f", ",,,,,");
  url.searchParams.set("p", "1");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      referer: "https://duckduckgo.com/",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const body = await response.text();
  let data;

  try {
    data = JSON.parse(body);
  } catch {
    data = { raw: body };
  }

  if (!response.ok) {
    throw new Error(`DuckDuckGo Images ${response.status}: ${response.statusText}`);
  }

  return data.results || [];
}

function normalizeBraveResult(result) {
  const imageUrl = result.properties?.url || result.thumbnail?.src;
  const source = result.source || result.meta_url?.hostname || "";

  return {
    imageUrl,
    pageUrl: result.url || "",
    source,
    title: result.title || "",
    width: Number(result.properties?.width || result.thumbnail?.width || 0),
    height: Number(result.properties?.height || result.thumbnail?.height || 0),
    mime: "",
    raw: result,
  };
}

function normalizeGoogleResult(result) {
  return {
    imageUrl: result.link || "",
    pageUrl: result.image?.contextLink || "",
    source: result.displayLink || "",
    title: result.title || "",
    width: Number(result.image?.width || 0),
    height: Number(result.image?.height || 0),
    mime: result.mime || "",
    raw: result,
  };
}

function normalizeDuckDuckGoResult(result) {
  return {
    imageUrl: result.image || result.thumbnail || "",
    fallbackImageUrl: result.thumbnail || "",
    pageUrl: result.url || "",
    source: result.source || "",
    title: result.title || "",
    width: Number(result.width || 0),
    height: Number(result.height || 0),
    mime: "",
    raw: result,
  };
}

function scoreResult(item, query) {
  const width = Number(item.width || 0);
  const height = Number(item.height || 0);
  const area = width * height;
  const joined = `${item.imageUrl || ""} ${item.pageUrl || ""} ${item.source || ""} ${item.title || ""}`;
  let score = Math.min(area / 100000, 80);

  if (/instagram\.com|cdninstagram\.com/i.test(joined)) score += 70;
  if (/\.jpe?g(\?|$)/i.test(item.imageUrl || "")) score += 12;
  if (/\.png(\?|$)/i.test(item.imageUrl || "")) score += 6;
  if (/webp/i.test(item.mime || item.imageUrl || "")) score -= 12;
  if (width >= 900 && height >= 900) score += 20;
  if (width < MIN_WIDTH || height < MIN_HEIGHT) score -= 50;

  for (const word of query.toLowerCase().split(/\s+/).filter((part) => part.length > 3)) {
    if (joined.toLowerCase().includes(word)) score += 1;
  }

  return score;
}

function isInstagramResult(result) {
  return /instagram\.com|cdninstagram\.com/i.test(
    `${result.imageUrl || ""} ${result.pageUrl || ""} ${result.source || ""}`,
  );
}

async function searchImages({ provider, braveApiKey, googleApiKey, googleCx, query }) {
  if (provider === "brave") {
    return (await braveImageSearch({ apiKey: braveApiKey, query })).map(normalizeBraveResult);
  }

  if (provider === "google") {
    return (await googleImageSearch({ apiKey: googleApiKey, cx: googleCx, query })).map(normalizeGoogleResult);
  }

  return (await duckDuckGoImageSearch({ query })).map(normalizeDuckDuckGoResult);
}

async function findImageForItem({ provider, braveApiKey, googleApiKey, googleCx, item }) {
  const results = [];

  for (const query of queriesForItem(item)) {
    console.log(`Buscando imagem: ${query}`);
    let items = [];
    try {
      items = await searchImages({ provider, braveApiKey, googleApiKey, googleCx, query });
    } catch (error) {
      console.log(`Busca ignorada: ${error.message}`);
      continue;
    }
    for (const result of items) {
      results.push({
        ...result,
        buzzQuery: query,
        buzzScore: scoreResult(result, query),
      });
    }
  }

  return results
    .filter((result) => result.imageUrl && /^https?:\/\//i.test(result.imageUrl))
    .filter((result) => !REQUIRE_INSTAGRAM_IMAGE || isInstagramResult(result))
    .sort((a, b) => b.buzzScore - a.buzzScore)
    .slice(0, 12);
}

function extensionFromContentType(contentType) {
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  return "jpg";
}

async function downloadImage(url, fileBase) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get("content-type") || "";
    if (!/^image\//i.test(contentType)) throw new Error(`content-type invalido: ${contentType}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < MIN_BYTES) throw new Error(`imagem pequena demais: ${buffer.length} bytes`);

    const ext = extensionFromContentType(contentType);
    const filePath = `${fileBase}.${ext}`;
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } finally {
    clearTimeout(timeout);
  }
}

function toPublicPath(filePath) {
  return `/${path.relative(path.join(ROOT, "public"), filePath).replaceAll(path.sep, "/")}`;
}

function creditForResult(result) {
  const host = result.source || "";
  if (/instagram\.com|cdninstagram\.com/i.test(`${host} ${result.imageUrl} ${result.pageUrl || ""}`)) {
    return "Foto: Reprodução/Instagram";
  }
  return `Imagem: Reprodução/${host.replace(/^www\./, "") || "Google Imagens"}`;
}

function replaceField(block, field, value) {
  const literal = JSON.stringify(value);
  const pattern = new RegExp(`(    ${field}: )"[^"]*"`);
  if (pattern.test(block)) return block.replace(pattern, `$1${literal}`);
  return block;
}

function updateNewsFile(updates) {
  let source = fs.readFileSync(NEWS_FILE, "utf8");

  for (const update of updates) {
    const slugLiteral = JSON.stringify(update.slug);
    const start = source.indexOf(`    slug: ${slugLiteral},`);
    if (start === -1) continue;

    const blockStart = source.lastIndexOf("  {", start);
    const blockEnd = source.indexOf("\n  }", start);
    if (blockStart === -1 || blockEnd === -1) continue;

    let block = source.slice(blockStart, blockEnd);
    block = replaceField(block, "image", update.image);
    block = replaceField(block, "imageCredit", update.imageCredit);

    source = `${source.slice(0, blockStart)}${block}${source.slice(blockEnd)}`;
  }

  fs.writeFileSync(NEWS_FILE, source);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  if (!args.allowUnsafeSearch) {
    throw new Error(
      "Busca aberta de imagens desativada. Use npm run images:instagram / npm run images:search com plano curado e Apify.",
    );
  }

  loadEnv();
  const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
  const googleApiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const googleCx = process.env.GOOGLE_CUSTOM_SEARCH_CX;
  const provider = braveApiKey ? "brave" : googleApiKey && googleCx ? "google" : "duckduckgo";

  console.log(
    `Busca de imagens usando: ${
      provider === "brave" ? "Brave Image Search" : provider === "google" ? "Google Custom Search" : "DuckDuckGo Images gratis"
    }`,
  );
  if (REQUIRE_INSTAGRAM_IMAGE) {
    console.log("Filtro ativo: somente imagens com origem Instagram/CDN Instagram.");
  }
  fs.mkdirSync(path.join(OUT_DIR, args.date), { recursive: true });
  const updates = [];
  const items = readNewsItems().slice(0, args.limit);

  for (const item of items) {
    const candidates = await findImageForItem({ provider, braveApiKey, googleApiKey, googleCx, item });
    let saved = null;
    let chosen = null;

    for (const candidate of candidates) {
      const base = path.join(OUT_DIR, args.date, item.slug);
      try {
        saved = await downloadImage(candidate.imageUrl, base);
        chosen = candidate;
        break;
      } catch (error) {
        console.log(`Imagem recusada para ${item.slug}: ${error.message}`);
        if (candidate.fallbackImageUrl && candidate.fallbackImageUrl !== candidate.imageUrl) {
          try {
            saved = await downloadImage(candidate.fallbackImageUrl, base);
            chosen = candidate;
            break;
          } catch (fallbackError) {
            console.log(`Thumbnail recusada para ${item.slug}: ${fallbackError.message}`);
          }
        }
      }
    }

    if (!saved || !chosen) {
      console.log(`Sem imagem valida para ${item.slug}; mantendo imagem atual.`);
      continue;
    }

    const image = toPublicPath(saved);
    const imageCredit = creditForResult(chosen);
    updates.push({ slug: item.slug, image, imageCredit });
    console.log(`Imagem salva para ${item.slug}: ${image}`);
  }

  if (updates.length) updateNewsFile(updates);
  console.log(`Imagens atualizadas: ${updates.length}/${items.length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
