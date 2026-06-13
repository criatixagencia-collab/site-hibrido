import { createRequire } from "node:module";
import { aiApiKey, aiChatCompletionsUrl, aiModel, useCodexForPosts, useOpenAIForPosts } from "./ai-config.js";
import { requestCodexJson } from "./codex-json.js";

const require = createRequire(import.meta.url);
const { classifyMarket, maxInternationalFor } = require("./market-classifier.cjs");

const ALLOWED_CATEGORIES = ["Famosos", "Música", "TV", "Cinema"];
const MIN_WORDS = 45;
const MAX_WORDS = 260;
const MIN_PARAGRAPHS = 2;
const MAX_PARAGRAPHS = 5;
const MAX_TITLE_CHARACTERS = 82;
let openAIReviewUnavailable = false;
const GENERIC_COPY_PATTERNS = [
  /\beste [ée] o resumo da not[ií]cia\b/i,
  /\ba buzzpop brasil acompanha\b/i,
  /\bfique ligado\b/i,
  /\bo assunto gerou grande repercuss[aã]o\b/i,
  /\bas redes sociais foram tomadas\b/i,
  /\bpara quem perdeu o fio da meada\b/i,
  /\ba tend[eê]ncia [ée] que\b/i,
  /\bcontinuar[aá] monitorando\b/i,
  /\btrar[aá] novas informa[cç][õo]es\b/i,
  /\bpromete ser um dos\b/i,
  /\bo caso ganhou espa[cç]o\b/i,
  /\bno centro da hist[oó]ria\b/i,
];

const WRITER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "rejectionReason",
    "title",
    "excerpt",
    "category",
    "body",
    "tags",
    "factualClaims",
    "imageSubject",
    "imageSearchQuery",
    "imageAlt",
  ],
  properties: {
    status: { type: "string", enum: ["draft", "reject"] },
    rejectionReason: { type: "string" },
    title: { type: "string" },
    excerpt: { type: "string" },
    category: { type: "string", enum: ["Famosos", "Música", "TV", "Cinema"] },
    body: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    factualClaims: { type: "array", items: { type: "string" } },
    imageSubject: { type: "string" },
    imageSearchQuery: { type: "string" },
    imageAlt: { type: "string" },
  },
};

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["approved", "confidence", "issues", "unsupportedClaims"],
  properties: {
    approved: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    issues: { type: "array", items: { type: "string" } },
    unsupportedClaims: { type: "array", items: { type: "string" } },
  },
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

