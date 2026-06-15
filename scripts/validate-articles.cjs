const fs = require("node:fs");
const path = require("node:path");
const { classifyMarket, marketCounts, maxInternationalFor } = require("./lib/market-classifier.cjs");

const ARTICLES_FILE = path.resolve(__dirname, "..", "data", "articles.json");

const MIN_BODY_WORDS = 10;
const MAX_BODY_WORDS = 280;
const MIN_BODY_CHARACTERS = 60;
const MIN_BODY_PARAGRAPHS = 1;
const MAX_BODY_PARAGRAPHS = 5;
const MAX_TITLE_CHARACTERS = 95;
const MIN_ARTICLES = Number(process.env.MIN_ARTICLES || process.env.POSTS_PER_RUN || 6);
const REQUIRE_PAGE_IMAGE_CREDIT = /^true$/i.test(process.env.REQUIRE_PAGE_IMAGE_CREDIT || "");

const PUBLIC_COPY_BLOCKLIST = [
  /\brodada\b/i,
  /\bpauta\b/i,
  /\bmonitorad[ao]s?\b/i,
  /\branking\b/i,
  /\bcuradoria\b/i,
  /\bmat[eé]ria-base\b/i,
  /\bfonte principal\b/i,
  /\bfontes de apoio\b/i,
  /\banota[cç][aã]o\b/i,
  /\bpara mim\b/i,
  /\bsistema\b/i,
  /\bprojeto\b/i,
  /\balgoritmo\b/i,
  /\bmesa autom[aá]tica\b/i,
  /\bradar\b/i,
  /\bGoogle Trends\b/i,
  /\bselecionad[ao] automaticamente\b/i,
  /\bsele[cç][aã]o entrou\b/i,
  /\bfoi escolhido porque\b/i,
  /\bquantidade de fontes\b/i,
  /\bader[eê]ncia ao universo\b/i,
  /\bcobertura repetida\b/i,
  /\bapareceu entre os assuntos\b/i,
  /\bcruzar sinais\b/i,
  /\bpublica[cç][aã]o recente\b/i,
  /\bpublica[cç][aã]o isolada\b/i,
  /\bchamada principal\b/i,
  /\bpronta para virar post\b/i,
  /\brascunho de WordPress\b/i,
  /\brotina tamb[eé]m pode rodar por cron\b/i,
  /\bsite ganha comportamento vivo\b/i,
  /\bpara quem administra o site\b/i,
  /\bmovimenta debate no cinema\b/i,
  /\brepercute no entretenimento\b/i,
  /\bvolta aos holofotes\b/i,
  /\btem nova atualiza[cç][aã]o\b/i,
  /\beste [ée] o resumo da not[ií]cia\b/i,
  /\ba buzzpop brasil acompanha\b/i,
  /\bfique ligado para mais informa[cç][õo]es\b/i,
  /\bo assunto gerou grande repercuss[aã]o\b/i,
  /\bas redes sociais foram tomadas\b/i,
  /\bcontinuar[aá] monitorando o desdobramento\b/i,
  /\btrar[aá] novas informa[cç][õo]es assim que estiverem dispon[ií]veis\b/i,
  /\bpara quem perdeu o fio da meada\b/i,
  /\bampla cobertura ao assunto\b/i,
  /\ba tend[eê]ncia [ée] que o tema continue\b/i,
  /\bnovos cap[ií]tulos e desdobramentos\b/i,
];

