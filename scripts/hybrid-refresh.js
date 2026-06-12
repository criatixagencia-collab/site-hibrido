import "dotenv/config";
import { pathToFileURL } from "node:url";
import { fetchEntertainmentNews } from "./lib/news.js";
import { generateEditorialDraftBatch } from "./lib/editorial-drafts.js";
import { toBuzzItems } from "./lib/articles.js";
import { applyIllustrativeImages } from "./lib/illustrative-images.js";
import { readJson, writeJson } from "./lib/store.js";

export async function runHybridRefresh() {
  const news = await fetchEntertainmentNews();
  await writeJson("news.json", news);

  const { drafts: generatedDrafts, report } = await generateEditorialDraftBatch(news);
  await writeJson("editorial-run-report.json", report);
  const drafts = await applyIllustrativeImages(generatedDrafts);
  const previousQueue = await readJson("review-queue.json", { items: [] });
  const pendingById = new Map(
    (previousQueue.items || [])
      .filter((item) => item.reviewStatus === "pending-human")
      .map((item) => [item.reviewId || item.id, item]),
  );

  for (const draft of drafts) pendingById.set(draft.reviewId || draft.id, draft);
  const queueItems = [...pendingById.values()].sort(
    (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
  );
  const queue = {
    workflowVersion: 2,
    generatedAt: new Date().toISOString(),
    status: "awaiting-human-review",
    count: queueItems.length,
    newsCount: news.length,
    lastRun: {
      status: report.status,
      candidatesAttempted: report.candidatesAttempted,
      approved: report.approved,
      rejected: report.rejected,
      errors: report.errors,
    },
    items: queueItems,
  };

  await writeJson("review-queue.json", queue);
  await writeJson("review-feed.json", {
    generatedAt: queue.generatedAt,
    count: queueItems.length,
    items: toBuzzItems(queueItems),
  });

  console.log(
    `Fila editorial atualizada: ${news.length} noticias analisadas, ${drafts.length} novos rascunhos, ${queueItems.length} aguardando avaliacao humana.`,
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
