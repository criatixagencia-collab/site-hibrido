import { createRequire } from "node:module";
import { aiApiKey, aiChatCompletionsUrl, aiModel } from "./ai-config.js";
import { requestCodexJson } from "./codex-json.js";

const require = createRequire(import.meta.url);
const { classifyMarket, maxInternationalFor } = require("./market-classifier.cjs");

const ALLOWED_CATEGORIES = ["Famosos", "Música", "TV", "Cinema"];
const MIN_WORDS = 45;
const MAX_WORDS = 260;
const MIN_CHARACTERS = 500;
const MIN_PARAGRAPHS = 2;
const MAX_PARAGRAPHS = 5;
const MAX_TITLE_CHARACTERS = 82;
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

function countCharacters(paragraphs = []) {
  return paragraphs.join(" ").replace(/\s+/g, " ").trim().length;
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

function repairJsonDraft(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const draft = { ...raw };
  if (typeof draft.body === "string") draft.body = draft.body.split(/\n{2,}/).filter(Boolean);
  if (!Array.isArray(draft.body)) draft.body = [];
  draft.body = draft.body.map(p => String(p).trim()).filter(Boolean);
  if (typeof draft.factualClaims === "string") draft.factualClaims = draft.factualClaims.split(/\n|,\s*/).filter(Boolean);
  if (!Array.isArray(draft.factualClaims)) draft.factualClaims = [];
  if (typeof draft.tags === "string") draft.tags = draft.tags.split(/,\s*/).filter(Boolean);
  if (!Array.isArray(draft.tags)) draft.tags = [];
  if (!draft.imageSubject) draft.imageSubject = "";
  if (!draft.imageSearchQuery) draft.imageSearchQuery = "";
  if (!draft.imageAlt) draft.imageAlt = "";
  if (!draft.rejectionReason) draft.rejectionReason = "";
  if (!draft.status) draft.status = "draft";
  if (!draft.category || !["Famosos", "Música", "TV", "Cinema"].includes(draft.category)) draft.category = "Famosos";
  return draft;
}

function classifyIssues(issues) {
  const GRAVE_PATTERNS = [/inventou/i, /pessoa.*errad/i, /categoria.*errad/i, /evidencia.*contradit/i, /misturou/i, /fato.*invent/i, /pauta.*sem.*base/i, /divergem/i, /nao.*sustenta/i];
  const graves = [], leves = [];
  for (const issue of issues) {
    if (GRAVE_PATTERNS.some(p => p.test(issue))) graves.push(issue);
    else leves.push(issue);
  }
  return { graves, leves };
}

function sanitizeProviderError(value = "") {
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .replace(/sk-proj-\*+[A-Za-z0-9_-]*/g, "sk-proj-***");
}

async function requestProviderJson(messages, maxTokens = 3200) {
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
            "Voce e um revisor factual rigoroso. Compare cada afirmacao especifica do texto somente com as evidencias fornecidas. Nao use memoria externa. Reprove exagero, previsao, contexto biografico, numero, data, fala, agenda, causa, consequencia ou adjetivo promocional sem apoio explicito. ATENCAO: uma pessoa ser mencionada nas evidencias NAO significa que ela participou do fato noticiado. Conexoes entre duas pessoas/eventos (ex: X comentou no post de Y, X reagiu a Y) so sao validas se uma mesma evidencia explicitar essa conexao. Retorne apenas JSON valido. TAMBEM REPROVE textos que citam fontes no corpo ('segundo uma das manchetes', 'uma das manchetes informa', 'foi divulgada em reportagens').",
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
  const characters = countCharacters(body);

  if (draft.status !== "draft") issues.push(draft.rejectionReason || "pauta rejeitada pelo redator");
  if (!draft.title || draft.title.length > MAX_TITLE_CHARACTERS) issues.push("titulo ausente ou longo");
  if (body.length < MIN_PARAGRAPHS || body.length > MAX_PARAGRAPHS) {
    issues.push(`quantidade de paragrafos fora do limite (${body.length})`);
  }
  if (words < MIN_WORDS || words > MAX_WORDS) issues.push(`tamanho inadequado (${words} palavras)`);
  if (characters < MIN_CHARACTERS) issues.push(`texto curto demais (${characters}/${MIN_CHARACTERS} caracteres)`);
  if (!ALLOWED_CATEGORIES.includes(draft.category)) issues.push("editoria invalida");
  if (!Array.isArray(draft.factualClaims) || draft.factualClaims.length < 2) {
    issues.push("sem lista suficiente de fatos utilizados");
  }
  if (GENERIC_COPY_PATTERNS.some((pattern) => pattern.test(publicText))) {
    issues.push("texto generico, promocional ou institucional");
  }

  return issues;
}

async function writeWithFallback(promptGenerico) {
  // Tenta Codex CLI primeiro (timeout 15s)
  try {
    const result = await Promise.race([
      requestCodexJson({
        schema: null,
        messages: [
          { role: "system", content: "Voce e um jornalista brasileiro de entretenimento. Escreva apenas com base nos fatos fornecidos. Seja direto e factual." },
          { role: "user", content: promptGenerico },
        ],
        timeoutMs: 15000,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Codex timeout 15s")), 15000)),
    ]);
    if (result && typeof result === "object" && result.content) {
      return result.content;
    }
    if (result && typeof result === "string") return result;
  } catch (codexError) {
    console.warn(`[write] Codex falhou, usando DeepSeek: ${codexError.message?.slice(0, 60)}`);
  }

  // Fallback DeepSeek
  const response = await fetch(aiChatCompletionsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel(),
      messages: [
        { role: "system", content: "Voce e um jornalista brasileiro de entretenimento. Escreva apenas com base nos fatos fornecidos. Seja direto e factual." },
        { role: "user", content: promptGenerico },
      ],
      temperature: 0.5,
      max_tokens: 1200,
    }),
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) {
    const message = sanitizeProviderError(data?.error?.message || data?.message || response.statusText);
    throw new Error(`Escrita DeepSeek ${response.status}: ${message}`);
  }
  return data.choices?.[0]?.message?.content || "";
}

async function writeSimpleText(item, evidenceClaims, correction) {
  const intro = correction.length > 0
    ? "Reescreva o rascunho abaixo eliminando estes problemas:\n" + correction.join("\n")
    : "";
  const prompt = `Voce e um jornalista brasileiro de entretenimento do portal BuzzPop.

${intro}
Escreva uma mini-materia jornalistica sobre este assunto usando APENAS os fatos abaixo. Nao invente nada.

FATOS DISPONIVEIS:
${evidenceClaims.map((c, i) => `${i + 1}. ${c}`).join("\n")}

REGRAS:
- Lide direto: primeira frase responde o que aconteceu, com quem, onde e quando
- Tom factual, sem adjetivos promocionais
- Nao cite fontes no corpo
- Paragrafos de 3 a 6 linhas cada (texto bem desenvolvido)
- Escreva entre 500 e 800 CARACTERES no total (conte os caracteres, nao palavras)
- Isso equivale a uns 100-200 palavras, mas o importante sao os CARACTERES
- 2 a ${MAX_PARAGRAPHS} paragrafos
- Nao invente contexto biografico, agenda ou reacao

Responda EXATAMENTE neste formato:

STATUS: draft (ou reject se nao houver fato suficiente)
REJECTION: (motivo se reject)
TITULO: (max 82 caracteres)
LINHA: (resumo em 1 linha)
CATEGORIA: Famosos, Musica, TV ou Cinema
CORPO:
(paragrafo 1)

(paragrafo 2)

(paragrafo 3)

FATOS_USADOS:
- fato 1
- fato 2

TAGS: tag1, tag2, tag3

PESSOA_FOTO: (quem deve aparecer na foto)
BUSCA_FOTO: (termo de busca pra imagem)`;

  const content = await writeWithFallback(prompt);
  return parseSimpleText(content);
}

function parseSimpleText(text) {
  const draft = { status: "draft", rejectionReason: "", title: "", excerpt: "", category: "Famosos", body: [], tags: [], factualClaims: [], imageSubject: "", imageSearchQuery: "", imageAlt: "" };
  const m = (p) => { const r = text.match(p); return r ? r[1].trim() : ""; };
  draft.status = (m(/^STATUS:\s*(\S+)/im) || "draft").toLowerCase();
  draft.rejectionReason = m(/^REJECTION:\s*(.+)$/im);
  draft.title = m(/^TITULO:\s*(.+)$/im).slice(0, 82);
  draft.excerpt = m(/^LINHA:\s*(.+)$/im).slice(0, 220);
  const cat = m(/^CATEGORIA:\s*(\S+)/im);
  if (["Famosos", "Música", "TV", "Cinema"].includes(cat)) draft.category = cat;
  const bodyMatch = text.match(/^CORPO:\s*([\s\S]+?)(?=^FATOS_USADOS:|^TAGS:|^PESSOA_FOTO:|$)/im);
  if (bodyMatch) draft.body = bodyMatch[1].split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
  const factsMatch = text.match(/^FATOS_USADOS:\s*([\s\S]+?)(?=^TAGS:|^PESSOA_FOTO:|^BUSCA_FOTO:|$)/im);
  if (factsMatch) draft.factualClaims = factsMatch[1].split(/\n/).map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  const tagsMatch = text.match(/^TAGS:\s*(.+)$/im);
  if (tagsMatch) draft.tags = tagsMatch[1].split(/,\s*/).map(t => t.trim()).filter(Boolean);
  draft.imageSubject = m(/^PESSOA_FOTO:\s*(.+)$/im) || draft.title || "";
  draft.imageSearchQuery = m(/^BUSCA_FOTO:\s*(.+)$/im) || draft.imageSubject || draft.title || "";
  draft.imageAlt = draft.imageSubject || draft.title || "";
  return repairJsonDraft(draft);
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
          "NAO cite fontes no corpo do texto. Frases como 'segundo uma das manchetes', 'uma das manchetes informa', 'a informacao foi divulgada em reportagens do/da' ou qualquer referencia ao processo de apuracao SAO PROIBIDAS. As fontes aparecem separadas ao final da pagina, nao no texto.",
          "UMA PESSOA ESTAR NAS EVIDENCIAS NAO SIGNIFICA que ela participou do fato ou interagiu com outra pessoa. So escreva \"X comentou\", \"X reagiu\" ou \"X disse\" se a evidencia explicitar essa acao.",
          "Nao transforme possibilidade em fato.",
          "Nao use fechamento institucional, previsao sobre repercussao ou promessa de atualizacao.",
          "Se duas manchetes divergirem, mencione apenas o ponto comum ou rejeite.",
          "Escreva entre 45 e 260 palavras, com no minimo 300 caracteres no corpo, em 2 a 5 paragrafos. Pare quando os fatos acabarem.",
          "Uma nota de 45 a 90 palavras e valida quando as evidencias forem curtas, desde que tenha pelo menos 300 caracteres.",
          "Titulo com no maximo 82 caracteres, direto e sem sensacionalismo.",
          "Editorias permitidas: Famosos, Música, TV ou Cinema.",
          "Use categoryHint quando ele combinar com a pauta; corrija apenas se estiver claramente errado.",
          "factualClaims deve listar, em frases curtas, todos os fatos efetivamente usados.",
          "imageSubject deve identificar exatamente quem ou o que precisa aparecer na foto.",
          "Se nao houver fatos suficientes para pelo menos 45 palavras e 300 caracteres sem repeticao, use status reject.",
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
  let attempt = 1;

  generated = await writeSimpleText(item, evidenceClaims, correction);
  let issues = localIssues(generated, item);
  const { graves, leves } = classifyIssues(issues);

  if (graves.length > 0) {
    return { draft: null, outcome: { id: item.id, title: item.title, categoryHint: item.categoryHint || "", status: "rejected", stage: "writer", attempts: attempt, reasons: graves } };
  }

  if (leves.length > 0 && evidenceClaims.length >= 3) {
    attempt = 2;
    generated = await writeSimpleText(item, evidenceClaims, leves);
    issues = localIssues(generated, item);
    const { graves: graves2 } = classifyIssues(issues);
    if (graves2.length > 0) {
      return { draft: null, outcome: { id: item.id, title: item.title, categoryHint: item.categoryHint || "", status: "rejected", stage: "writer", attempts: attempt, reasons: graves2 } };
    }
  }

  if (!generated.body.length) {
    return { draft: null, outcome: { id: item.id, title: item.title, categoryHint: item.categoryHint || "", status: "rejected", stage: "writer", attempts: attempt, reasons: ["corpo vazio apos escrita"] } };
  }

  const body = generated.body.map(cleanText).filter(Boolean);
  review = await requestIndependentReview({ sourceTitle: item.title, evidenceClaims, draft: { title: generated.title, excerpt: generated.excerpt, body, factualClaims: generated.factualClaims } });

  if (!(review.status === "approved" && review.confidence >= 0.72)) {
    correction = [...review.issues, ...review.unsupportedClaims].filter(Boolean);
    const { graves: rg } = classifyIssues(correction);
    if (rg.length === 0 && body.length > 0) {
      // Erros leves: passa mesmo assim
    } else if (attempt < 2 && evidenceClaims.length >= 3) {
      attempt = 2;
      generated = await writeSimpleText(item, evidenceClaims, correction);
      if (!generated.body.length) {
        return { draft: null, outcome: { id: item.id, title: item.title, categoryHint: item.categoryHint || "", status: "rejected", stage: "review", attempts: attempt, reasons: correction } };
      }
      const body2 = generated.body.map(cleanText).filter(Boolean);
      review = await requestIndependentReview({ sourceTitle: item.title, evidenceClaims, draft: { title: generated.title, excerpt: generated.excerpt, body: body2, factualClaims: generated.factualClaims } });
    } else {
      console.warn(`[editorial] revisor reprovou: ${generated.title}`);
      correction.forEach((issue) => console.warn(`- ${issue}`));
      return { draft: null, outcome: { id: item.id, title: item.title, categoryHint: item.categoryHint || "", status: "rejected", stage: "review", attempts: attempt, reasons: correction } };
    }
  }

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
      writerProvider: "deepseek",
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
    throw new Error("AI_API_KEY ausente. O fluxo editorial nao publica fallback generico.");
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
