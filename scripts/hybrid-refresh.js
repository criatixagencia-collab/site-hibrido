import "dotenv/config";
import { pathToFileURL } from "node:url";
import { fetchEntertainmentNews } from "./lib/news.js";
import { generateEditorialDraftBatch } from "./lib/editorial-drafts.js";
import { toBuzzItems } from "./lib/articles.js";
import { applyIllustrativeImages } from "./lib/illustrative-images.js";
import { readJson, writeJson } from "./lib/store.js";

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

function buildQueue({ previousQueue, drafts, newsCount, report, imageStage }) {
  const pendingById = new Map(
    (previousQueue.items || [])
      .filter((item) => item.reviewStatus === "pending-human")
      .map((item) => [item.reviewId || item.id, item]),
  );

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
  const news = await fetchEntertainmentNews();
  await writeJson("news.json", news);

  const { drafts: generatedDrafts, report } = await generateEditorialDraftBatch(news);
  await writeJson("editorial-run-report.json", report);
  const previousQueue = await readJson("review-queue.json", { items: [] });
  const textualDrafts = generatedDrafts.map((draft) => pendingImageDraft(draft));
  let queue = buildQueue({
    previousQueue,
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
