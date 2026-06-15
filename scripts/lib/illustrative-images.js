import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { aiApiKey, aiChatCompletionsUrl, aiModel, aiBaseUrl, isOpenAIBaseUrl } from "./ai-config.js";

const execFileAsync = promisify(execFile);
const PUBLIC_IMAGE_DIR = path.resolve("public", "images", "auto");
const PROFILE_MAP_FILE = path.resolve("data", "instagram-profiles.json");
const MIN_BYTES = 1024;
const DEFAULT_INSTAGRAM_ACTOR = "apify/instagram-scraper";
const IMAGE_FETCH_TIMEOUT_MS = Number(process.env.IMAGE_FETCH_TIMEOUT_MS || 15000);
const IMAGE_API_TIMEOUT_MS = Number(process.env.IMAGE_API_TIMEOUT_MS || 60000);
const IMAGE_ARTICLE_TIMEOUT_MS = Number(process.env.IMAGE_ARTICLE_TIMEOUT_MS || 90000);
const IMAGE_CONCURRENCY = Math.max(1, Number(process.env.IMAGE_CONCURRENCY || 3));
let openAIVisionUnavailable = false;
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
  "series em cena": ["seriesemcena.com.br"],
  "séries em cena": ["seriesemcena.com.br"],
  "tecmundo": ["tecmundo.com.br"],
  "terra": ["terra.com.br"],
  "tudo celular": ["tudocelular.com"],
  "tudocelular": ["tudocelular.com"],
  "uol": ["uol.com.br"],
  "veja": ["veja.abril.com.br"],
};

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, "-").slice(0, 80);
}

function hostFromUrl(value = "") {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&atilde;/gi, "ã")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripHtml(value = "") {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCreditText(value = "") {
  return stripHtml(value)
    .replace(/\b(clique para ampliar|compartilhe|leia tamb[eé]m|publicidade)\b/gi, " ")
    .replace(/\s*[-|]\s*(Foto|Imagem|Cr[eé]dito|Credit|Photo)\s*[:/]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180)
    .trim();
}

function looksLikeCreditText(value = "") {
  const text = cleanCreditText(value);
  if (text.length < 4 || text.length > 180) return false;
  if (/[.!?]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(text) && text.length > 120) return false;
  if (/\b(menu|newsletter|assine|coment[aá]rios?|cookies?|whatsapp)\b/i.test(text)) return false;

  return /(\b(foto|imagem|cr[eé]dito|credit|photo|copyright|reprodu[cç][aã]o|divulga[cç][aã]o)\b|©|getty images|agnews|brazil news|instagram|youtube|tiktok|netflix|globo|warner|disney)/i.test(text);
}

function normalizeCreditLabel(value = "") {
  const credit = cleanCreditText(value)
    .replace(/^cr[eé]dito\s*[:/-]\s*/i, "Foto: ")
    .replace(/^credit\s*[:/-]\s*/i, "Foto: ")
    .replace(/^photo\s*[:/-]\s*/i, "Foto: ");

  if (/^(foto|imagem|reprodu[cç][aã]o|divulga[cç][aã]o)\s*[:/-]/i.test(credit)) {
    return credit;
  }

  return `Foto: ${credit}`;
}

function quotedAttributePattern(attribute, names) {
  return [
    new RegExp(`<meta[^>]+${attribute}=["'](?:${names.join("|")})["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["'](?:${names.join("|")})["'][^>]*>`, "i"),
  ];
}

function extractMetaCredit(html = "") {
  const names = [
    "credit",
    "image:credit",
    "article:image:credit",
    "copyright",
    "author",
    "parsely-author",
    "twitter:image:alt",
    "og:image:alt",
  ];

  for (const attribute of ["name", "property"]) {
    for (const pattern of quotedAttributePattern(attribute, names)) {
      const match = html.match(pattern);
      if (match && looksLikeCreditText(match[1])) return normalizeCreditLabel(match[1]);
    }
  }

  return "";
}

function extractJsonLdCredit(html = "") {
  const patterns = [
    /"creditText"\s*:\s*"([^"]+)"/i,
    /"copyrightNotice"\s*:\s*"([^"]+)"/i,
    /"copyrightHolder"\s*:\s*\{[\s\S]{0,240}?"name"\s*:\s*"([^"]+)"/i,
    /"creator"\s*:\s*\{[\s\S]{0,240}?"name"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && looksLikeCreditText(match[1])) return normalizeCreditLabel(match[1]);
  }

  return "";
}

