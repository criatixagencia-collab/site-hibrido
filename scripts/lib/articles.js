import { aiApiKey, aiChatCompletionsUrl, aiModel } from "./ai-config.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { classifyMarket, maxInternationalFor } = require("./market-classifier.cjs");

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90)
    .replace(/-$/g, "");
}

function cleanFeedSummary(item) {
  const raw = item.summary || item.title || "";
  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith(item.title.toLowerCase()));

  return (lines[0] || raw)
    .replace(/\s{2,}/g, " ")
    .replace(
      /\s+(Globo|UOL|Metropoles|Metrópoles|Noticias da TV|Notícias da TV|purepeople.com.br|gshow.globo.com)$/i,
      "",
    )
    .trim();
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("pt-BR").format(new Date());
  }
}

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
  /\bsele[cç][aã]o entrou\b/i,
  /\bselecionad[ao] automaticamente\b/i,
  /\bescolhido porque\b/i,
  /\bmesa autom[aá]tica\b/i,
  /\balgoritmo\b/i,
  /\bradar verificado\b/i,
  /\bradar de cultura pop\b/i,
  /\bradar\b/i,
  /\bGoogle Trends\b/i,
  /\bquantidade de fontes\b/i,
  /\bader[eê]ncia ao universo\b/i,
  /\bcobertura repetida\b/i,
  /\bapareceu entre os assuntos\b/i,
  /\bcruzar sinais\b/i,
  /\bpublica[cç][aã]o recente\b/i,
  /\bfor[cç]a \d+\b/i,
  /\brefer[eê]ncias reunidas\b/i,
  /\brefer[eê]ncias consultadas\b/i,
  /\bpublica[cç][aã]o isolada\b/i,
  /\bchamada principal\b/i,
  /\bnotici[aá]rio de cultura pop\b/i,
  /\btemas em circula[cç][aã]o\b/i,
  /\bo ponto confirmado\b/i,
  /\ba prioridade desta vers[aã]o\b/i,
];

const MIN_BODY_WORDS = 350;
const MIN_BODY_CHARACTERS = 2200;
const MIN_BODY_PARAGRAPHS = 6;
const MAX_TITLE_CHARACTERS = 95;

function hasInternalPublicCopy(value = "") {
  return PUBLIC_COPY_BLOCKLIST.some((pattern) => pattern.test(value));
}