const SOURCE_DOMAIN_HINTS = {
  "adorocinema": ["adorocinema.com"],
  "area vip": ["areavip.com.br"],
  "caras": ["caras.com.br"],
  "cnn brasil": ["cnnbrasil.com.br"],
  "correio do povo": ["correiodopovo.com.br"],
  "extra online": ["extra.globo.com"],
  "folha": ["folha.uol.com.br"],
  "g1": ["g1.globo.com"],
  "gshow": ["gshow.globo.com"],
  "metropoles": ["metropoles.com"],
  "noticias da tv": ["noticiasdatv.uol.com.br"],
  "notícias da tv": ["noticiasdatv.uol.com.br"],
  "o dia": ["odia.ig.com.br"],
  "o globo": ["oglobo.globo.com", "globo.com"],
  "omelete": ["omelete.com.br"],
  "publico": ["publico.pt"],
  "público": ["publico.pt"],
  "radio itatiaia": ["itatiaia.com.br"],
  "rádio itatiaia": ["itatiaia.com.br"],
  "terra": ["terra.com.br"],
  "tudo celular": ["tudocelular.com"],
  "tudocelular": ["tudocelular.com"],
  "uol": ["uol.com.br"],
  "veja": ["veja.abril.com.br"],
};

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hostFromUrl(value = "") {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function textFromHtml(html = "") {
  return String(html)
    .replace(/<p[^>]*class=["'][^"']*article-sources[^"']*["'][\s\S]*?<\/p>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function paragraphsFromArticle(article) {
  if (Array.isArray(article.body) && article.body.length) return article.body;
  return [...String(article.html || "").matchAll(/<p(?![^>]*article-sources)[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function countText(paragraphs) {
  const text = paragraphs.join(" ").replace(/\s+/g, " ").trim();
  return {
    text,
    characters: text.length,
    words: text.split(/\s+/).filter(Boolean).length,
    paragraphs: paragraphs.length,
  };
}

function sourceDomains(article) {
  const values = [article.source, article.sourceUrl, ...(article.evidenceSources || [])].filter(Boolean);
  const domains = new Set();

  for (const value of values) {
    const host = hostFromUrl(value);
    if (host) domains.add(host);

    const normalized = normalize(value);
    for (const [name, hints] of Object.entries(SOURCE_DOMAIN_HINTS)) {
      if (normalized.includes(normalize(name))) hints.forEach((hint) => domains.add(hint));
    }
  }

  return [...domains];
}

function validateText(article, index) {
  const id = article.slug || article.title || `materia-${index + 1}`;
  const issues = [];
  const paragraphs = paragraphsFromArticle(article);
  const stats = countText(paragraphs);
  const publicText = [article.title, article.excerpt, stats.text, textFromHtml(article.html)].join(" ");

  if (stats.words < MIN_BODY_WORDS) issues.push(`${id}: ${stats.words}/${MIN_BODY_WORDS} palavras`);
  if (article.workflowVersion >= 2 && stats.words > MAX_BODY_WORDS) {
    issues.push(`${id}: ${stats.words}/${MAX_BODY_WORDS} palavras; possivel enchimento`);
  }
  if (stats.characters < MIN_BODY_CHARACTERS) {
    issues.push(`${id}: ${stats.characters}/${MIN_BODY_CHARACTERS} caracteres`);
  }
  if (stats.paragraphs < MIN_BODY_PARAGRAPHS) {
    issues.push(`${id}: ${stats.paragraphs}/${MIN_BODY_PARAGRAPHS} paragrafos`);
  }
  if (article.workflowVersion >= 2 && stats.paragraphs > MAX_BODY_PARAGRAPHS) {
    issues.push(`${id}: ${stats.paragraphs}/${MAX_BODY_PARAGRAPHS} paragrafos; texto longo demais para o lastro`);
  }

  for (const pattern of PUBLIC_COPY_BLOCKLIST) {
    if (pattern.test(publicText)) {
      issues.push(`${id}: linguagem interna ou formula proibida (${pattern})`);
    }
  }

  if (/\b(com|de|da|do|das|dos|e|em|para|por)$/i.test(String(article.title || "").trim())) {
    issues.push(`${id}: titulo incompleto`);
  }
  if (String(article.title || "").includes("...")) issues.push(`${id}: titulo truncado`);
  if (String(article.title || "").length > MAX_TITLE_CHARACTERS) issues.push(`${id}: titulo longo demais`);
  if (String(article.slug || "").endsWith("-")) issues.push(`${id}: slug termina com hifen`);
  if (article.workflowVersion >= 2) {
    if (article.humanApproval?.status !== "approved") {
      issues.push(`${id}: sem aprovacao humana`);
    }
  }

  return issues;
}

function validateImage(article, index) {
  const id = article.slug || article.title || `materia-${index + 1}`;
  const issues = [];
  const image = String(article.image || "");
  const imagePostUrl = String(article.imagePostUrl || "");
  const imageCredit = String(article.imageCredit || "");
  const imageCreditStatus = String(article.imageCreditStatus || "");

  if (!image) issues.push(`${id}: sem imagem`);
  if (!imageCredit.trim()) issues.push(`${id}: sem credito de imagem`);
  if (/busca automatica/i.test(imageCredit)) issues.push(`${id}: credito de imagem generico`);

  const imageHost = hostFromUrl(image);
  const postHost = hostFromUrl(imagePostUrl);
  const creditHostMatch = imageCredit.match(/([a-z0-9-]+\.)+[a-z]{2,}/i)?.[0]?.toLowerCase() || "";
  const referenceHost = postHost || imageHost;

  if (image && image !== "/images/news-placeholder.svg" && /^https?:\/\//i.test(image) && !imagePostUrl) {
    issues.push(`${id}: imagem externa sem imagePostUrl`);
  }

  if (referenceHost && creditHostMatch && !referenceHost.endsWith(creditHostMatch)) {
    issues.push(`${id}: credito da imagem nao bate com a origem real (${imageCredit} x ${referenceHost})`);
  }

  if (
    REQUIRE_PAGE_IMAGE_CREDIT &&
    image !== "/images/news-placeholder.svg" &&
    imagePostUrl &&
    !["page-extracted", "instagram-profile", "manual", "official"].includes(imageCreditStatus)
  ) {
    issues.push(`${id}: credito da imagem nao foi extraido da pagina de origem (${imageCreditStatus || "sem status"})`);
  }

  const blockedSource = sourceDomains(article).find((domain) => {
    const normalizedDomain = domain.replace(/^www\./, "").toLowerCase();
    return [imageHost, postHost].filter(Boolean).some((host) => host === normalizedDomain || host.endsWith(`.${normalizedDomain}`));
  });

  if (blockedSource) {
    issues.push(`${id}: imagem vem de fonte da noticia (${blockedSource})`);
  }
  if (article.workflowVersion >= 2 && article.imageReview?.status !== "approved") {
    issues.push(`${id}: imagem sem aprovacao visual`);
  }

  return issues;
}

function validateMarketMix(articles) {
  const counts = marketCounts(articles);
  const maxInternational = maxInternationalFor(articles.length);
  const issues = [];

  if (counts.internacional > maxInternational) {
    issues.push(
      `mix editorial: ${counts.internacional}/${articles.length} materias internacionais; maximo permitido ${maxInternational}`,
    );
  }

  articles.forEach((article, index) => {
    const computedMarket = classifyMarket(article);
    if (article.market && article.market !== computedMarket) {
      const id = article.slug || article.title || `materia-${index + 1}`;
      issues.push(`${id}: mercado marcado como ${article.market}, mas classificado como ${computedMarket}`);
    }
  });

  return issues;
}

function validate() {
  if (!fs.existsSync(ARTICLES_FILE)) {
    throw new Error("data/articles.json nao encontrado.");
  }

  const articles = JSON.parse(fs.readFileSync(ARTICLES_FILE, "utf8"));
  if (!Array.isArray(articles) || !articles.length) {
    throw new Error("data/articles.json nao contem materias.");
  }

  if (articles.length < MIN_ARTICLES) {
    console.error(`data/articles.json reprovado: ${articles.length}/${MIN_ARTICLES} materias publicaveis.`);
    process.exit(1);
  }

  const issues = articles.flatMap((article, index) => [
    ...validateText(article, index),
    ...validateImage(article, index),
  ]);

  issues.push(...validateMarketMix(articles));

  if (issues.length) {
    console.error("data/articles.json reprovado. Corrija ou regenere antes de publicar:");
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }

  console.log(`OK: ${articles.length} materias publicaveis em data/articles.json.`);
}

validate();