function slugify(value = "") {
  return normalize(value).replace(/\s+/g, "-").slice(0, 80).replace(/-$/g, "");
}

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function countWords(paragraphs = []) {
  return paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

function stripTrailingSource(line, sources) {
  let result = cleanText(line.replace(/\u00a0/g, " "));
  for (const source of [...sources].sort((a, b) => b.length - a.length)) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\s+${escaped}$`, "i"), "").trim();
  }
  return result.replace(/\s+[–-]\s+[^–-]{2,50}$/u, "").trim();
}

export function evidenceClaimsFor(item) {
  const sources = (item.evidenceSources || [item.source]).filter(Boolean);
  const claims = String(item.summary || "")
    .split(/\n+/)
    .map((line) => stripTrailingSource(line, sources))
    .filter((line) => line.length >= 18);

  if (item.title) claims.unshift(cleanText(item.title));

  const seen = new Set();
  return claims.filter((claim) => {
    const key = normalize(claim);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function parseJsonContent(raw = "") {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned);
}

function sanitizeProviderError(value = "") {
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .replace(/sk-proj-\*+[A-Za-z0-9_-]*/g, "sk-proj-***");
}

async function requestProviderJson(messages, maxTokens = 3200) {
  if (useCodexForPosts()) {
    return requestCodexJson({ messages, schema: WRITER_SCHEMA });
  }

  const response = await fetch(aiChatCompletionsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel(),
      messages,
      temperature: 0.15,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = sanitizeProviderError(data?.error?.message || data?.message || response.statusText);
    throw new Error(`Editorial provider ${response.status}: ${message}`);
  }

  return parseJsonContent(data.choices?.[0]?.message?.content || "");
}

async function callReviewEndpoint({ url, key, model, provider, payload }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Voce e um revisor factual rigoroso. Compare cada afirmacao especifica do texto somente com as evidencias fornecidas. Nao use memoria externa. Reprove exagero, previsao, contexto biografico, numero, data, fala, agenda, causa, consequencia ou adjetivo promocional sem apoio explicito. ATENCAO: uma pessoa ser mencionada nas evidencias NAO significa que ela participou do fato noticiado. Conexoes entre duas pessoas/eventos (ex: X comentou no post de Y, X reagiu a Y) so sao validas se uma mesma evidencia explicitar essa conexao. Retorne apenas JSON valido.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Audite o rascunho. approved so pode ser true quando todas as afirmacoes verificaveis estiverem apoiadas pelas evidencias e o texto nao tiver enchimento generico.",
            outputFormat: {
              approved: "boolean",
              confidence: "number 0 to 1",
              issues: ["string"],
              unsupportedClaims: ["string"],
            },
            ...payload,
          }),
        },
      ],
    }),
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
    throw new Error(`Editorial review ${response.status}: ${message}`);
  }

  const result = parseJsonContent(data.choices?.[0]?.message?.content || "");
  const rawConfidence = Number(result.confidence || 0);
  return {
    status: result.approved === true ? "approved" : "rejected",
    confidence:
      provider === "configured-provider-second-pass"
        ? Math.min(rawConfidence, 0.85)
        : rawConfidence,
    issues: Array.isArray(result.issues) ? result.issues : [],
    unsupportedClaims: Array.isArray(result.unsupportedClaims)
      ? result.unsupportedClaims
      : [],
    model,
    provider,
  };
}

async function requestIndependentReview(payload) {
  if (useCodexForPosts()) {
    const result = await requestCodexJson({
      schema: REVIEW_SCHEMA,
      messages: [
        {
          role: "system",
          content:
            "Voce e um revisor factual rigoroso. Compare cada afirmacao especifica do texto somente com as evidencias fornecidas. Nao use memoria externa. Reprove exagero, previsao, contexto biografico, numero, data, fala, agenda, causa, consequencia ou adjetivo promocional sem apoio explicito. ATENCAO: uma pessoa ser mencionada nas evidencias NAO significa que ela participou do fato noticiado. Conexoes entre duas pessoas/eventos (ex: X comentou no post de Y, X reagiu a Y) so sao validas se uma mesma evidencia explicitar essa conexao. Retorne apenas JSON valido.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Audite o rascunho. approved so pode ser true quando todas as afirmacoes verificaveis estiverem apoiadas pelas evidencias e o texto nao tiver enchimento generico.",
            outputFormat: {
              approved: "boolean",
              confidence: "number 0 to 1",
              issues: ["string"],
              unsupportedClaims: ["string"],
            },
            ...payload,
          }),
        },
      ],
    });
    return {
      status: result.approved === true ? "approved" : "rejected",
      confidence: Number(result.confidence || 0),
      issues: Array.isArray(result.issues) ? result.issues : [],
      unsupportedClaims: Array.isArray(result.unsupportedClaims)
        ? result.unsupportedClaims
        : [],
      model: "codex-cli",
      provider: "codex-oauth",
    };
  }

  const openAIKey = process.env.OPENAI_API_KEY || "";
  if (openAIKey && !openAIReviewUnavailable) {
    try {
      return await callReviewEndpoint({
        url: "https://api.openai.com/v1/chat/completions",
        key: openAIKey,
        model:
          process.env.OPENAI_REVIEW_MODEL ||
          process.env.OPENAI_MODEL ||
          "gpt-4o-mini",
        provider: "openai",
        payload,
      });
    } catch (error) {
      openAIReviewUnavailable = true;
      console.warn(`[editorial] revisor OpenAI indisponivel: ${error.message || error}`);
    }
  }

  return callReviewEndpoint({
    url: aiChatCompletionsUrl(),
    key: aiApiKey(),
    model: aiModel(),
    provider: "configured-provider-second-pass",
    payload,
  });
}

function localIssues(draft, item) {
  const issues = [];
  const body = Array.isArray(draft.body) ? draft.body.map(cleanText).filter(Boolean) : [];
  const publicText = [draft.title, draft.excerpt, ...body].join(" ");
  const words = countWords(body);

  if (draft.status !== "draft") issues.push(draft.rejectionReason || "pauta rejeitada pelo redator");
  if (!draft.title || draft.title.length > MAX_TITLE_CHARACTERS) issues.push("titulo ausente ou longo");
  if (body.length < MIN_PARAGRAPHS || body.length > MAX_PARAGRAPHS) {
    issues.push(`quantidade de paragrafos fora do limite (${body.length})`);
  }
  if (words < MIN_WORDS || words > MAX_WORDS) issues.push(`tamanho inadequado (${words} palavras)`);
  if (!ALLOWED_CATEGORIES.includes(draft.category)) issues.push("editoria invalida");
  if (!Array.isArray(draft.factualClaims) || draft.factualClaims.length < 2) {
    issues.push("sem lista suficiente de fatos utilizados");
  }
  if (GENERIC_COPY_PATTERNS.some((pattern) => pattern.test(publicText))) {
    issues.push("texto generico, promocional ou institucional");
  }

  return issues;
}

function generationMessages(item, evidenceClaims, correction = []) {
  return [
    {
      role: "system",
      content:
        "Voce e um jornalista brasileiro de entretenimento. Escreva somente com base nas evidencias fornecidas. Nao complete espaco com memoria, conhecimento geral, suposicao ou frases de portal. Prefira uma nota curta e correta a rejeitar uma pauta que tenha um fato claro. Quando o material realmente nao sustentar nem uma nota util, rejeite. Retorne apenas JSON valido.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task:
          correction.length > 0
            ? "Reescreva o rascunho eliminando todos os problemas apontados. Produza a versao factual mais curta que ainda informe algo util."
            : "Produza um rascunho factual para avaliacao humana no BuzzPop.",
        correction,
        rules: [
          "Use exclusivamente informacoes explicitamente contidas em evidenceClaims.",
          "Priorize fatos repetidos por mais de uma manchete e descarte linhas laterais que tratem de outro assunto.",
          "Nao invente contexto de carreira, agenda, bastidor, causa, consequencia, reacao do publico ou declaracao.",
          "UMA PESSOA ESTAR NAS EVIDENCIAS NAO SIGNIFICA que ela participou do fato ou interagiu com outra pessoa. So escreva \"X comentou\", \"X reagiu\" ou \"X disse\" se a evidencia explicitar essa acao.",
          "Nao transforme possibilidade em fato.",
          "Nao use fechamento institucional, previsao sobre repercussao ou promessa de atualizacao.",
          "Se duas manchetes divergirem, mencione apenas o ponto comum ou rejeite.",
          "Escreva entre 45 e 260 palavras, em 2 a 5 paragrafos. Pare quando os fatos acabarem.",
          "Uma nota de 45 a 90 palavras e valida quando as evidencias forem curtas.",
          "Titulo com no maximo 82 caracteres, direto e sem sensacionalismo.",
          "Editorias permitidas: Famosos, Música, TV ou Cinema.",
          "Use categoryHint quando ele combinar com a pauta; corrija apenas se estiver claramente errado.",
          "factualClaims deve listar, em frases curtas, todos os fatos efetivamente usados.",
          "imageSubject deve identificar exatamente quem ou o que precisa aparecer na foto.",
          "Se nao houver fatos suficientes para pelo menos 45 palavras sem repeticao, use status reject.",
        ],
        outputFormat: {
          status: "draft or reject",
          rejectionReason: "string",
          title: "string",
          excerpt: "string",
          category: "Famosos, Música, TV or Cinema",
          body: ["paragraph"],
          tags: ["string"],
          factualClaims: ["string"],
          imageSubject: "string",
          imageSearchQuery: "string",
          imageAlt: "string",
        },
        sourceTitle: item.title,
        categoryHint: item.categoryHint || "",
        evidenceClaims,
        evidenceSources: item.evidenceSources || [item.source],
        publishedAt: item.publishedAt,
      }),
    },
  ];
}

async function draftOne(item) {
  const evidenceClaims = evidenceClaimsFor(item);
  if (evidenceClaims.length < 2) {
    return {
      draft: null,
      outcome: {
        id: item.id,
        title: item.title,
        categoryHint: item.categoryHint || "",
        status: "rejected",
        stage: "evidence",
        reasons: ["menos de duas evidencias utilizaveis"],
      },
    };
  }

  let correction = [];
  let generated;
  let review;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    generated = await requestProviderJson(generationMessages(item, evidenceClaims, correction));
    const issues = localIssues(generated, item);
    if (issues.length) {
      correction = issues;
      if (attempt < 2 && evidenceClaims.length >= 3) continue;
      console.warn(`[editorial] rejeitada: ${item.title}`);
      issues.forEach((issue) => console.warn(`- ${issue}`));
      return {
        draft: null,
        outcome: {
          id: item.id,
          title: item.title,
          categoryHint: item.categoryHint || "",
          status: "rejected",
          stage: "writer",
          attempts: attempt,
          reasons: issues,
        },
      };
    }

    const body = generated.body.map(cleanText).filter(Boolean);
    review = await requestIndependentReview({
      sourceTitle: item.title,
      evidenceClaims,
      draft: {
        title: generated.title,
        excerpt: generated.excerpt,
        body,
        factualClaims: generated.factualClaims,
      },
    });

    if (review.status === "approved" && review.confidence >= 0.72) break;
    correction = [...review.issues, ...review.unsupportedClaims].filter(Boolean);
    if (!correction.length) correction = ["O revisor factual nao aprovou o texto. Reduza-o aos fatos mais evidentes."];
    if (attempt < 2) continue;

    console.warn(`[editorial] revisor reprovou: ${generated.title}`);
    correction.forEach((issue) => console.warn(`- ${issue}`));
    return {
      draft: null,
      outcome: {
        id: item.id,
        title: item.title,
        categoryHint: item.categoryHint || "",
        status: "rejected",
        stage: "review",
        attempts: attempt,
        reasons: correction,
      },
    };
  }

  const body = generated.body.map(cleanText).filter(Boolean);
  const title = cleanText(generated.title);
  const draft = {
    id: item.id,
    reviewId: item.id,
    workflowVersion: 2,
    reviewStatus: "pending-human",
    title,
    slug: slugify(title),
    excerpt: cleanText(generated.excerpt),
    body,
    html: body.map((paragraph) => `<p>${paragraph}</p>`).join("\n"),
    category: generated.category,
    market: classifyMarket({ ...item, ...generated }),
    tags: Array.isArray(generated.tags) ? generated.tags.map(cleanText).filter(Boolean) : [],
    source: item.source,
    sourceUrl: item.link,
    evidenceSources: item.evidenceSources || [item.source],
    evidenceClaims,
    sourceCount: item.sourceCount,
    score: item.score,
    trendBoost: item.trendBoost,
    trendMatches: item.trendMatches || [],
    image: "",
    imageCredit: "",
    imageSubject: cleanText(generated.imageSubject),
    imageSearchQuery: cleanText(generated.imageSearchQuery),
    imageAlt: cleanText(generated.imageAlt || title),
    editorialMeta: {
      originalTitle: item.title,
      sourceId: item.id,
      generationMode: "evidence-grounded-draft",
      writerProvider: useCodexForPosts()
        ? "codex-oauth"
        : useOpenAIForPosts() || !process.env.AI_BASE_URL
          ? "openai"
          : "configured-provider",
      writerModel: aiModel(),
      automatedReview: review,
      factualClaims: generated.factualClaims,
      generatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
  return {
    draft,
    outcome: {
      id: item.id,
      title: item.title,
      generatedTitle: title,
      categoryHint: item.categoryHint || "",
      category: generated.category,
      status: "pending-human",
      stage: "approved",
      attempts: correction.length ? 2 : 1,
      confidence: review.confidence,
      reasons: [],
    },
  };
}

export async function generateEditorialDraftBatch(news) {
  if (!aiApiKey()) {
    throw new Error("AI_API_KEY/OPENAI_API_KEY ausente. O fluxo editorial nao publica fallback generico.");
  }

  const target = Number(process.env.POSTS_PER_RUN || 10);
  const minimum = Number(process.env.MIN_REVIEW_DRAFTS || Math.min(5, target));
  const maxAttempts = Number(process.env.MAX_EDITORIAL_ATTEMPTS || Math.max(target * 3, 20));
  const maxInternational = maxInternationalFor(target);
  const drafts = [];
  const outcomes = [];
  let internationalCount = 0;

  for (const item of news.slice(0, maxAttempts)) {
    if (drafts.length >= target) break;
    try {
      const result = await draftOne(item);
      outcomes.push(result.outcome);
      const draft = result.draft;
      if (!draft) continue;
      if (draft.market === "internacional" && internationalCount >= maxInternational) {
        result.outcome.status = "rejected";
        result.outcome.stage = "market-quota";
        result.outcome.reasons = ["limite de pautas internacionais atingido"];
        continue;
      }
      drafts.push(draft);
      if (draft.market === "internacional") internationalCount += 1;
    } catch (error) {
      console.warn(`[editorial] falha em ${item.title}: ${error.message || error}`);
      outcomes.push({
        id: item.id,
        title: item.title,
        categoryHint: item.categoryHint || "",
        status: "error",
        stage: "provider",
        reasons: [error.message || String(error)],
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target,
    minimum,
    candidatesAvailable: news.length,
    candidatesAttempted: outcomes.length,
    approved: drafts.length,
    rejected: outcomes.filter((item) => item.status === "rejected").length,
    errors: outcomes.filter((item) => item.status === "error").length,
    status: drafts.length >= minimum ? "target-met" : drafts.length ? "below-minimum" : "empty",
    outcomes,
  };

  if (drafts.length < minimum) {
    console.warn(
      `[editorial] ${drafts.length}/${minimum} rascunhos aprovados. Os aprovados serao preservados na fila; consulte o relatorio para as rejeicoes.`,
    );
  }

  return { drafts, report };
}

export async function generateEditorialDrafts(news) {
  const { drafts } = await generateEditorialDraftBatch(news);
  return drafts;
}