function extractParagraphsFromHtml(html = "") {
  return [...String(html).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) =>
      match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function isPublishableArticle(article) {
  const publicText = [article.title, article.excerpt, ...(article.body || [])].join(" ");
  return !hasInternalPublicCopy(publicText);
}

function normalizeComparable(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleLooksCopied(originalTitle = "", generatedTitle = "") {
  const original = normalizeComparable(originalTitle);
  const generated = normalizeComparable(generatedTitle);
  if (!original || !generated) return false;
  if (original === generated) return true;

  const originalWords = new Set(original.split(" ").filter((word) => word.length > 3));
  const generatedWords = generated.split(" ").filter((word) => word.length > 3);
  if (!originalWords.size || !generatedWords.length) return false;
  const overlap = generatedWords.filter((word) => originalWords.has(word)).length;
  return overlap / generatedWords.length > 0.82;
}

function bodyStats(body = []) {
  const text = body.join(" ").replace(/\s+/g, " ").trim();
  return {
    characters: text.length,
    paragraphs: body.length,
    words: text.split(/\s+/).filter(Boolean).length,
  };
}

function validateArticle(article, item) {
  const issues = [];
  const publicText = [article.title, article.excerpt, ...(article.body || [])].join(" ");
  const stats = bodyStats(article.body || []);
  if (hasInternalPublicCopy(publicText)) issues.push("linguagem interna ou bastidor editorial");
  if (titleLooksCopied(item.title, article.title)) issues.push("titulo parecido demais com o titulo do RSS");
  if (/movimenta debate|repercute no entretenimento|volta aos holofotes|tem nova atualizacao/i.test(article.title || "")) {
    issues.push("titulo generico ou incoerente");
  }
  if ((article.title || "").length > MAX_TITLE_CHARACTERS) issues.push("titulo longo demais");
  if (stats.paragraphs < MIN_BODY_PARAGRAPHS) issues.push("corpo curto demais");
  if (stats.words < MIN_BODY_WORDS) issues.push("materia com menos de 350 palavras");
  if (stats.characters < MIN_BODY_CHARACTERS) issues.push("materia com menos de 2200 caracteres");
  return issues;
}

function subjectName(item) {
  const title = item.title.replace(/[.!?]+$/g, "");
  const firstChunk = title.split(
    /\s+(bate|detona|luta|ganhou|se manifesta|anuncia|surpreende|diz|deve|volta|morre|participa|em|ap[oó]s)\b/i,
  )[0];
  return firstChunk && firstChunk.length >= 4 ? firstChunk : title;
}

function categoryFor(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/internad|hospital|diagn[oó]stico|infec[cç][aã]o|cirurgia|sa[uú]de|doen[cç]a|recupera/.test(text)) {
    return "Famosos";
  }
  if (/novela|ibope|audi[eê]ncia|reality|casa do patr[aã]o|tv|televis[aã]o/.test(text)) {
    return "Televisao";
  }
  if (/filme|cinema|bilheteria|he-man/.test(text)) return "Cinema";
  if (/netflix|streaming|s[eé]rie/.test(text)) return "Streaming";
  if (/m[uú]sica|cantor|cantora|show|chico|caetano|xuxa/.test(text)) return "Musica";
  if (/virginia|leonardo|famos|ator|atriz|apresentador|influenciador/.test(text)) return "Famosos";
  return "Entretenimento";
}

function referencesNote(item) {
  const sources = item.evidenceSources?.slice(0, 5).join(", ") || item.source;
  return `<p class="article-sources"><strong>Referencias consultadas:</strong> ${sources}. <a href="${item.link}" rel="nofollow noopener" target="_blank">Publicacao original</a></p>`;
}

async function requestOpenAIJson(messages, maxTokens = 1800) {
  const response = await fetch(aiChatCompletionsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel(),
      messages,
      temperature: 0.5,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error ${response.status}`);
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned);
}

function articleFromParsed(item, parsed, generationMode) {
  const fallback = localArticle(item);
  const body = extractParagraphsFromHtml(parsed.html);
  return {
    ...fallback,
    title: parsed.title || fallback.title,
    slug: slugify(parsed.title || fallback.title),
    excerpt: parsed.excerpt || fallback.excerpt,
    category: parsed.category || fallback.category,
    market: classifyMarket({ ...fallback, ...parsed }),
    html: `${parsed.html || fallback.html}${referencesNote(item)}`,
    body: body.length ? body : fallback.body,
    tags: Array.isArray(parsed.tags) ? parsed.tags : fallback.tags,
    imageSearchQuery: parsed.imageSearchQuery || fallback.imageSearchQuery,
    imageAlt: parsed.imageAlt || parsed.title || fallback.imageAlt,
    editorialMeta: {
      ...fallback.editorialMeta,
      generationMode,
      market: classifyMarket({ ...fallback, ...parsed }),
      editorialDecision: parsed.editorialDecision || "",
      riskNotes: Array.isArray(parsed.riskNotes) ? parsed.riskNotes : [],
    },
  };
}

async function repairArticleWithAI(item, article, issues) {
  const repairPrompt = `
Reescreva a materia abaixo porque ela falhou na revisao editorial.

Problemas detectados:
${issues.map((issue) => `- ${issue}`).join("\n")}

Regras:
- Mude o titulo para nao copiar o titulo original.
- Remova qualquer frase que explique processo editorial, fonte, referencia, consistencia, selecao, algoritmo, ranking, radar ou bastidor.
- Escreva como noticia real para leitor final.
- Use apenas os fatos fornecidos. Se faltarem detalhes, seja cauteloso sem dizer que faltam fontes.
- Entregue exatamente 8 paragrafos no campo html.
- Cada paragrafo deve ter 55 a 75 palavras.
- O corpo final deve mirar 480 a 560 palavras e passar obrigatoriamente de 3000 caracteres.
- O titulo deve ter no maximo 95 caracteres.
- Retorne JSON valido.

Titulo original RSS: ${item.title}
Resumo RSS: ${item.summary}
Fontes internas, somente para voce entender o lastro: ${(item.evidenceSources || [item.source]).join(", ")}

Materia ruim:
Titulo: ${article.title}
Linha de apoio: ${article.excerpt}
Corpo:
${(article.body || []).join("\n\n")}
`;

  const parsed = await requestOpenAIJson(
    [
      {
        role: "system",
        content:
          "Voce e um editor brasileiro de entretenimento. Sua tarefa e revisar e reescrever para leitor final. Retorne apenas JSON valido.",
      },
      {
        role: "user",
        content: `${repairPrompt}\nFormato: {"title":"...","excerpt":"...","category":"...","html":"<p>...</p>","tags":["..."],"imageSearchQuery":"...","imageAlt":"...","editorialDecision":"...","riskNotes":["..."]}`,
      },
    ],
    4500,
  );

  return articleFromParsed(item, parsed, "openai-repair");
}

function publicFallbackTitle(item) {
  const subject = subjectName(item);
  const category = categoryFor(item);
  if (category === "Televisao") return `${subject} tem nova atualizacao na TV`;
  if (category === "Cinema") return `${subject} tem nova atualizacao no cinema`;
  if (category === "Streaming") return `${subject} tem novidade no streaming`;
  if (category === "Musica") return `${subject} tem nova atualizacao na musica`;
  if (category === "Famosos") return `${subject} atualiza fas sobre nova fase`;
  return `${subject} tem nova atualizacao`;
}

function buildBody(item) {
  const intro = cleanFeedSummary(item);
  const title = publicFallbackTitle(item);
  const subject = subjectName(item);
  const category = categoryFor(item).toLowerCase();
  return [
    `${title}. O caso ganhou espaco no noticiario de ${category} e envolve um tema acompanhado de perto pelo publico de entretenimento. A informacao disponivel ainda pede cautela, mas ja permite organizar o fato central para quem quer entender o que aconteceu.`,
    intro ||
      "As primeiras informacoes disponiveis ainda trazem poucos detalhes, por isso o texto mantem tom cauteloso e evita acrescentar dado que nao esteja publicado.",
    `No centro da historia esta ${subject}. O nome, a obra ou o programa ligado ao caso ajuda a explicar por que a noticia repercute entre leitores que acompanham famosos, televisao, musica, cinema, streaming e internet.`,
    "A situacao tambem mostra como acontecimentos do entretenimento podem ganhar velocidade quando envolvem estreia, fala publica, audiencia, bastidor de emissora, lancamento ou mudanca na vida de uma personalidade conhecida.",
    "Ainda nao ha espaco para ampliar o caso alem do que foi publicado. Por isso, esta versao evita cravar consequencias, motivacoes ou proximos passos que nao estejam claros nas informacoes disponiveis.",
    "Se houver pronunciamento oficial, nova declaracao, dado de audiencia, agenda de lancamento ou atualizacao relevante, a noticia deve ser revista para incluir o que mudou e corrigir eventuais pontos em aberto.",
  ];
}

function localArticle(item) {
  const intro = cleanFeedSummary(item);
  const body = buildBody(item);
  return {
    id: item.id,
    title: publicFallbackTitle(item),
    slug: slugify(publicFallbackTitle(item)),
    excerpt: intro.slice(0, 220) || item.title,
    source: item.source,
    sourceUrl: item.link,
    score: item.score,
    sourceCount: item.sourceCount,
    trendBoost: item.trendBoost,
    trendMatches: item.trendMatches || [],
    image: item.image || "",
    imageCredit: item.imageCredit || "",
    evidenceSources: item.evidenceSources || [item.source],
    category: categoryFor(item),
    market: classifyMarket(item),
    tags: [
      categoryFor(item).toLowerCase(),
      "entretenimento",
      ...(item.trendBoost ? ["tendencias"] : []),
    ],
    imageSearchQuery: `${subjectName(item)} ${categoryFor(item)} foto`,
    imageAlt: publicFallbackTitle(item),
    html: `${body.map((paragraph) => `<p>${paragraph}</p>`).join("\n")}
${referencesNote(item)}`,
    body,
    editorialMeta: {
      originalTitle: item.title,
      sourceUrl: item.link,
      sourceCount: item.sourceCount,
      evidenceSources: item.evidenceSources || [item.source],
      trendBoost: item.trendBoost,
      trendMatches: item.trendMatches || [],
      generationMode: "local-fallback",
      market: classifyMarket(item),
    },
    createdAt: new Date().toISOString(),
  };
}

async function aiArticle(item) {
  const apiKey = aiApiKey();
  if (!apiKey || process.env.USE_OPENAI_FOR_POSTS !== "true") return localArticle(item);

  const prompt = `
Analise os dados abaixo e escreva uma materia jornalistica de entretenimento para leitor final.

Regras obrigatorias:
- A materia NAO pode mencionar curadoria, selecao, sistema, ranking, radar, Google Trends, algoritmo, mesa automatica, "foi escolhido porque" ou bastidor editorial.
- Nao copie frases das fontes.
- O titulo gerado precisa ser novo. Nao repita nem parafraseie de perto o titulo RSS.
- Nao cole um titulo de fonte com complemento generico. Nunca use formulas como "movimenta debate no cinema", "repercute no entretenimento" ou "volta aos holofotes".
- Se a noticia for sobre saude, internacao, hospital, diagnostico ou cirurgia de uma personalidade, classifique como Famosos, nao como Cinema apenas porque a pessoa e atriz/ator.
- Use apenas fatos presentes nos dados fornecidos. Se faltar detalhe, escreva com cautela.
- Separe fato publicado de especulacao. Nao invente fala, data, valor, acusacao ou bastidor.
- O campo html deve ter exatamente 8 paragrafos <p>...</p>.
- Cada paragrafo deve ter 55 a 75 palavras.
- O corpo final deve mirar 480 a 560 palavras e passar obrigatoriamente de 3000 caracteres.
- O titulo deve ter no maximo 95 caracteres e nao pode terminar parecendo incompleto.
- Escreva como portal brasileiro de entretenimento: titulo direto, linha de apoio objetiva, paragrafos curtos e ritmo de noticia.
- Decida tambem uma editoria e uma consulta de imagem segura para buscar foto relacionada.

Dados internos para analise, nao para aparecer no texto:
Fontes detectadas: ${(item.evidenceSources || [item.source]).join(", ")}
Sinal de tendencia interno: ${item.trendBoost ? `sim (${item.trendMatches?.join(", ")})` : "nao detectado"}
Quantidade de fontes: ${item.sourceCount || item.evidenceSources?.length || 1}

Titulo: ${item.title}
Resumo RSS: ${item.summary}
Link da fonte: ${item.link}
`;

  try {
    const parsed = await requestOpenAIJson(
      [
        {
          role: "system",
          content:
            "Voce e um editor brasileiro de entretenimento. Escreva apenas para leitor final e retorne JSON valido.",
        },
        {
          role: "user",
          content: `${prompt}\nRetorne apenas JSON neste formato: {"title":"...","excerpt":"...","category":"...","html":"<p>...</p>","tags":["..."],"imageSearchQuery":"...","imageAlt":"...","editorialDecision":"...","riskNotes":["..."]}`,
        },
      ],
      4500,
    );

    const article = articleFromParsed(item, parsed, "openai-draft");
    const issues = validateArticle(article, item);
    if (!issues.length) return article;

    const repaired = await repairArticleWithAI(item, article, issues);
    const repairIssues = validateArticle(repaired, item);
    if (!repairIssues.length) return repaired;

    return {
      ...localArticle(item),
      editorialMeta: {
        ...localArticle(item).editorialMeta,
        generationMode: "local-fallback-after-openai-review",
        riskNotes: repairIssues,
      },
    };
  } catch (error) {
    const fallback = localArticle(item);
    return {
      ...fallback,
      editorialMeta: {
        ...fallback.editorialMeta,
        generationMode: "local-fallback-openai-error",
        riskNotes: [error.message || String(error)],
      },
    };
  }
}

export async function generateArticles(news) {
  const limit = Number(process.env.POSTS_PER_RUN || 10);
  const articles = [];
  const maxInternational = maxInternationalFor(limit);
  let internationalCount = 0;

  for (const item of news) {
    if (articles.length >= limit) break;

    const itemMarket = classifyMarket(item);
    if (itemMarket === "internacional" && internationalCount >= maxInternational) continue;

    const article = await aiArticle(item);
    const articleMarket = classifyMarket(article);
    if (articleMarket === "internacional" && internationalCount >= maxInternational) continue;

    article.market = articleMarket;
    article.editorialMeta = {
      ...(article.editorialMeta || {}),
      market: articleMarket,
    };

    const issues = validateArticle(article, item);
    if (issues.length) {
      console.warn(`Materia rejeitada antes da publicacao: ${item.title}`);
      for (const issue of issues) console.warn(`- ${issue}`);
      continue;
    }

    articles.push(article);
    if (articleMarket === "internacional") internationalCount += 1;
  }

  if (!articles.length) {
    throw new Error("Nenhuma materia passou pela validacao editorial.");
  }

  if (articles.length < limit) {
    throw new Error(`A rodada gerou ${articles.length}/${limit} materias publicaveis. Aumente MAX_ITEMS, revise filtros ou rode novamente.`);
  }

  return articles;
}

export function toBuzzItems(articles) {
  return articles.map((article, index) => ({
    id: article.id || String(index + 1),
    slug: article.slug || slugify(article.title),
    category: article.category || "Entretenimento",
    title: article.title,
    excerpt: article.excerpt,
    body: article.body?.length ? article.body : [article.excerpt],
    image: article.image || "/images/news-placeholder.svg",
    imagePosition: "center center",
    articleImagePosition: "center center",
    imageCredit: article.imageCredit || "Imagem: BuzzPop Brasil",
    sourceLabel: `Origem: ${article.source}`,
    sourceUrl: article.sourceUrl,
    sources: (article.evidenceSources || [article.source]).slice(0, 5).map((source) => ({
      label: source,
      url: article.sourceUrl,
    })),
    rankLabel: `${article.sourceCount || 1} fontes verificadas${article.trendBoost ? " + Google Trends" : ""}`,
    publishedAt: formatDate(article.createdAt),
    timeAgo: "Radar ao vivo",
    score: article.score,
    sourceCount: article.sourceCount,
    trendBoost: article.trendBoost,
    trendMatches: article.trendMatches || [],
  }));
}
