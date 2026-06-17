const fs = require("fs");
const path = require("path");

const NEWS_FILE = path.join(__dirname, "..", "src", "lib", "news-data.ts");

const MIN_BODY_WORDS = 220;
const MIN_BODY_CHARACTERS = 1400;
const MIN_BODY_PARAGRAPHS = 4;

const PUBLIC_COPY_BLOCKLIST = [
  /\brodada\b/i,
  /\bpauta\b/i,
  /\bmonitorad[ao]s?\b/i,
  /\branking\b/i,
  /\bcuradoria\b/i,
  /\bmat[eé]ria-base\b/i,
  /\bfonte principal\b/i,
  /\bfontes de apoio\b/i,
  /\banota[cç][aã]o\b/i,
  /\bpara mim\b/i,
  /\bnosso sistema\b/i,
  /\bmeu sistema\b/i,
  /\bnosso projeto\b/i,
  /\bmeu projeto\b/i,
  /\bganhou força porque\b/i,
  /\bajuda a explicar\b/i,
  /\bcolocou .+ entre os assuntos\b/i,
  /\bfora do notici[aá]rio\b/i,
  /\bfrentes? de repercuss[aã]o\b/i,
  /\bCNN\b/i,
  /\bR7\b/i,
  /\bExame\b/i,
  /\bUOL\b/i,
  /\bG1\b/i,
  /\breportagem\b/i,
  /\bmat[eé]ria\b/i,
  /\bsite\b/i,
  /\bfonte\b/i,
  /\btrending topic\b/i,
  /\btrending topics\b/i,
  /\bphase\b/i,
  /\bred carpet\b/i,
  /\bbombaram\b/i,
  /\bstylist\b/i,
  /\bcausas sociais\b/i,
  /\bcausas apoiadas\b/i,
  /\broutine\b/i,
  /\bcrian[cç]a da foto\b/i,
  /\bilhas particulares\b/i,
  /\bpen[ií]nsula\b/i,
  /\bpr[eé]-lan[cç]amento\b/i,
];

function readNewsSource() {
  return fs.readFileSync(NEWS_FILE, "utf8");
}

function getNewsEntries(source) {
  return [
    ...source.matchAll(
      /slug: "([^"]+)"[\s\S]*?title: "([^"]+)"[\s\S]*?excerpt:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?body: \[([\s\S]*?)\],\n    image/g,
    ),
  ].map((match) => ({
    slug: match[1],
    title: match[2],
    excerpt: match[3],
    body: [...match[4].matchAll(/(["'])((?:\\.|(?!\1)[^\\])*)\1[,|\n]/g)].map(
      (paragraph) => paragraph[2],
    ),
  }));
}

function countBody(body) {
  const text = body.join(" ").replace(/\s+/g, " ").trim();

  return {
    characters: text.length,
    paragraphs: body.length,
    words: text.split(/\s+/).filter(Boolean).length,
  };
}

function findBlockedPublicCopy(entry) {
  const fields = [
    ["title", entry.title],
    ["excerpt", entry.excerpt],
    ...entry.body.map((paragraph, index) => [`body[${index}]`, paragraph]),
  ];

  return fields.flatMap(([field, value]) =>
    PUBLIC_COPY_BLOCKLIST.flatMap((pattern) =>
      pattern.test(value) ? [`${entry.slug}:${field}`] : [],
    ),
  );
}

function findTitleIssues(entry) {
  const issues = [];
  if (/\b(com|de|da|do|das|dos|e|em|para|por)$/i.test(entry.title.trim())) {
    issues.push(`${entry.slug}:title: titulo incompleto`);
  }
  if (entry.title.includes("...")) {
    issues.push(`${entry.slug}:title: titulo truncado`);
  }
  return issues;
}

function validate() {
  const entries = getNewsEntries(readNewsSource());

  if (!entries.length) {
    throw new Error("Nenhuma materia encontrada em src/lib/news-data.ts.");
  }

  const issues = [];

  for (const entry of entries) {
    const stats = countBody(entry.body);
    const blockedCopy = findBlockedPublicCopy(entry);
    const titleIssues = findTitleIssues(entry);

    if (stats.words < MIN_BODY_WORDS) {
      issues.push(`${entry.slug}: ${stats.words}/${MIN_BODY_WORDS} palavras`);
    }

    if (stats.characters < MIN_BODY_CHARACTERS) {
      issues.push(`${entry.slug}: ${stats.characters}/${MIN_BODY_CHARACTERS} caracteres`);
    }

    if (stats.paragraphs < MIN_BODY_PARAGRAPHS) {
      issues.push(`${entry.slug}: ${stats.paragraphs}/${MIN_BODY_PARAGRAPHS} paragrafos`);
    }

    issues.push(...blockedCopy.map((issue) => `${issue}: linguagem interna`));
    issues.push(...titleIssues);
  }

  if (issues.length) {
    console.error("As materias precisam voltar para reescrita antes de publicar:");
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }

  console.log(
    `OK: ${entries.length} materias validas (${MIN_BODY_WORDS}+ palavras, ${MIN_BODY_CHARACTERS}+ caracteres, ${MIN_BODY_PARAGRAPHS}+ paragrafos).`,
  );
}

validate();
