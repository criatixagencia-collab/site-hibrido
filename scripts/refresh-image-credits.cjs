#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const articlesPath = path.join(root, "data", "articles.json");
const reviewQueuePath = path.join(root, "data", "review-queue.json");
const CREDIT_CONCURRENCY = Math.max(1, Number(process.env.IMAGE_CREDIT_CONCURRENCY || 4));

function hostFromUrl(value = "") {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isUrl(value = "") {
  return /^https?:\/\//i.test(String(value).trim());
}

function isDirtyCredit(value = "") {
  const text = String(value);
  return /"\s*(width|height|rel|class|title)\s*=|","|\/?>|#respond|&[a-z]+=|%[0-9a-f]{2}|\\\/|primaryImageOfPage|articleBody|ImageObject|td-image-wrap|bookmark/i.test(text) ||
    (/^[a-z0-9_./"-]+$/i.test(text) && (text.match(/-/g) || []).length > 3);
}

function sourcePageUrl(article) {
  const direct = String(article.imagePostUrl || "").trim();
  if (isUrl(direct)) return direct;

  const credit = String(article.imageCredit || "").trim();
  if (isUrl(credit)) return credit;

  const creditSource = String(article.imageCreditSourceUrl || "").trim();
  if (isUrl(creditSource)) return creditSource;

  const candidate = (article.imageCandidates || []).find((item) => isUrl(item.pageUrl));
  return candidate ? String(candidate.pageUrl).trim() : "";
}

function needsCreditRefresh(article) {
  const pageUrl = sourcePageUrl(article);
  if (!isUrl(pageUrl)) return false;

  const credit = String(article.imageCredit || "").trim();
  const status = String(article.imageCreditStatus || "").trim();
  if (status === "page-extracted" && credit && !isUrl(credit) && !isDirtyCredit(credit)) return false;
  if (status === "domain-fallback" && credit && !isUrl(credit) && !isDirtyCredit(credit)) return false;
  if (status === "instagram-profile" && credit && !isUrl(credit)) return false;
  if (status === "official" && credit && !isUrl(credit)) return false;

  if (!credit || isUrl(credit)) return true;
  if (isDirtyCredit(credit)) return true;
  if (/\b(imagem\s*(ilustrativa|pendente)|busca automatica|duckduckgo|bing|referencia automatica)\b/i.test(credit)) {
    return true;
  }

  const host = hostFromUrl(pageUrl);
  return Boolean(host && normalize(credit).includes(host));
}

async function loadCreditHelper() {
  return import(pathToFileURL(path.join(__dirname, "lib", "illustrative-images.js")).href);
}

async function refreshEntries(entries, label, creditForWebCandidate) {
  const updated = entries.slice();
  let changed = 0;
  let checked = 0;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < updated.length) {
      const index = nextIndex++;
      const article = updated[index];
      if (!needsCreditRefresh(article)) continue;

      checked += 1;
      const pageUrl = sourcePageUrl(article);
      const credit = await creditForWebCandidate({
        pageUrl,
        imageUrl: article.image || "",
        source: article.source || "",
      });

      if (!credit.imageCredit || isUrl(credit.imageCredit)) {
        console.warn(`[creditos:${label}] ${article.slug || article.title}: nao foi possivel extrair credito seguro de ${pageUrl}`);
        continue;
      }

      updated[index] = {
        ...article,
        imageCredit: credit.imageCredit,
        imagePostUrl: article.imagePostUrl || pageUrl,
        imageCreditStatus: credit.imageCreditStatus,
        imageCreditSourceUrl: credit.imageCreditSourceUrl || pageUrl,
      };
      changed += 1;
      console.log(`[creditos:${label}] ${article.slug || article.title}: ${credit.imageCredit}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CREDIT_CONCURRENCY, updated.length) }, () => worker()));
  return { entries: updated, changed, checked };
}

async function refreshJsonFile(filePath, label, creditForWebCandidate) {
  if (!fs.existsSync(filePath)) return { changed: 0, checked: 0, skipped: true };

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(entries)) {
    throw new Error(`${path.relative(root, filePath)} precisa ser um array ou ter items[].`);
  }

  const result = await refreshEntries(entries, label, creditForWebCandidate);
  if (result.changed) {
    const nextData = Array.isArray(data) ? result.entries : { ...data, items: result.entries };
    fs.writeFileSync(filePath, JSON.stringify(nextData, null, 2) + "\n");
  }

  return result;
}

async function main() {
  if (!fs.existsSync(articlesPath)) {
    throw new Error("data/articles.json nao encontrado.");
  }

  const { creditForWebCandidate } = await loadCreditHelper();
  const articleResult = await refreshJsonFile(articlesPath, "articles", creditForWebCandidate);
  const queueResult = await refreshJsonFile(reviewQueuePath, "review-queue", creditForWebCandidate);

  const checked = articleResult.checked + queueResult.checked;
  const changed = articleResult.changed + queueResult.changed;

  console.log(
    `Creditos de imagem verificados: ${checked}; atualizados: ${changed}.`,
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
