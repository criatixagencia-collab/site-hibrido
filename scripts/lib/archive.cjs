const fs = require("node:fs");
const path = require("node:path");

const SITE_ROOT = path.resolve(__dirname, "..", "..");
const WORKSPACE_ROOT = path.resolve(SITE_ROOT, "..");
const ARCHIVE_ROOT =
  process.env.BUZZPOP_ARCHIVE_ROOT || path.join(WORKSPACE_ROOT, "ARQUIVO-BUZZPOP");

function pad(value) {
  return String(value).padStart(2, "0");
}

function timestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function uniqueDir(base) {
  if (!fs.existsSync(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Nao foi possivel criar pasta unica para: ${base}`);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function slug(value) {
  return String(value || "sem-titulo")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90)
    .replace(/-$/g, "") || "sem-titulo";
}

function categoryKey(article) {
  const normalized = String(article?.category || "entretenimento")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  if (["musica", "cantor", "cantora", "banda"].includes(normalized)) return "musica";
  if (["tv", "televisao", "reality"].includes(normalized)) return "tv";
  if (["cinema", "filmes", "filme", "streaming"].includes(normalized)) return "cinema";
  if (["famosos", "celebridades", "celebridade", "influenciadores"].includes(normalized)) {
    return "famosos";
  }
  return normalized || "entretenimento";
}

function articleMarkdown(article) {
  const lines = [];
  lines.push(`# ${article.title || "Sem titulo"}`);
  lines.push("");
  if (article.category) lines.push(`Categoria: ${article.category}`);
  if (article.createdAt) lines.push(`Data: ${article.createdAt}`);
  if (article.sourceUrl) lines.push(`Fonte principal: ${article.sourceUrl}`);
  if (article.imageCredit) lines.push(`Credito da imagem: ${article.imageCredit}`);
  lines.push("");
  if (article.excerpt) {
    lines.push(article.excerpt);
    lines.push("");
  }
  const body = Array.isArray(article.body) && article.body.length
    ? article.body
    : [];
  for (const paragraph of body) {
    lines.push(String(paragraph || "").trim());
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

function archiveSelectionSnapshot({ queue, news, report, html, label } = {}) {
  const stamp = timestamp(queue?.generatedAt ? new Date(queue.generatedAt) : new Date());
  const folderName = label || `selecao-${stamp}`;
  const directory = label
    ? uniqueDir(path.join(ARCHIVE_ROOT, "selecoes", folderName))
    : path.join(ARCHIVE_ROOT, "selecoes", folderName);
  ensureDir(directory);

  writeJson(path.join(directory, "metadata.json"), {
    type: "selection",
    createdAt: new Date().toISOString(),
    itemCount: queue?.items?.length || 0,
    newsCount: Array.isArray(news) ? news.length : 0,
    archiveRoot: ARCHIVE_ROOT,
  });
  if (queue) writeJson(path.join(directory, "review-queue.json"), queue);
  if (Array.isArray(news)) writeJson(path.join(directory, "news.json"), news);
  if (report) writeJson(path.join(directory, "editorial-run-report.json"), report);
  if (html) fs.writeFileSync(path.join(directory, "index.html"), html);

  return directory;
}

function archivePublishedArticles({ approved, published } = {}) {
  const approvedItems = Array.isArray(approved) ? approved : [];
  const publishedItems = Array.isArray(published) ? published : [];
  const stamp = timestamp();
  const directory = uniqueDir(path.join(ARCHIVE_ROOT, "publicadas", `publicadas-${stamp}`));
  const batchArticlesDir = path.join(directory, "artigos");
  const allArticlesDir = path.join(ARCHIVE_ROOT, "publicadas", "todas");
  const byCategoryDir = path.join(ARCHIVE_ROOT, "publicadas", "por-categoria");

  ensureDir(batchArticlesDir);
  ensureDir(allArticlesDir);
  ensureDir(byCategoryDir);

  writeJson(path.join(directory, "metadata.json"), {
    type: "published",
    createdAt: new Date().toISOString(),
    approvedThisRun: approvedItems.length,
    totalPublishedStored: publishedItems.length,
    archiveRoot: ARCHIVE_ROOT,
  });
  writeJson(path.join(directory, "approved-this-run.json"), approvedItems);
  writeJson(path.join(directory, "articles-all.json"), publishedItems);

  for (const article of approvedItems) {
    const baseName = `${stamp}__${slug(article.slug || article.title)}`;
    const category = categoryKey(article);
    const categoryDir = path.join(byCategoryDir, category);
    ensureDir(categoryDir);

    writeJson(path.join(batchArticlesDir, `${baseName}.json`), article);
    fs.writeFileSync(path.join(batchArticlesDir, `${baseName}.md`), articleMarkdown(article));
    writeJson(path.join(allArticlesDir, `${baseName}.json`), article);
    fs.writeFileSync(path.join(allArticlesDir, `${baseName}.md`), articleMarkdown(article));
    writeJson(path.join(categoryDir, `${baseName}.json`), article);
    fs.writeFileSync(path.join(categoryDir, `${baseName}.md`), articleMarkdown(article));
  }

  return directory;
}

module.exports = {
  ARCHIVE_ROOT,
  archivePublishedArticles,
  archiveSelectionSnapshot,
};
