#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const NEWS_FILE = path.join(ROOT, "src", "lib", "news-data.ts");
const PROFILE_MAP_FILE = path.join(ROOT, "data", "instagram-profiles.json");
const OUT_DIR = path.join(ROOT, "public", "images", "instagram");
const MIN_BYTES = 12000;
const DEFAULT_CANDIDATE_LIMIT = 3;
const DEFAULT_VISION_MODEL = "gpt-4o-mini";

function parseArgs(argv) {
  const args = {
    date: new Date().toISOString().slice(0, 10),
    plan: null,
    writeCandidates: false,
    autoSelect: true,
    candidateLimit: DEFAULT_CANDIDATE_LIMIT,
    visionModel: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || DEFAULT_VISION_MODEL,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--date" && next) {
      args.date = next;
      index += 1;
    } else if (arg === "--plan" && next) {
      args.plan = next;
      index += 1;
    } else if (arg === "--write-candidates") {
      args.writeCandidates = true;
    } else if (arg === "--no-auto-select") {
      args.autoSelect = false;
    } else if (arg === "--candidate-limit" && next) {
      args.candidateLimit = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--vision-model" && next) {
      args.visionModel = next;
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
  npm run images:instagram -- --date 2026-05-23 --write-candidates
  npm run images:instagram -- --date 2026-05-23
  npm run images:instagram -- --plan data/daily/2026-05-23.images.json

Fluxo antigo/restaurado:
  1. crie um plano em data/daily/YYYY-MM-DD.images.json;
  2. informe o perfil oficial/verificado do Instagram por slug;
  3. rode com --write-candidates para coletar 3 opcoes via Apify;
  4. por padrao, a OpenAI escolhe a melhor foto de rosto/assunto;
  5. rode sem --write-candidates para baixar e aplicar a foto escolhida.

O script nao usa Google, DuckDuckGo, Brave nem imagens dos sites de noticia.
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

function defaultPlanPath(date) {
  return path.join(ROOT, "data", "daily", `${date}.images.json`);
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

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readProfileMap() {
  if (!fs.existsSync(PROFILE_MAP_FILE)) return {};
  return JSON.parse(fs.readFileSync(PROFILE_MAP_FILE, "utf8"));
}

function profileForItem(item, profileMap) {
  const names = [
    item.title,
    ...(item.imageSearchTerms || []),
  ];

  for (const name of names) {
    const normalizedName = normalizeKey(name);
    const direct = profileMap[name] || profileMap[normalizedName];
    if (direct) return direct;

    const matchedKey = Object.keys(profileMap)
      .map((key) => normalizeKey(key))
      .filter((key) => key && normalizedName.includes(key))
      .sort((a, b) => b.length - a.length)[0];
    if (matchedKey) return profileMap[matchedKey];
  }

  return null;
}

function profileValueToEntry(profile) {
  if (!profile) return {};
  if (typeof profile === "string") {
    if (/^https?:\/\//i.test(profile)) return { officialUrl: profile };
    return { officialProfile: profile.replace(/^@/, "") };
  }

  return {
    officialProfile: profile.profile ? String(profile.profile).replace(/^@/, "") : "",
    officialUrl: profile.url || "",
  };
}

function planEntryForItem(item, existing, profileMap) {
  const profile = profileValueToEntry(profileForItem(item, profileMap));
  const keepExistingProfile = existing && (existing.candidateIndex !== null || existing.candidates?.length);

  return {
    slug: item.slug,
    title: item.title,
    subjectName: item.imageSearchTerms?.[0] || item.title,
    officialProfile: keepExistingProfile ? existing.officialProfile || "" : profile.officialProfile || existing?.officialProfile || "",
    officialUrl: keepExistingProfile ? existing.officialUrl || "" : profile.officialUrl || existing?.officialUrl || "",
    candidateIndex: existing?.candidateIndex ?? null,
    selectionReason: existing?.selectionReason || "",
    candidates: existing?.candidates || [],
  };
}

function createPlan(filePath) {
  const items = readNewsItems();
  const profileMap = readProfileMap();
  const plan = {
    instructions:
      "O plano usa somente perfil oficial/verificado. Rode com --write-candidates para coletar 3 fotos e escolher automaticamente a melhor foto de rosto; revise candidateIndex se quiser.",
    items: items.map((item) => planEntryForItem(item, null, profileMap)),
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(plan, null, 2));
  console.log(`Plano criado: ${path.relative(ROOT, filePath)}`);
  console.log("Preencha officialProfile ou officialUrl antes de coletar imagens.");
}

function readPlan(filePath) {
  if (!fs.existsSync(filePath)) {
    createPlan(filePath);
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(filePath, "utf8"));
  plan.instructions =
    "O plano usa somente perfil oficial/verificado. Rode com --write-candidates para coletar 3 fotos e escolher automaticamente a melhor foto de rosto; revise candidateIndex se quiser.";
  const profileMap = readProfileMap();
  const existingBySlug = new Map((plan.items || []).map((entry) => [entry.slug, entry]));
  plan.items = readNewsItems().map((item) => planEntryForItem(item, existingBySlug.get(item.slug), profileMap));
  return plan;
}

function runInstagramCandidates(entry, candidateLimit) {
  const args = ["scripts/instagram-image-candidates.cjs", "--json", "--limit", String(candidateLimit)];

  if (entry.officialUrl) {
    args.push("--url", entry.officialUrl);
  } else if (entry.officialProfile) {
    args.push("--profile", entry.officialProfile);
  } else {
    return [];
  }

  const result = spawnSync("node", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    throw new Error(`${entry.slug}: ${result.stderr || result.stdout}`.trim());
  }

  const candidates = JSON.parse(result.stdout);
  if (!entry.officialProfile) return candidates;

  const expectedOwner = normalizeKey(entry.officialProfile.replace(/^@/, ""));
  return candidates.filter((candidate) => normalizeKey(candidate.ownerUsername) === expectedOwner);
}

function selectionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["candidateIndex", "reason"],
    properties: {
      candidateIndex: { type: "integer", minimum: 0, maximum: 2 },
      reason: { type: "string" },
    },
  };
}

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

async function chooseCandidateWithOpenAI({ entry, apiKey, model }) {
  if (!apiKey || !entry.candidates?.length) return null;

  const content = [
    {
      type: "input_text",
      text: JSON.stringify(
        {
          task:
            "Escolha a melhor imagem para uma noticia de entretenimento. Priorize: rosto claro da pessoa central, pessoa correta, foto recente/limpa, boa qualidade, enquadramento vertical ou quadrado. Evite: grupos onde a pessoa central nao aparece bem, baixa qualidade, texto pesado, crianca como foco quando a noticia e sobre adulto, objeto sem rosto, meme, print de tela.",
          title: entry.title,
          subjectName: entry.subjectName,
          candidates: entry.candidates.map((candidate, index) => ({
            index,
            postUrl: candidate.postUrl,
            credit: candidate.credit,
            caption: candidate.caption,
            timestamp: candidate.timestamp,
            dimensions: candidate.dimensions,
          })),
        },
        null,
        2,
      ),
    },
  ];

  for (const candidate of entry.candidates) {
    content.push({ type: "input_image", image_url: candidate.imageUrl });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "instagram_image_choice",
          schema: selectionSchema(),
          strict: true,
        },
      },
      max_output_tokens: 800,
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new Error(`${entry.slug}: OpenAI vision ${response.status}: ${message}`);
  }

  const selected = JSON.parse(extractText(data));
  if (selected.candidateIndex < 0 || selected.candidateIndex >= entry.candidates.length) return null;
  return selected;
}

