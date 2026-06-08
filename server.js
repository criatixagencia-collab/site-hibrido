import "dotenv/config";
import express from "express";
import cron from "node-cron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchEntertainmentNews } from "./scripts/lib/news.js";
import { generateArticles, toBuzzItems } from "./scripts/lib/articles.js";
import { ensureDataDir, readJson, writeJson } from "./scripts/lib/store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3007);
const clientDir = path.join(__dirname, "dist", "client");
const publicDir = path.join(__dirname, "public");
let workerPromise;

app.use(express.json({ limit: "2mb" }));

await ensureDataDir();

async function getBuiltWorker() {
  if (!workerPromise) {
    workerPromise = import("./dist/server/index.js").then((module) => module.default);
  }
  return workerPromise;
}

async function refreshRadar() {
  const news = await fetchEntertainmentNews();
  await writeJson("news.json", news);
  const articles = await generateArticles(news);
  await writeJson("articles.json", articles);
  const feed = {
    generatedAt: new Date().toISOString(),
    count: articles.length,
    newsCount: news.length,
    items: toBuzzItems(articles),
  };
  await writeJson("hybrid-feed.json", feed);
  return { news, articles, feed };
}

app.get("/api/news", async (_req, res) => {
  const feed = await readJson("hybrid-feed.json", null);
  const news = await readJson("news.json", []);
  const articles = await readJson("articles.json", []);
  res.json({
    ok: true,
    generatedAt: feed?.generatedAt || null,
    items: feed?.items || [],
    news,
    articles,
  });
});

app.post("/api/refresh", async (_req, res) => {
  const result = await refreshRadar();
  res.json({
    ok: true,
    generatedAt: result.feed.generatedAt,
    count: result.feed.items.length,
    newsCount: result.news.length,
    items: result.feed.items,
  });
});

// On-demand rewrite endpoint using OpenAI (optional)
app.post('/api/rewrite', async (req, res) => {
  const item = req.body?.item;
  if (!item) return res.status(400).json({ ok: false, message: 'item required' });

  const apiKey = process.env.OPENAI_API_KEY;
  const useOpenAI = process.env.USE_OPENAI_FOR_POSTS === 'true';
  if (!apiKey || !useOpenAI) {
    return res.status(501).json({ ok: false, message: 'OpenAI not configured on server' });
  }

  try {
    const prompt = `Você é um editor jornalístico brasileiro. Reescreva a notícia abaixo em português do Brasil, mantendo fatos publicados e sem adicionar acusações ou falas não verificadas. Retorne apenas JSON válido com chaves: title, excerpt, html (html pode conter <p>..)\n\nNOTÍCIA:\nTítulo: ${item.title || ''}\nResumo/RSS: ${item.summary || ''}\nFontes: ${(item.evidenceSources || []).slice(0,8).join(', ')}\nLink: ${item.link || ''}\nPublicado em: ${item.publishedAt || ''}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um editor brasileiro de entretenimento. Retorne JSON válido.' },
          { role: 'user', content: `${prompt}\n\nRetorne apenas JSON: {"title":"...","excerpt":"...","html":"<p>...</p>"}` },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.status(502).json({ ok: false, message: 'OpenAI error', detail: text });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return res.json({ ok: true, ...parsed });
    } catch (err) {
      return res.status(502).json({ ok: false, message: 'Invalid JSON from OpenAI', raw });
    }
  } catch (error) {
    console.error('[rewrite] error:', error.message || error);
    return res.status(500).json({ ok: false, message: error.message || String(error) });
  }
});

app.get(["/", "/hybrid"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "hybrid.html"));
});

cron.schedule(process.env.CRON_SCHEDULE || "0 * * * *", async () => {
  try {
    const result = await refreshRadar();
    console.log(
      `[hybrid] atualizado: ${result.news.length} noticias, ${result.articles.length} posts`,
    );
  } catch (error) {
    console.error("[hybrid] falhou:", error.message);
  }
});

app.use(express.static(publicDir, { index: false }));
app.use(express.static(clientDir, { index: false }));

app.use(async (req, res) => {
  try {
    const worker = await getBuiltWorker();
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const response = await worker.fetch(
      new Request(url, { method: req.method, headers: req.headers }),
    );
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send(
        "Build do frontend indisponivel. Rode npm run build antes de iniciar o servidor hibrido.",
      );
  }
});

const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`BuzzPop Hibrido rodando em http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});