function extractCaptionCredit(html = "") {
  const candidates = [];
  const elementPattern =
    /<(figcaption|caption|p|span|div)[^>]*(?:caption|credit|credito|crédito|copyright|legend|wp-caption-text|image-caption|media-caption|foto)[^>]*>([\s\S]{0,700}?)<\/\1>/gi;

  for (const match of html.matchAll(elementPattern)) {
    candidates.push(match[2]);
  }

  const inlinePattern =
    /(?:Foto|Imagem|Cr[eé]dito|Credit|Photo|Copyright)\s*[:/-]\s*([^<\n\r]{3,180})/gi;
  for (const match of html.matchAll(inlinePattern)) {
    candidates.push(`${match[0]}`);
  }

  for (const candidate of candidates) {
    if (looksLikeCreditText(candidate)) return normalizeCreditLabel(candidate);
  }

  return "";
}

async function extractCreditFromPage(pageUrl = "") {
  if (!/^https?:\/\//i.test(pageUrl)) return "";

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return "";

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !/html|text/i.test(contentType)) return "";

    const html = await response.text();
    return extractJsonLdCredit(html) || extractMetaCredit(html) || extractCaptionCredit(html);
  } catch {
    return "";
  }
}

async function creditForWebCandidate(candidate) {
  const pageCredit = await extractCreditFromPage(candidate.pageUrl || "");
  if (pageCredit) {
    return {
      imageCredit: pageCredit,
      imageCreditStatus: "page-extracted",
      imageCreditSourceUrl: candidate.pageUrl || "",
    };
  }

  const host = hostFromUrl(candidate.pageUrl || candidate.imageUrl);
  return {
    imageCredit: host ? `Imagem ilustrativa: ${host}` : "Imagem ilustrativa",
    imageCreditStatus: "domain-fallback",
    imageCreditSourceUrl: candidate.pageUrl || "",
  };
}

function readProfileMap() {
  if (!existsSync(PROFILE_MAP_FILE)) return {};
  return JSON.parse(readFileSync(PROFILE_MAP_FILE, "utf8"));
}

function profileValueToUrl(profile) {
  if (!profile) return "";
  if (typeof profile === "string") {
    if (/^https?:\/\//i.test(profile)) return profile;
    return `https://www.instagram.com/${profile.replace(/^@/, "")}/`;
  }
  if (profile.url) return profile.url;
  if (profile.profile) return `https://www.instagram.com/${String(profile.profile).replace(/^@/, "")}/`;
  return "";
}

function instagramProfileForArticle(article) {
  const profileMap = readProfileMap();
  const haystack = normalizeText(
    [
      article.title,
      article.excerpt,
      article.imageSearchQuery,
      article.imageAlt,
      ...(article.tags || []),
    ].join(" "),
  );

  const matchedKey = Object.keys(profileMap)
    .filter((key) => haystack.includes(normalizeText(key)))
    .sort((a, b) => normalizeText(b).length - normalizeText(a).length)[0];

  return profileValueToUrl(profileMap[matchedKey]);
}

function sourceHostPatterns(article) {
  const names = [
    article.source,
    ...(article.evidenceSources || []),
    article.sourceUrl,
  ].filter(Boolean);

  const patterns = new Set();
  for (const name of names) {
    const normalized = normalizeText(name);
    if (normalized) patterns.add(normalized);
    const host = hostFromUrl(name);
    if (host) patterns.add(normalizeText(host));

    for (const [sourceName, domains] of Object.entries(SOURCE_DOMAIN_HINTS)) {
      if (normalized.includes(normalizeText(sourceName))) {
        domains.forEach((domain) => patterns.add(normalizeText(domain)));
      }
    }
  }

  return [...patterns];
}

function tokenSet(value = "") {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length >= 5),
  );
}

function titleOverlap(a = "", b = "") {
  const aTokens = tokenSet(a);
  const bTokens = [...tokenSet(b)];
  if (!aTokens.size || !bTokens.length) return 0;
  return bTokens.filter((token) => aTokens.has(token)).length / bTokens.length;
}

