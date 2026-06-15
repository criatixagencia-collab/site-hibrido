import Parser from "rss-parser";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { classifyMarket, maxInternationalFor } = require("./market-classifier.cjs");

const parser = new Parser({
  customFields: {
    item: ["source", "media:content", "media:thumbnail"],
  },
});

const baseFeeds = [
  {
    name: "Google News Brasil - Entretenimento",
    url: "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
  {
    name: "Google News Brasil - Topo",
    url: "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
];

const editorialSearches = [
  {
    name: "Google News - Famosos",
    query: '(famosos OR celebridades OR influenciador OR influenciadora OR artista OR atriz OR cantor) Brasil when:1d',
    categoryHint: "Famosos",
  },
  {
    name: "Google News - Musica",
    query: '(musica OR cantor OR cantora OR banda OR show OR festival OR album OR single OR turne) Brasil when:1d',
    categoryHint: "Música",
  },
  {
    name: "Google News - TV",
    query: '(televisao OR novela OR reality OR "programa de TV" OR audiencia OR apresentador OR apresentadora OR bastidores) Brasil when:1d',
    categoryHint: "TV",
  },
  {
    name: "Google News - Cinema",
    query: '(cinema OR filme OR serie OR streaming OR ator OR atriz OR estreia OR elenco OR premiere) Brasil when:1d',
    categoryHint: "Cinema",
  },
  {
    name: "Google News - Reality",
    query: '(BBB OR "A Fazenda" OR "Power Couple" OR reality OR "show de realidade") Brasil when:1d',
    categoryHint: "TV",
  },
  {
    name: "Google News - Bastidores",
    query: '(bastidores OR entrevista OR "ao vivo" OR casamento OR separacao OR gravidez OR namoro) Brasil when:1d',
    categoryHint: "Famosos",
  },
  {
    name: "Google News - Streaming",
    query: '(streaming OR netflix OR globoplay OR "prime video" OR disney+ OR "max" OR "apple tv") Brasil when:1d',
    categoryHint: "Cinema",
  },
  {
    name: "Google News - Premios",
    query: '(premio OR premiacao OR "tapete vermelho" OR "red carpet" OR festival OR estreia) Brasil when:1d',
    categoryHint: "Cinema",
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
  "cerimonia",
  "copa do mundo",
  "cultura pop",
  "arte",
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

const sportsTerms = [
  "futebol",
  "jogo",
  "partida",
  "transmissao ao vivo",
  "onde assistir",
  "escalacao",
  "placar",
  "gol",
  "tecnico",
  "treinador",
  "atacante",
  "ancelotti",
  "torcer",
  "saida de bola",
];

const culturalSportsTerms = [
  "musica",
  "cantor",
  "cantora",
  "banda",
  "show",
  "cerimonia",
  "abertura",
  "famoso",
  "famosa",
  "influenciador",
  "atriz",
  "ator",
  "audiencia",
  "ibope",
];

const stalePreviewTerms = [
  "veja horario",
  "confira horario",
  "saiba horario",
  "onde assistir",
  "vai cantar",
  "vai se apresentar",
  "sera transmitido",
  "acontece hoje",
  "acontecera",
  "esta marcada",
  "sera realizada",
  "sera exibida",
  "cerimonia de abertura",
  "abertura da copa",
  "show de abertura",
  "primeiro jogo",
];

const postEventTerms = [
  "apos",
  "depois",
  "repercussao",
  "audiencia",
  "ibope",
  "balanco",
  "recorde",
  "resultado",
  "critica",
  "reage",
  "reagiu",
  "foi",
  "terminou",
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

function googleNewsSearchUrl(query) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "BR");
  url.searchParams.set("ceid", "BR:pt-419");
  return url.toString();
}

function editorialCategoryFor(title, summary, hint = "") {
  const text = normalizeText(title);
  const has = (...terms) => terms.some((term) => includesNormalizedTerm(text, term));

  if (has("musica", "cantor", "cantora", "banda", "show", "festival", "album", "single", "cancao")) {
    return "Música";
  }
  if (has("cinema", "filme", "streaming", "diretor", "diretora", "bilheteria", "disney", "marvel")) {
    return "Cinema";
  }
  if (
    has(
      "casamento",
      "termino",
      "separacao",
      "gravidez",
      "namoro",
      "famoso",
      "famosa",
      "influenciador",
      "influenciadora",
    )
  ) {
    return "Famosos";
  }
  if (has("tv", "televisao", "novela", "reality", "programa", "audiencia", "ibope", "globo", "sbt", "record")) {
    return "TV";
  }
  if (has("serie")) return "Cinema";
  return hint || "Famosos";
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

function isSportsOnly(title, summary) {
  const text = `${title} ${summary}`;
  const hasSports = sportsTerms.some((term) => includesNormalizedTerm(text, term));
  const hasCulturalAngle = culturalSportsTerms.some((term) => includesNormalizedTerm(text, term));
  return hasSports && !hasCulturalAngle;
}

function isFreshEnough(item) {
  const published = new Date(item.isoDate || item.pubDate || item.publishedAt || "");
  if (Number.isNaN(published.getTime())) return true;
  const maxAgeHours = Number(process.env.MAX_NEWS_AGE_HOURS || 36);
  return Date.now() - published.getTime() <= maxAgeHours * 60 * 60 * 1000;
}

function isStaleEventPreview(title, summary) {
  const text = `${title} ${summary}`;
  const normalized = normalizeText(text);
  const hasPreview = stalePreviewTerms.some((term) => includesNormalizedTerm(normalized, term));
  if (!hasPreview) return false;

  const hasPostEventAngle = postEventTerms.some((term) => includesNormalizedTerm(normalized, term));
  if (hasPostEventAngle) return false;

  const isCopaOpening = includesNormalizedTerm(normalized, "copa") && includesNormalizedTerm(normalized, "abertura");
  return isCopaOpening || hasPreview;
}

function scoreItem(item, index, trends) {
  const text = `${item.title || ""} ${item.contentSnippet || ""} ${item.summary || ""}`;
  const termScore = entertainmentTerms.reduce(
    (score, term) => score + (includesNormalizedTerm(text, term) ? 8 : 0),
    0,
  );
  const recencyScore = Math.max(0, 24 - index);
  const sourceScore = Math.min(item.evidenceSources.length, 6) * 28;
  const trendScore = trendMatchesFor(item, trends).length * 45;
  return termScore + recencyScore + sourceScore + trendScore;
}

function isStrongInternationalSignal(item) {
  const minimumScore = Number(process.env.MIN_INTERNATIONAL_SCORE || 120);
  return item.trendBoost || item.score >= minimumScore || (item.sourceCount >= 6 && item.score >= minimumScore - 10);
}

function editorialSortScore(item) {
  const market = item.market || classifyMarket(item);
  const brazilBoost = market === "brasil" ? 45 : 0;
  const trendBoost = item.trendBoost ? 50 : 0;
  const coverageBoost = Math.min(item.sourceCount || 1, 6) * 18;
  const multiSourceBoost = (item.sourceCount || 0) >= 2 ? 35 : 0;
  return item.score + brazilBoost + trendBoost + coverageBoost + multiSourceBoost;
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

function buildFeeds(trends) {
  const configured = editorialSearches.map((feed) => ({
    ...feed,
    url: googleNewsSearchUrl(feed.query),
  }));
  const trendSearches = trends
    .filter((trend) => hasEntertainmentSignal(trend.title, trend.summary))
    .slice(0, Number(process.env.MAX_TREND_SEARCHES || 8))
    .map((trend, index) => ({
      name: `Google News - Tendencia ${index + 1}`,
      url: googleNewsSearchUrl(
        `"${trend.title}" (famosos OR musica OR show OR TV OR cinema OR filme OR serie) when:2d`,
      ),
      trendQuery: trend.title,
    }));

  return [...baseFeeds, ...configured, ...trendSearches];
}

function selectBalanced(items, maxItems) {
  const categories = ["Famosos", "Música", "TV", "Cinema"];
  const minimumPerCategory = Number(
    process.env.MIN_CANDIDATES_PER_CATEGORY || Math.min(5, Math.max(1, Math.floor(maxItems / 4))),
  );
  const selected = [];
  const selectedIds = new Set();

  for (const category of categories) {
    items
      .filter((item) => item.categoryHint === category)
      .slice(0, minimumPerCategory)
      .forEach((item) => {
        if (selectedIds.has(item.id) || selected.length >= maxItems) return;
        selected.push(item);
        selectedIds.add(item.id);
      });
  }

  for (const item of items) {
    if (selected.length >= maxItems) break;
    if (selectedIds.has(item.id)) continue;
    selected.push(item);
    selectedIds.add(item.id);
  }

  return selected.sort(
    (a, b) =>
      editorialSortScore(b) - editorialSortScore(a) ||
      b.score - a.score ||
      new Date(b.publishedAt) - new Date(a.publishedAt),
  );
}

export async function fetchEntertainmentNews() {
  const configuredMaxItems = Number(process.env.MAX_ITEMS || 40);
  const editorialPoolCap = Number(process.env.MAX_CAIQUE_NEWS_POOL || 40);
  const maxItems = Math.min(configuredMaxItems, editorialPoolCap);
  const collected = [];
  const trends = await fetchBrazilTrends();
  const feeds = buildFeeds(trends);
  const feedResults = await Promise.allSettled(
    feeds.map(async (feed) => ({ feed, parsed: await parser.parseURL(feed.url) })),
  );

  for (const result of feedResults) {
    if (result.status === "rejected") {
      console.warn(`[news] feed indisponivel: ${result.reason?.message || result.reason}`);
      continue;
    }
    const { feed, parsed } = result.value;
    parsed.items.forEach((item, index) => {
      const title = normalizeTitle(item.title);
      if (!title || !item.link) return;

      const summary = item.contentSnippet || item.content || "";
      const evidenceSources = extractEvidenceSources(item, feed.name);
      const trendMatches = trendMatchesFor({ title, summary }, trends);

      if (!isFreshEnough(item)) return;
      if (evidenceSources.length < 1) return;
      if (hasBlockedSignal(title, summary)) return;
      if (isSportsOnly(title, summary)) return;
      if (isStaleEventPreview(title, summary)) return;
      if (
        !feed.name.includes("Entretenimento") &&
        !feed.categoryHint &&
        !hasEntertainmentSignal(title, summary)
      ) {
        return;
      }

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
        trendQuery: feed.trendQuery || "",
        categoryHint: editorialCategoryFor(title, summary, feed.categoryHint),
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        score: scoreItem({ ...item, title, summary, evidenceSources }, index, trends),
      };

      candidate.market = classifyMarket(candidate);
      collected.push(candidate);
    });
  }

  const seen = new Set();
  const minCandidateScore = Number(process.env.MIN_CANDIDATE_SCORE || 45);
  const eligible = collected
    .filter((item) => {
      const key = normalizeText(item.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return (
        item.score >= minCandidateScore &&
        ((item.sourceCount || 0) >= 2 || item.trendBoost || item.score >= minCandidateScore + 35)
      );
    })
    .filter((item) => item.market === "brasil" || isStrongInternationalSignal(item));

  const maxInternationalCandidates = Number(
    process.env.MAX_INTERNATIONAL_CANDIDATES || Math.min(2, maxInternationalFor(Number(process.env.POSTS_PER_RUN || 20))),
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
    );

  const balanced = selectBalanced(ranked, maxItems);
  console.log(
    `[news] ${feeds.length} feeds, ${collected.length} candidatos, ${eligible.length} elegiveis, ${balanced.length} selecionados.`,
  );
  const categoryCounts = balanced.reduce((counts, item) => {
    counts[item.categoryHint] = (counts[item.categoryHint] || 0) + 1;
    return counts;
  }, {});
  console.log(`[news] distribuicao: ${JSON.stringify(categoryCounts)}`);
  return addImages(balanced);
}
