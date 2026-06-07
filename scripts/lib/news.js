import Parser from "rss-parser";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { classifyMarket, maxInternationalFor } = require("./market-classifier.cjs");

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

function isStrongInternationalSignal(item) {
  const minimumScore = Number(process.env.MIN_INTERNATIONAL_SCORE || 120);
  return item.trendBoost || item.score >= minimumScore || (item.sourceCount >= 6 && item.score >= minimumScore - 10);
}

function editorialSortScore(item) {
  const market = item.market || classifyMarket(item);
  const brazilBoost = market === "brasil" ? 60 : 0;
  const internationalTrendBoost = market === "internacional" && item.trendBoost ? 30 : 0;
  return item.score + brazilBoost + internationalTrendBoost;
}

async function addImages(items) {
  return items.map((item) => ({
    ...item,
    image: "",
    imageCredit: "",
    imagePolicy: "Imagem da materia original bloqueada; escolher ilustracao relacionada em etapa separada.",
  }));
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

      const candidate = {
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
      };

      candidate.market = classifyMarket(candidate);
      collected.push(candidate);
    });
  }

  const seen = new Set();
  const eligible = collected
    .filter((item) => {
      const key = normalizeText(item.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return item.sourceCount >= 2 && item.score > 40;
    })
    .filter((item) => item.market === "brasil" || isStrongInternationalSignal(item));

  const maxInternationalCandidates = Number(
    process.env.MAX_INTERNATIONAL_CANDIDATES || maxInternationalFor(Number(process.env.POSTS_PER_RUN || 10)),
  );
  const internationalCandidates = eligible
    .filter((item) => item.market === "internacional")
    .sort((a, b) => b.score - a.score || new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, maxInternationalCandidates);
  const allowedInternationalIds = new Set(internationalCandidates.map((item) => item.id));

  const ranked = eligible
    .filter((item) => item.market === "brasil" || allowedInternationalIds.has(item.id))
    .sort(
      (a, b) =>
        editorialSortScore(b) - editorialSortScore(a) ||
        b.score - a.score ||
        new Date(b.publishedAt) - new Date(a.publishedAt),
    )
    .slice(0, maxItems);

  return addImages(ranked);
}