function isBlockedCandidate(candidate, article) {
  const joined = normalizeText(
    `${candidate.imageUrl || ""} ${candidate.pageUrl || ""} ${candidate.source || ""} ${candidate.title || ""}`,
  );
  const candidateHost = normalizeText(hostFromUrl(candidate.pageUrl || candidate.imageUrl));
  const articleTerms = [
    article.title,
    article.excerpt,
    article.editorialMeta?.originalTitle,
  ].filter(Boolean);

  if (sourceHostPatterns(article).some((pattern) => {
    if (!pattern || pattern.length < 3) return false;
    return joined.includes(pattern) || candidateHost.includes(pattern.replace(/\s+/g, ""));
  })) {
    return true;
  }

  return articleTerms.some((term) => titleOverlap(term, `${candidate.title} ${candidate.pageUrl}`) > 0.68);
}

function extensionFrom(contentType, url) {
  if (contentType?.includes("avif")) return "avif";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  try {
    const ext = path.extname(new URL(url).pathname).replace(".", "").toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  } catch {
    // Fall through.
  }
  return "jpg";
}

async function duckDuckGoImageCandidates(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const htmlResponse = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      },
    });
    if (!htmlResponse.ok) return [];
    const html = await htmlResponse.text();
    const vqd = html.match(/vqd=["']?([^"'&]+)["']?/)?.[1];
    if (!vqd) return [];

    const imageUrl = `https://duckduckgo.com/i.js?l=br-pt&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;
    const imageResponse = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        referer: searchUrl,
      },
    });
    if (!imageResponse.ok) return [];
    const data = await imageResponse.json();

    return (data.results || []).map((entry) => ({
      imageUrl: entry.image || entry.thumbnail || "",
      pageUrl: entry.url || "",
      source: entry.source || hostFromUrl(entry.url || entry.image || ""),
      title: entry.title || "",
      width: Number(entry.width || 0),
      height: Number(entry.height || 0),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function apifyJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(IMAGE_API_TIMEOUT_MS),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || response.statusText;
    throw new Error(`Apify API ${response.status}: ${message}`);
  }
  return data;
}

function actorPath(actor) {
  return encodeURIComponent(actor.replace("/", "~"));
}

function collectInstagramImages(item) {
  const images = [];
  if (item.displayUrl) images.push(item.displayUrl);
  if (Array.isArray(item.images)) images.push(...item.images.filter(Boolean));
  if (Array.isArray(item.childPosts)) {
    for (const child of item.childPosts) {
      if (child.displayUrl) images.push(child.displayUrl);
      if (Array.isArray(child.images)) images.push(...child.images.filter(Boolean));
    }
  }
  return [...new Set(images)];
}

async function instagramImageCandidates(profileUrl, limit = 6) {
  const token = process.env.APIFY_TOKEN;
  if (!token || token.includes("cole_sua")) return [];

  const actor = process.env.APIFY_INSTAGRAM_ACTOR || DEFAULT_INSTAGRAM_ACTOR;
  const runUrl = new URL(`https://api.apify.com/v2/acts/${actorPath(actor)}/runs`);
  runUrl.searchParams.set("token", token);
  runUrl.searchParams.set("waitForFinish", "180");

  const run = await apifyJson(runUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      addParentData: true,
      directUrls: [profileUrl],
      onlyPostsNewerThan: "30 days",
      resultsLimit: limit,
      resultsType: "posts",
    }),
  });

  const datasetId = run.data?.defaultDatasetId;
  if (!datasetId || !["SUCCEEDED", "TIMED-OUT"].includes(run.data?.status)) return [];

  const datasetUrl = new URL(`https://api.apify.com/v2/datasets/${datasetId}/items`);
  datasetUrl.searchParams.set("token", token);
  datasetUrl.searchParams.set("clean", "true");
  datasetUrl.searchParams.set("format", "json");
  const items = await apifyJson(datasetUrl);

  return items.flatMap((item) => {
    const username = item.ownerUsername || item.username || "";
    const credit = username
      ? `Foto: Reprodução/Instagram/@${username}`
      : "Foto: Reprodução/Instagram";

    return collectInstagramImages(item).map((imageUrl) => ({
      imageUrl,
      pageUrl: item.url || item.inputUrl || profileUrl,
      source: username ? `Instagram @${username}` : "Instagram",
      title: item.caption || "",
      caption: item.caption || "",
      credit,
      timestamp: item.timestamp || "",
      width: Number(item.dimensionsWidth || 0),
      height: Number(item.dimensionsHeight || 0),
      origin: "instagram",
    }));
  }).slice(0, limit);
}

