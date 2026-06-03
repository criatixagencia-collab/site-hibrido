import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: ["source", "media:content", "media:thumbnail"],
  },
});

const feeds = [
  {
    name: "Google News Brasil - Entretenimento",
    url: "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
  {
    name: "Google News Brasil - Topo",
    url: "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
];

const trendsFeed = {
  name: "Google Trends Brasil",
  url: "https://trends.google.com/trending/rss?geo=BR",
};

const entertainmentTerms = [
  "cinema",
  "filme",
  "serie",
  "series",
  "televisao",
  "tv",
  "musica",
  "show",
  "festival",
  "celebridade",
  "famoso",
  "influenciador",
  "atriz",
  "ator",
  "cantor",
  "streaming",
  "netflix",
  "globoplay",
  "disney",
  "prime video",
  "bbb",
  "reality",
  "cannes",
  "entretenimento",
];

const blockedTerms = [
  "bolsonaro",
  "lula",
  "datafolha",
  "candidatura",
  "eleicao",
  "eleicoes",
  "senado",
  "deputado",
  "ministro",
  "governo",
  "stf",
  "congresso",
  "partido",
  "resumo",
  "proximo capitulo",
  "horoscopo",
  "loteria",
  "apostas",
  "trump",
];

function normalizeTitle(title = "") {
  return title.replace(/\s+-\s+[^-]+$/u, "").trim();
}

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesNormalizedTerm(text, term) {
  const normalizedText = ` ${normalizeText(text)} `;
  const normalizedTerm = normalizeText(term);
  return normalizedText.includes(` ${normalizedTerm} `);
}

function extractSource(item, fallback) {
  if (typeof item.source === "string") return item.source;
  if (item.source?.["#"]) return item.source["#"];
  if (item.creator) return item.creator;
  return fallback;
}

function extractEvidenceSources(item, fallback) {
  const sources = new Set([extractSource(item, fallback)].filter(Boolean));
  const summary = item.contentSnippet || item.content || "";

  summary
    .split(/\n+/)
    .map((line) => line.replace(/\u00a0/g, " ").trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(/\s{2,}/).filter(Boolean);
      const source = parts.length > 1 ? parts.at(-1) : "";
      if (source && source.length <= 45) sources.add(source.trim());
    });

  return [...sources].map((source) => source.replace(/^[-–]\s*/, "").trim()).filter(Boolean);
}

function topicTokens(value = "") {
  const stopwords = new Set([
    "confira",
    "resumo",
    "proximo",
    "capitulo",
    "maio",
    "junho",
    "julho",
    "hoje",
    "ontem",
    "amanha",
    "2026",
  ]);

  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 5 && !stopwords.has(token))
    .slice(0, 10);
}

function trendMatchesFor(item, trends) {
  const itemTokens = new Set(topicTokens(`${item.title} ${item.summary}`));
  return trends.filter((trend) => {
    const trendTokens = topicTokens(trend.title);
    return trendTokens.some((token) => itemTokens.has(token));
  });
}

function hasEntertainmentSignal(title, summary) {
  const text = `${title} ${summary}`;
  return entertainmentTerms.some((term) => includesNormalizedTerm(text, term));
}

function hasBlockedSignal(title, summary) {
  const text = `${title} ${summary}`;
  return blockedTerms.some((term) => includesNormalizedTerm(text, term));
}

