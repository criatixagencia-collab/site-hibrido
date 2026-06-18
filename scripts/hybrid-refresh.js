import "dotenv/config";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fetchEntertainmentNews } from "./lib/news.js";
import { generateEditorialDraftBatch } from "./lib/editorial-drafts.js";
import { toBuzzItems } from "./lib/articles.js";
import { applyIllustrativeImages } from "./lib/illustrative-images.js";
import { writeJson } from "./lib/store.js";

const require = createRequire(import.meta.url);
const { archiveSelectionSnapshot } = require("./lib/archive.cjs");
const IMAGE_STAGE_TIMEOUT_MS = Number(process.env.IMAGE_STAGE_TIMEOUT_MS || 180000);

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} excedeu ${timeoutMs}ms`)),
      timeoutMs,
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function pendingImageDraft(draft, reason = "Etapa de imagem ainda nao executada.") {
  return {
    ...draft,
    image: "",
    imageCredit: "Imagem pendente de revisão",
    imagePostUrl: "",
    imageCreditStatus: "pending-visual-review",
    imageCreditSourceUrl: "",
    imagePolicy: reason,
    imageReview: {
      status: "needs-human-review",
      approved: false,
      candidateIndex: -1,
      confidence: 0,
      reason,
      concerns: ["image-pending"],
      origin: "pending",
    },
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return String(value || "materia")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "") || "materia";
}

function shortText(value, fallback = "") {
  return String(value || fallback || "")
    .replace(/\s+/g, " ")
    .trim();
}

function evidenceClaimsFor(item) {
  const claims = [item.title];
  const summary = String(item.summary || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
  return [...new Set([...claims, ...summary])].filter(Boolean);
}

function buildRawDraft(item, now) {
  const summary = shortText(item.summary, item.title);
  const excerpt = shortText(summary, item.title).slice(0, 240);
  const source = item.source || "";
  const evidenceSources = Array.isArray(item.evidenceSources) && item.evidenceSources.length
    ? item.evidenceSources
    : [source].filter(Boolean);

  return {
    id: item.id,
    reviewId: item.id,
    workflowVersion: 2,
    reviewStatus: "pending-human",
    title: item.title,
    slug: slug(item.title),
    excerpt,
    body: [summary || item.title || ""],
    html: `<p>${escapeHtml(summary || item.title || "")}</p>`,
    category: item.categoryHint || item.category || "Entretenimento",
    market: item.market || "brasil",
    tags: [],
    source,
    sourceUrl: item.link || "",
    evidenceSources,
    evidenceClaims: evidenceClaimsFor(item),
    sourceCount: Number(item.sourceCount || evidenceSources.length || 0),
    score: Number(item.score || 0),
    trendBoost: Boolean(item.trendBoost),
    trendMatches: Array.isArray(item.trendMatches) ? item.trendMatches : [],
    image: item.image || "",
    imageCredit: item.imageCredit || "",
    imagePostUrl: "",
    imageCreditStatus: item.imageCredit ? "raw-source" : "pending-visual-review",
    imageCreditSourceUrl: "",
    imagePolicy: item.imagePolicy || "Imagem pendente; escolher imagem apenas na etapa interativa.",
    imageReview: {
      status: "needs-human-review",
      approved: false,
      candidateIndex: -1,
      confidence: 0,
      reason: "Imagem nao analisada na Etapa 1.",
      concerns: ["raw-collection"],
      origin: "pending",
    },
    editorialMeta: {
      rawItem: true,
      originalTitle: item.originalTitle || item.title,
      sourceId: item.id,
      generationMode: "raw-collection",
      generatedAt: now,
    },
    createdAt: item.publishedAt || now,
  };
}

function buildQueueFromNews(news) {
  const now = new Date().toISOString();
  const items = news
    .map((item) => buildRawDraft(item, now))
    .sort((left, right) => {
      const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
      if (scoreDelta) return scoreDelta;
      return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    });

  return {
    workflowVersion: 2,
    generatedAt: now,
    status: "awaiting-human-review",
    count: items.length,
    newsCount: news.length,
    lastRun: {
      status: "raw-collection",
      candidatesAttempted: news.length,
      approved: 0,
      rejected: 0,
      errors: 0,
      imageStage: "skipped-raw",
    },
    items,
  };
}

function buildQueue({ previousQueue, drafts, newsCount, report, imageStage }) {
  const pendingById = new Map();
  for (const draft of drafts) pendingById.set(draft.reviewId || draft.id, draft);
  const items = [...pendingById.values()].sort(
    (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
  );

  return {
    workflowVersion: 2,
    generatedAt: new Date().toISOString(),
    status: "awaiting-human-review",
    count: items.length,
    newsCount,
    lastRun: {
      status: report.status,
      candidatesAttempted: report.candidatesAttempted,
      approved: report.approved,
      rejected: report.rejected,
      errors: report.errors,
      imageStage,
      previousCount: Array.isArray(previousQueue.items) ? previousQueue.items.length : 0,
    },
    items,
  };
}

async function persistReviewQueue(queue) {
  await writeJson("review-queue.json", queue);
  await writeJson("review-feed.json", {
    generatedAt: queue.generatedAt,
    count: queue.items.length,
    items: toBuzzItems(queue.items),
  });
}

export async function runHybridRefresh() {
  const skipAIWriting = process.env.SKIP_AI_WRITING !== "false";
  const news = await fetchEntertainmentNews();
  await writeJson("news.json", news);

  const rawQueue = buildQueueFromNews(news);
  await persistReviewQueue(rawQueue);
  console.log(
    `[news] ${news.length} noticias coletadas. Fila crua salva com ${rawQueue.items.length} itens.`,
  );

  if (skipAIWriting) {
    console.log(
      "[news] SKIP_AI_WRITING ativo: pulando DeepSeek, revisor factual e imagens na Etapa 1.",
    );
    const report = rawQueue.lastRun;
    const archivePath = archiveSelectionSnapshot({ queue: rawQueue, news, report });
    console.log(`Selecao arquivada em: ${archivePath}`);
    console.log("Nenhuma materia foi publicada em data/articles.json.");
    return { news, queue: rawQueue, report };
  }

  console.log("[editorial] SKIP_AI_WRITING=false: iniciando escrita IA opcional.");
  const { drafts: generatedDrafts, report } = await generateEditorialDraftBatch(news);
  await writeJson("editorial-run-report.json", report);
  const textualDrafts = generatedDrafts.map((draft) => pendingImageDraft(draft));
  let queue = buildQueue({
    previousQueue: rawQueue,
    drafts: textualDrafts,
    newsCount: news.length,
    report,
    imageStage: "pending",
  });
  await persistReviewQueue(queue);
  console.log(
    `Fila textual salva: ${textualDrafts.length} novos rascunhos; imagens seguem como etapa opcional.`,
  );

  let drafts = textualDrafts;
  try {
    drafts = await withTimeout(
      applyIllustrativeImages(generatedDrafts),
      IMAGE_STAGE_TIMEOUT_MS,
      "Etapa visual da rodada",
    );
    queue = buildQueue({
      previousQueue: queue,
      drafts,
      newsCount: news.length,
      report,
      imageStage: "completed",
    });
    await persistReviewQueue(queue);
    console.log(`Etapa visual concluida para ${drafts.length} rascunho(s).`);
  } catch (error) {
    queue = buildQueue({
      previousQueue: queue,
      drafts: textualDrafts,
      newsCount: news.length,
      report,
      imageStage: "failed-or-timeout",
    });
    await persistReviewQueue(queue);
    console.warn(
      `[images] etapa visual falhou; fila textual preservada: ${error.message || error}`,
    );
  }

  console.log(
    `Fila editorial atualizada: ${news.length} noticias analisadas, ${generatedDrafts.length} novos rascunhos, ${queue.items.length} aguardando avaliacao humana.`,
  );
  const archivePath = archiveSelectionSnapshot({ queue, news, report });
  console.log(`Selecao arquivada em: ${archivePath}`);
  console.log(
    `Relatorio: ${report.approved} aprovadas, ${report.rejected} rejeitadas, ${report.errors} erros em ${report.candidatesAttempted} tentativas.`,
  );
  console.log("Nenhuma materia foi publicada em data/articles.json.");
  return { news, drafts, queue, report };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runHybridRefresh()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
