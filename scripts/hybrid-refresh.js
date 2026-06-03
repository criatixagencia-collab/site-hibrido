import "dotenv/config";
import { pathToFileURL } from "node:url";
import { fetchEntertainmentNews } from "./lib/news.js";
import { generateArticles, toBuzzItems } from "./lib/articles.js";
import { applyIllustrativeImages } from "./lib/illustrative-images.js";
import { localizeImages } from "./lib/local-images.js";
import { writeJson } from "./lib/store.js";

export async function runHybridRefresh() {
  const news = await fetchEntertainmentNews();
  await writeJson("news.json", news);

  const generatedArticles = await generateArticles(news);
  const articles = await applyIllustrativeImages(generatedArticles);
  await writeJson("articles.json", articles);

  const items = await localizeImages(toBuzzItems(articles));
  await writeJson("hybrid-feed.json", {
    generatedAt: new Date().toISOString(),
    count: items.length,
    newsCount: news.length,
    items,
  });

  console.log(`Radar hibrido atualizado: ${news.length} noticias, ${articles.length} posts.`);
  return { news, articles, items };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runHybridRefresh()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