function scoreItem(item, index, trends) {
  const text = `${item.title || ""} ${item.contentSnippet || ""} ${item.summary || ""}`;
  const termScore = entertainmentTerms.reduce(
    (score, term) => score + (includesNormalizedTerm(text, term) ? 8 : 0),
    0,
  );
  const recencyScore = Math.max(0, 30 - index);
  const sourceScore = Math.min(item.evidenceSources.length, 6) * 18;
  const trendScore = trendMatchesFor(item, trends).length * 25;
  return termScore + recencyScore + sourceScore + trendScore;
}

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeImageUrl(value, baseUrl) {
  if (!value) return "";
  const clean = decodeHtml(String(value).trim());
  if (!clean) return "";
  try {
    return new URL(clean, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractRssImage(item) {
  const candidates = [
    item.enclosure?.url,
    item["media:content"]?.url,
    item["media:content"]?.$?.url,
    item["media:thumbnail"]?.url,
    item["media:thumbnail"]?.$?.url,
  ];

  return candidates.map((candidate) => normalizeImageUrl(candidate, item.link)).find(Boolean) || "";
}

function extractMetaImage(html, pageUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const image = normalizeImageUrl(html.match(pattern)?.[1], pageUrl);
    if (image) return image;
  }

  return "";
}

async function fetchDuckDuckGoImage(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const htmlResponse = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      },
    });
    if (!htmlResponse.ok) return "";

    const html = await htmlResponse.text();
    const vqd = html.match(/vqd=["']?([^"'&]+)["']?/)?.[1];
    if (!vqd) return "";

    const imageUrl = `https://duckduckgo.com/i.js?l=br-pt&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;
    const imageResponse = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        referer: searchUrl,
      },
    });
    if (!imageResponse.ok) return "";

    const data = await imageResponse.json();
    const result = (data.results || []).find((entry) => {
      const width = Number(entry.width || 0);
      const height = Number(entry.height || 0);
      return entry.image && width >= 300 && height >= 180;
    });

    return normalizeImageUrl(result?.image || result?.thumbnail, searchUrl);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMetaImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      },
    });
    if (!response.ok) return "";
    const html = await response.text();
    return extractMetaImage(html, response.url || url);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function addImages(items) {
  const withRssImages = items.map((item) => ({
    ...item,
    image: extractRssImage(item),
    imageCredit: extractRssImage(item) ? `Imagem: ${item.source}` : "",
  }));

  return Promise.all(
    withRssImages.map(async (item) => {
      if (item.image) return item;
      const image =
        (await fetchDuckDuckGoImage(`${item.title} ${item.source}`)) ||
        (await fetchMetaImage(item.link));
      return {
        ...item,
        image,
        imageCredit: image ? `Imagem: busca automatica / ${item.source}` : "",
      };
    }),
  );
}

async function fetchBrazilTrends() {
  try {
    const parsed = await parser.parseURL(trendsFeed.url);
    return parsed.items.map((item) => ({
      title: item.title || "",
      link: item.link || "",
      summary: item.contentSnippet || item.content || "",
    }));
  } catch (error) {
    console.warn(`[trends] nao foi possivel buscar Google Trends: ${error.message}`);
    return [];
  }
}

export async function fetchEntertainmentNews() {
  const maxItems = Number(process.env.MAX_ITEMS || 18);
  const collected = [];
  const trends = await fetchBrazilTrends();

  for (const feed of feeds) {
    const parsed = await parser.parseURL(feed.url);
    parsed.items.forEach((item, index) => {
      const title = normalizeTitle(item.title);
      if (!title || !item.link) return;

      const summary = item.contentSnippet || item.content || "";
      const evidenceSources = extractEvidenceSources(item, feed.name);
      const trendMatches = trendMatchesFor({ title, summary }, trends);

      if (evidenceSources.length < 2) return;
      if (hasBlockedSignal(title, summary)) return;
      if (!feed.name.includes("Entretenimento") && !hasEntertainmentSignal(title, summary)) return;

      collected.push({
        id: Buffer.from(`${title}:${item.link}`).toString("base64url").slice(0, 20),
        title,
        originalTitle: item.title,
        link: item.link,
        source: extractSource(item, feed.name),
        evidenceSources,
        sourceCount: evidenceSources.length,
        feed: feed.name,
        summary,
        trendMatches: trendMatches.map((trend) => trend.title).slice(0, 5),
        trendBoost: trendMatches.length > 0,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        score: scoreItem({ ...item, title, summary, evidenceSources }, index, trends),
      });
    });
  }

  const seen = new Set();
  const ranked = collected
    .filter((item) => {
      const key = normalizeText(item.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return item.sourceCount >= 2 && item.score > 40;
    })
    .sort((a, b) => b.score - a.score || new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, maxItems);

  return addImages(ranked);
}