function extensionFromContentType(contentType) {
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  return "jpg";
}

async function downloadImage(candidate, fileBase) {
  const response = await fetch(candidate.imageUrl, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentType = response.headers.get("content-type") || "";
  if (!/^image\//i.test(contentType)) throw new Error(`content-type invalido: ${contentType}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < MIN_BYTES) throw new Error(`imagem pequena demais: ${buffer.length} bytes`);

  const filePath = `${fileBase}.${extensionFromContentType(contentType)}`;
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function toPublicPath(filePath) {
  return `/${path.relative(path.join(ROOT, "public"), filePath).replaceAll(path.sep, "/")}`;
}

function replaceField(block, field, value) {
  const literal = JSON.stringify(value);
  const pattern = new RegExp(`(    ${field}: )"[^"]*"`);
  if (pattern.test(block)) return block.replace(pattern, `$1${literal}`);
  return block;
}

function upsertField(block, field, value, afterField) {
  const literal = JSON.stringify(value);
  const existingPattern = new RegExp(`(    ${field}: )"[^"]*"`);
  if (existingPattern.test(block)) return block.replace(existingPattern, `$1${literal}`);

  const afterPattern = new RegExp(`(    ${afterField}: "[^"]*",\\n)`);
  if (afterPattern.test(block)) return block.replace(afterPattern, `$1    ${field}: ${literal},\n`);
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
    if (update.imagePostUrl) block = upsertField(block, "imagePostUrl", update.imagePostUrl, "imageCredit");

    source = `${source.slice(0, blockStart)}${block}${source.slice(blockEnd)}`;
  }

  fs.writeFileSync(NEWS_FILE, source);
}

async function writeCandidates({ plan, filePath, candidateLimit, autoSelect, visionModel }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const apifyToken = process.env.APIFY_TOKEN;
  const entriesWithProfiles = (plan.items || []).filter((entry) => entry.officialProfile || entry.officialUrl);

  if (entriesWithProfiles.length && (!apifyToken || apifyToken.includes("cole_sua_chave"))) {
    throw new Error(
      "APIFY_TOKEN ausente no .env. Adicione APIFY_TOKEN=... para buscar fotos reais no Instagram oficial.",
    );
  }

  for (const entry of plan.items || []) {
    if (!entry.officialProfile && !entry.officialUrl) {
      console.log(`Pulando ${entry.slug}: sem perfil oficial.`);
      continue;
    }

    console.log(`Coletando Instagram: ${entry.slug}`);
    entry.candidates = await runInstagramCandidates(entry, candidateLimit);
    entry.candidateIndex = null;
    entry.selectionReason = "";

    if (autoSelect && entry.candidates.length) {
      try {
        const selected = await chooseCandidateWithOpenAI({ entry, apiKey, model: visionModel });
        if (selected) {
          entry.candidateIndex = selected.candidateIndex;
          entry.selectionReason = selected.reason;
          console.log(`Escolhida #${selected.candidateIndex} para ${entry.slug}: ${selected.reason}`);
        }
      } catch (error) {
        console.log(`Selecao visual ignorada para ${entry.slug}: ${error.message}`);
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(plan, null, 2));
  console.log(`Candidatos atualizados: ${path.relative(ROOT, filePath)}`);
}

async function applySelected(plan) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const updates = [];

  for (const entry of plan.items || []) {
    if (entry.candidateIndex === null || entry.candidateIndex === undefined) {
      console.log(`Pulando ${entry.slug}: candidateIndex nao escolhido.`);
      continue;
    }

    const candidate = entry.candidates?.[entry.candidateIndex];
    if (!candidate?.imageUrl) {
      throw new Error(`${entry.slug}: candidateIndex sem imagem valida.`);
    }

    const base = path.join(OUT_DIR, entry.slug);
    const saved = await downloadImage(candidate, base);
    const image = toPublicPath(saved);
    const imageCredit = candidate.credit || "Foto: Reprodução/Instagram";
    updates.push({ slug: entry.slug, image, imageCredit, imagePostUrl: candidate.postUrl || "" });
    console.log(`Imagem aplicada para ${entry.slug}: ${image}`);
  }

  if (updates.length) updateNewsFile(updates);
  console.log(`Imagens aplicadas: ${updates.length}`);
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const planPath = path.resolve(ROOT, args.plan || defaultPlanPath(args.date));
  const plan = readPlan(planPath);
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

  if (args.writeCandidates) {
    await writeCandidates({
      plan,
      filePath: planPath,
      candidateLimit: args.candidateLimit,
      autoSelect: args.autoSelect,
      visionModel: args.visionModel,
    });
    return;
  }

  await applySelected(plan);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