async function downloadImage(url, slug) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return "";
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) return "";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < MIN_BYTES) return "";

  await mkdir(PUBLIC_IMAGE_DIR, { recursive: true });
  const ext = extensionFrom(contentType, url);
  const fileName = `${slug}.${ext}`;
  await writeFile(path.join(PUBLIC_IMAGE_DIR, fileName), bytes);
  return `/images/auto/${fileName}`;
}

async function chooseCandidateWithOpenAI(article, candidates) {
  const apiKey = aiApiKey();
  if (!apiKey || !candidates.length) return 0;

  const response = await fetch(aiChatCompletionsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel(),
      messages: [
        {
          role: "system",
          content:
            "Voce escolhe imagem ilustrativa para noticia. A imagem nao pode ser da materia original nem de site que publicou a mesma noticia. Retorne JSON valido.",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: article.title,
            excerpt: article.excerpt,
            imageSearchQuery: article.imageSearchQuery,
            blockedSources: [article.source, ...(article.evidenceSources || [])],
            candidates: candidates.map((candidate, index) => ({
              index,
              source: candidate.source,
              pageUrl: candidate.pageUrl,
              title: candidate.title,
              width: candidate.width,
              height: candidate.height,
            })),
            instruction:
              "Escolha a imagem mais relacionada ao assunto/personagem de forma ilustrativa, mas evite candidato de site jornalistico que esteja cobrindo a mesma noticia. Prefira foto geral, perfil, banco, arquivo, rede oficial ou pagina nao ligada ao artigo.",
          }),
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(IMAGE_API_TIMEOUT_MS),
  });

  if (!response.ok) return 0;
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim());
    const index = Number(parsed.index);
    return Number.isInteger(index) && candidates[index] ? index : 0;
  } catch {
    return 0;
  }
}

