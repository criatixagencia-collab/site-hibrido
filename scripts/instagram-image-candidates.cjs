const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const DEFAULT_ACTOR = "apify/instagram-scraper";

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return;

  const lines = fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {
    actor: process.env.APIFY_INSTAGRAM_ACTOR || DEFAULT_ACTOR,
    limit: 6,
    since: "14 days",
    waitSeconds: 180,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--profile" && next) {
      args.profile = next.replace(/^@/, "");
      index += 1;
    } else if (arg === "--url" && next) {
      args.url = next;
      index += 1;
    } else if (arg === "--limit" && next) {
      args.limit = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--since" && next) {
      args.since = next;
      index += 1;
    } else if (arg === "--actor" && next) {
      args.actor = next;
      index += 1;
    } else if (arg === "--wait" && next) {
      args.waitSeconds = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function usage() {
  console.log(`
Busca imagens candidatas no Instagram via Apify.

Uso:
  npm run instagram:images -- --profile virginia --limit 6
  npm run instagram:images -- --url https://www.instagram.com/virginia/ --since "7 days"
  npm run instagram:images -- --profile virginia --json

Variaveis:
  APIFY_TOKEN             obrigatoria no .env
  APIFY_INSTAGRAM_ACTOR   opcional, padrao: ${DEFAULT_ACTOR}
`);
}

function actorPath(actor) {
  return encodeURIComponent(actor.replace("/", "~"));
}

function profileUrl(profile) {
  return `https://www.instagram.com/${profile.replace(/^@/, "")}/`;
}

async function apifyJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || response.statusText;
    throw new Error(`Apify API ${response.status}: ${message}`);
  }

  return data;
}

function collectImages(item) {
  const images = [];

  if (item.displayUrl) images.push(item.displayUrl);
  if (Array.isArray(item.images)) images.push(...item.images.filter(Boolean));
  if (Array.isArray(item.childPosts)) {
    for (const child of item.childPosts) {
      if (child.displayUrl) images.push(child.displayUrl);
      if (Array.isArray(child.images)) images.push(...child.images.filter(Boolean));
    }
  }

  return [...new Set(images)];
}

function normalizeCandidates(items) {
  return items.flatMap((item) => {
    const username = item.ownerUsername || item.username || item.input || "";
    const credit = username
      ? `Foto: Reprodução/Instagram/@${username}`
      : "Foto: Reprodução/Instagram";

    return collectImages(item).map((imageUrl) => ({
      imageUrl,
      postUrl: item.url || item.inputUrl || null,
      caption: item.caption || "",
      credit,
      timestamp: item.timestamp || null,
      dimensions:
        item.dimensionsWidth && item.dimensionsHeight
          ? `${item.dimensionsWidth}x${item.dimensionsHeight}`
          : null,
      likesCount: item.likesCount ?? null,
      ownerUsername: username || null,
    }));
  });
}

function printCandidates(candidates) {
  if (!candidates.length) {
    console.log("Nenhuma imagem encontrada para esse perfil/URL.");
    return;
  }

  for (const [index, candidate] of candidates.entries()) {
    console.log(`\n#${index + 1}`);
    console.log(`Imagem: ${candidate.imageUrl}`);
    if (candidate.postUrl) console.log(`Post: ${candidate.postUrl}`);
    console.log(`Credito: ${candidate.credit}`);
    if (candidate.timestamp) console.log(`Data: ${candidate.timestamp}`);
    if (candidate.dimensions) console.log(`Dimensoes: ${candidate.dimensions}`);
    if (candidate.caption) {
      console.log(`Legenda: ${candidate.caption.slice(0, 240).replace(/\s+/g, " ")}`);
    }
  }
}

async function main() {
  loadEnv();

  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const token = process.env.APIFY_TOKEN;
  if (!token || token.includes("cole_sua_chave")) {
    throw new Error("APIFY_TOKEN nao encontrado. Preencha o arquivo .env primeiro.");
  }

  const url = args.url || (args.profile ? profileUrl(args.profile) : null);
  if (!url) {
    usage();
    throw new Error("Informe --profile usuario ou --url https://www.instagram.com/usuario/.");
  }

  const input = {
    addParentData: true,
    directUrls: [url],
    onlyPostsNewerThan: args.since,
    resultsLimit: args.limit,
    resultsType: "posts",
  };

  const runUrl = new URL(`https://api.apify.com/v2/acts/${actorPath(args.actor)}/runs`);
  runUrl.searchParams.set("token", token);
  runUrl.searchParams.set("waitForFinish", String(args.waitSeconds));

  const run = await apifyJson(runUrl, {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  const data = run.data;
  if (!data?.defaultDatasetId) {
    throw new Error(`Run sem dataset. Status: ${data?.status || "desconhecido"}`);
  }

  if (!["SUCCEEDED", "TIMED-OUT"].includes(data.status)) {
    throw new Error(`Actor terminou com status ${data.status}. Veja run: ${data.id}`);
  }

  const datasetUrl = new URL(`https://api.apify.com/v2/datasets/${data.defaultDatasetId}/items`);
  datasetUrl.searchParams.set("token", token);
  datasetUrl.searchParams.set("clean", "true");
  datasetUrl.searchParams.set("format", "json");

  const items = await apifyJson(datasetUrl);
  const candidates = normalizeCandidates(items).slice(0, args.limit);

  if (args.json) {
    console.log(JSON.stringify(candidates, null, 2));
  } else {
    printCandidates(candidates);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
