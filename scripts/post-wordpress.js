import "dotenv/config";
import { readJson, writeJson } from "./lib/store.js";

const wpUrl = process.env.WP_URL?.replace(/\/$/, "");
const wpApiMode = process.env.WP_API_MODE || "wordpress";
const wpSite = process.env.WP_SITE || (wpUrl ? new URL(wpUrl).hostname : "");
const user = process.env.WP_USER;
const password = process.env.WP_APP_PASSWORD;
const accessToken = process.env.WP_ACCESS_TOKEN;
const status = process.env.WP_STATUS || "draft";

function postsEndpoint() {
  if (wpApiMode === "wordpress_com") {
    if (!wpSite) throw new Error("Preencha WP_SITE=campobelo6.wordpress.com no .env.");
    return `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(wpSite)}/posts`;
  }

  if (!wpUrl) throw new Error("Preencha WP_URL no .env.");
  return `${wpUrl}/wp-json/wp/v2/posts`;
}

function authHeaders() {
  if (wpApiMode === "wordpress_com" && accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  if (!user || !password) return null;
  return {
    Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
  };
}

const auth = authHeaders();
if (!auth) {
  console.log(
    "WordPress nao configurado. Para WordPress.com, preencha WP_ACCESS_TOKEN ou WP_USER/WP_APP_PASSWORD no .env.",
  );
  process.exit(0);
}

const articles = await readJson("articles.json", []);
const published = await readJson("published.json", []);
const publishedIds = new Set(published.map((item) => item.id));
const results = [];
const endpoint = postsEndpoint();

for (const article of articles) {
  if (publishedIds.has(article.id)) continue;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.html,
      status,
      meta: {
        fonte_original: article.sourceUrl,
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Falha ao publicar: ${article.title}`, body);
    continue;
  }

  results.push({
    id: article.id,
    wordpressId: body.id,
    link: body.link,
    publishedAt: new Date().toISOString(),
  });
  console.log(`Publicado: ${body.link}`);
}

await writeJson("published.json", [...published, ...results]);
console.log(`Novos posts enviados ao WordPress: ${results.length}`);
process.exit(0);