async function chooseInstagramCandidateWithOpenAI(article, candidates) {
  const apiKey = aiApiKey();
  if (!apiKey || !candidates.length) return 0;
  if (!isOpenAIBaseUrl()) return chooseCandidateWithOpenAI(article, candidates);

  const content = [
    {
      type: "input_text",
      text: JSON.stringify(
        {
          task:
            "Escolha uma imagem de Instagram para ilustrar uma noticia. A foto deve fazer sentido para a pessoa/personagem principal, mas nao precisa ser sobre a noticia exata. Evite imagem que exponha crianca, baixa qualidade, texto pesado, print, meme ou grupo onde a pessoa central nao aparece bem.",
          title: article.title,
          excerpt: article.excerpt,
          imageSearchQuery: article.imageSearchQuery,
          candidates: candidates.map((candidate, index) => ({
            index,
            pageUrl: candidate.pageUrl,
            credit: candidate.credit,
            caption: candidate.caption,
            timestamp: candidate.timestamp,
          })),
        },
        null,
        2,
      ),
    },
  ];

  for (const candidate of candidates) {
    content.push({ type: "input_image", image_url: candidate.imageUrl });
  }

  const response = await fetch(`${aiBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || aiModel(),
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "instagram_image_choice",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["index", "reason"],
            properties: {
              index: { type: "integer", minimum: 0 },
              reason: { type: "string" },
            },
          },
        },
      },
      max_output_tokens: 500,
    }),
    signal: AbortSignal.timeout(IMAGE_API_TIMEOUT_MS),
  });

  if (!response.ok) return 0;
  const data = await response.json();
  const text =
    data.output_text ||
    (data.output || [])
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join("\n");
  try {
    const parsed = JSON.parse(text);
    const index = Number(parsed.index);
    return Number.isInteger(index) && candidates[index] ? index : 0;
  } catch {
    return 0;
  }
}

async function chooseCandidateWithOpenAIVision(article, candidates, origin) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey || !candidates.length) throw new Error("OPENAI_API_KEY ausente");

  const content = [
    {
      type: "input_text",
      text: JSON.stringify(
        {
          task:
            "Escolha uma foto jornalisticamente segura para ilustrar a noticia. Voce esta vendo os pixels das candidatas: use a imagem, nao apenas URL ou legenda.",
          article: {
            title: article.title,
            excerpt: article.excerpt,
            category: article.category,
            imageSubject: article.imageSubject,
            imageSearchQuery: article.imageSearchQuery,
            imageAlt: article.imageAlt,
          },
          origin,
          requirements: [
            "A pessoa, obra, programa ou evento central precisa estar claramente correto.",
            "Para noticia sobre uma pessoa, prefira rosto identificavel e enquadramento individual.",
            "Rejeite pessoa errada, grupo confuso, crianca como foco de noticia sobre adulto, meme, print, texto pesado, montagem ou baixa qualidade.",
            "Rejeite imagem que sugira um acontecimento diferente do texto.",
            "Rejeite logo, poster ou objeto quando existe uma pessoa central que deveria aparecer.",
            "Se nenhuma candidata for segura, use approved=false e candidateIndex=-1.",
          ],
          candidates: candidates.map((candidate, index) => ({
            index,
            pageUrl: candidate.pageUrl,
            source: candidate.source,
            title: candidate.title,
            caption: candidate.caption,
            width: candidate.width,
            height: candidate.height,
          })),
        },
        null,
        2,
      ),
    },
  ];

  for (const candidate of candidates) {
    content.push({ type: "input_image", image_url: candidate.imageUrl });
  }

  const model =
    process.env.OPENAI_VISION_MODEL ||
    process.env.OPENAI_REVIEW_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "buzzpop_image_review",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "approved",
              "candidateIndex",
              "confidence",
              "reason",
              "visibleSubject",
              "concerns",
            ],
            properties: {
              approved: { type: "boolean" },
              candidateIndex: { type: "integer", minimum: -1 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reason: { type: "string" },
              visibleSubject: { type: "string" },
              concerns: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      max_output_tokens: 700,
    }),
    signal: AbortSignal.timeout(IMAGE_API_TIMEOUT_MS),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || response.statusText;
    throw new Error(`OpenAI vision ${response.status}: ${message}`);
  }

  const output =
    data.output_text ||
    (data.output || [])
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join("\n");
  const result = JSON.parse(output);
  const index = Number(result.candidateIndex);
  const approved =
    result.approved === true &&
    Number(result.confidence || 0) >= 0.72 &&
    Number.isInteger(index) &&
    Boolean(candidates[index]);

  return {
    ...result,
    approved,
    candidateIndex: approved ? index : -1,
    confidence: Number(result.confidence || 0),
    model,
  };
}

async function downloadVisionCandidate(candidate, directory, index) {
  const response = await fetch(candidate.imageUrl, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return "";
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) return "";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < MIN_BYTES) return "";
  const ext = extensionFrom(contentType, candidate.imageUrl);
  const file = path.join(directory, `candidate-${index}.${ext}`);
  await writeFile(file, bytes);
  return file;
}

async function chooseCandidateWithCodexVision(article, candidates, origin) {
  if (process.env.USE_CODEX_VISION !== "true") {
    throw new Error("USE_CODEX_VISION nao ativado");
  }

  const directory = await mkdtemp(path.join(os.tmpdir(), "buzzpop-vision-"));
  try {
    const downloaded = [];
    for (let index = 0; index < candidates.length; index += 1) {
      try {
        const file = await downloadVisionCandidate(candidates[index], directory, index);
        if (file) downloaded.push({ index, file });
      } catch {
        // Candidate remains unavailable to the visual reviewer.
      }
    }
    if (!downloaded.length) throw new Error("nenhuma candidata pode ser baixada para o Codex");

    const schemaFile = path.join(directory, "schema.json");
    const outputFile = path.join(directory, "result.json");
    await writeFile(
      schemaFile,
      JSON.stringify({
        type: "object",
        additionalProperties: false,
        required: [
          "approved",
          "candidateIndex",
          "confidence",
          "reason",
          "visibleSubject",
          "concerns",
        ],
        properties: {
          approved: { type: "boolean" },
          candidateIndex: { type: "integer" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
          visibleSubject: { type: "string" },
          concerns: { type: "array", items: { type: "string" } },
        },
      }),
    );

    const attachmentMap = downloaded.map((entry, position) => ({
      attachment: position + 1,
      candidateIndex: entry.index,
      source: candidates[entry.index].source,
      title: candidates[entry.index].title,
      pageUrl: candidates[entry.index].pageUrl,
    }));
    const prompt = JSON.stringify({
      role: "revisor visual de fotografia jornalistica",
      instruction:
        "Analise as imagens anexadas e retorne somente o JSON do schema. Escolha uma candidata apenas se a pessoa, obra, programa ou evento central estiver claramente correto. Rejeite pessoa errada, grupo confuso, crianca como foco indevido, meme, print, montagem, texto pesado, baixa qualidade, poster/logo quando deveria haver pessoa, ou imagem que sugira outro acontecimento. Se nenhuma for segura, approved=false e candidateIndex=-1.",
      article: {
        title: article.title,
        excerpt: article.excerpt,
        category: article.category,
        imageSubject: article.imageSubject,
        imageAlt: article.imageAlt,
      },
      origin,
      attachmentMap,
    });
    const codexBin = process.env.CODEX_BIN || "codex";
    const imageArgs = downloaded.flatMap((entry) => ["--image", entry.file]);

    const result = await new Promise((resolve, reject) => {
      const child = spawn(
        codexBin,
        [
          "exec",
          "--ephemeral",
          "--skip-git-repo-check",
          "--output-schema",
          schemaFile,
          "--output-last-message",
          outputFile,
          "-C",
          directory,
          ...imageArgs,
        ],
        {
          cwd: directory,
          env: {
            ...process.env,
            CODEX_HOME: process.env.CODEX_HOME || "/Users/rafaeloliver/.codex",
          },
          timeout: Math.min(
            Number(process.env.CODEX_VISION_TIMEOUT_MS || 60000),
            IMAGE_API_TIMEOUT_MS,
          ),
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => { stdout += data.toString(); });
      child.stderr.on("data", (data) => { stderr += data.toString(); });

      child.on("close", (exitCode) => {
        resolve({ exitCode, stdout, stderr });
      });

      child.on("error", (error) => { reject(error); });

      child.stdin.write(prompt);
      child.stdin.end();
    });

    if (result.exitCode !== 0) {
      throw new Error(`Codex CLI saiu com codigo ${result.exitCode}: ${result.stderr}`);
    }

    const output = JSON.parse(await readFile(outputFile, "utf8"));
    const index = Number(output.candidateIndex);
    const approved =
      output.approved === true &&
      Number(output.confidence || 0) >= 0.72 &&
      Number.isInteger(index) &&
      Boolean(candidates[index]) &&
      downloaded.some((entry) => entry.index === index);
    return {
      ...output,
      approved,
      candidateIndex: approved ? index : -1,
      confidence: Number(output.confidence || 0),
      model: "codex-cli",
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function chooseCandidateVisually(article, candidates, origin) {
  const errors = [];
  if (!openAIVisionUnavailable) {
    try {
      return await chooseCandidateWithOpenAIVision(article, candidates, origin);
    } catch (error) {
      openAIVisionUnavailable = true;
      errors.push(`OpenAI API: ${error.message || error}`);
    }
  } else {
    errors.push("OpenAI API: indisponivel nesta rodada");
  }

  try {
    return await chooseCandidateWithCodexVision(article, candidates, origin);
  } catch (error) {
    errors.push(`Codex CLI: ${error.message || error}`);
  }

  return {
    approved: false,
    candidateIndex: -1,
    confidence: 0,
    reason: errors.join(" | "),
    concerns: ["vision-unavailable"],
    model: "",
  };
}

function pendingImageArticle(article, reason, concern) {
  return {
    ...article,
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
      concerns: [concern],
      origin: "best-effort",
    },
  };
}

export async function applyIllustrativeImages(articles) {
  const updated = new Array(articles.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < articles.length) {
      const index = nextIndex;
      nextIndex += 1;
      const article = articles[index];

      try {
        updated[index] = await withTimeout(
          applyIllustrativeImage(article),
          IMAGE_ARTICLE_TIMEOUT_MS,
          "Etapa de imagem da materia",
        );
      } catch (error) {
        const reason = `Etapa de imagem expirou ou falhou: ${error.message || error}`;
        console.warn(`[images] ${article.title}: ${reason}`);
        updated[index] = pendingImageArticle(article, reason, "image-timeout-or-error");
      }
    }
  }

  const workerCount = Math.min(IMAGE_CONCURRENCY, Math.max(1, articles.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return updated;
}

/*
 * Each worker isolates failures per article. Network calls below also have
 * their own shorter timeout, so a failed provider cannot block the queue.
 */
async function applyIllustrativeImage(article) {
  const profileUrl = instagramProfileForArticle(article);
  if (profileUrl) {
    try {
      const instagramCandidates = await instagramImageCandidates(profileUrl, 6);
      if (instagramCandidates.length) {
        const decision = await chooseCandidateVisually(article, instagramCandidates, "instagram-oficial");
        if (decision.approved) {
          const chosen = instagramCandidates[decision.candidateIndex];
          const localPath = await downloadImage(chosen.imageUrl, slugify(article.slug || article.title));

          return {
            ...article,
            image: localPath || "",
            imageCredit: localPath
              ? chosen.credit || "Foto: Reprodução/Instagram"
              : "Imagem pendente de revisão",
            imagePostUrl: chosen.pageUrl || "",
            imageCreditStatus: localPath ? "instagram-profile" : "pending-visual-review",
            imageCreditSourceUrl: chosen.pageUrl || "",
            imagePolicy:
              localPath
                ? "Imagem de perfil publico/oficial aprovada por revisao visual; nao copiada da materia original."
                : "Imagem aprovada, mas o download falhou; exige revisao humana.",
            imageReview: {
              status: localPath ? "approved" : "needs-human-review",
              ...decision,
              origin: "instagram-oficial",
            },
          };
        }
      }
    } catch (error) {
      article.editorialMeta = {
        ...(article.editorialMeta || {}),
        instagramImageError: error.message || String(error),
      };
    }
  }

  const query = [
    article.imageSearchQuery,
    article.imageAlt,
    article.category,
    "foto arquivo",
    "-noticia",
    "-exclusivo",
  ]
    .filter(Boolean)
    .join(" ");

  const candidates = (await duckDuckGoImageCandidates(query))
    .filter((candidate) => candidate.imageUrl && /^https?:\/\//i.test(candidate.imageUrl))
    .filter((candidate) => candidate.width >= 300 && candidate.height >= 180)
    .filter((candidate) => !isBlockedCandidate(candidate, article))
    .slice(0, 8);

  if (!candidates.length) {
    return pendingImageArticle(
      article,
      "Sem candidata ilustrativa valida fora das fontes da noticia.",
      "no-valid-candidate",
    );
  }

  let decision;
  try {
    decision = await chooseCandidateVisually(article, candidates, "web");
  } catch (error) {
    decision = {
      approved: false,
      candidateIndex: -1,
      confidence: 0,
      reason: error.message || String(error),
      concerns: ["vision-error"],
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "",
    };
  }

  if (!decision.approved) {
    return {
      ...article,
      image: "",
      imageCredit: "Imagem pendente de revisão",
      imageCreditStatus: "pending-visual-review",
      imageCreditSourceUrl: "",
      imagePolicy: "Nenhuma candidata foi aprovada pela revisao visual automatica.",
      imageCandidates: candidates.map((candidate) => ({
        imageUrl: candidate.imageUrl,
        pageUrl: candidate.pageUrl,
        source: candidate.source,
        title: candidate.title,
        width: candidate.width,
        height: candidate.height,
      })),
      imageReview: {
        status: "needs-human-review",
        ...decision,
        origin: "web",
      },
    };
  }

  const chosen = candidates[decision.candidateIndex];
  const localPath = await downloadImage(chosen.imageUrl, slugify(article.slug || article.title));
  const credit = await creditForWebCandidate(chosen);

  return {
    ...article,
    image: localPath || "",
    imageCredit: localPath ? credit.imageCredit : "Imagem pendente de revisão",
    imagePostUrl: chosen.pageUrl || "",
    imageCreditStatus: localPath ? credit.imageCreditStatus : "pending-visual-review",
    imageCreditSourceUrl: credit.imageCreditSourceUrl,
    imagePolicy: localPath
      ? "Imagem ilustrativa aprovada por revisao visual e escolhida fora das fontes da noticia."
      : "Imagem aprovada, mas o download falhou; exige revisao humana.",
    imageReview: {
      status: localPath ? "approved" : "needs-human-review",
      ...decision,
      origin: "web",
    },
  };
}
