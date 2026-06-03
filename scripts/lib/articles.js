function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
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
  /\bescolhido porque\b/i,
  /\bmesa autom[aá]tica\b/i,
  /\bradar verificado\b/i,
  /\bradar de cultura pop\b/i,
  /\bGoogle Trends\b/i,
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

function validateArticle(article, item) {
  const issues = [];
  const publicText = [article.title, article.excerpt, ...(article.body || [])].join(" ");
  if (hasInternalPublicCopy(publicText)) issues.push("linguagem interna ou bastidor editorial");
  if (titleLooksCopied(item.title, article.title)) issues.push("titulo parecido demais com o titulo do RSS");
  if ((article.body || []).length < 5) issues.push("corpo curto demais");
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
  if (/novela|ibope|audi[eê]ncia|reality|casa do patr[aã]o|tv|televis[aã]o/.test(text)) {
    return "Televisao";
  }
  if (/filme|cinema|bilheteria|ator|atriz|he-man/.test(text)) return "Cinema";
  if (/netflix|streaming|s[eé]rie/.test(text)) return "Streaming";
  if (/m[uú]sica|cantor|cantora|show|chico|caetano|xuxa/.test(text)) return "Musica";
  if (/virginia|leonardo|famos/.test(text)) return "Famosos";
  return "Entretenimento";
}

function referencesNote(item) {
  const sources = item.evidenceSources?.slice(0, 5).join(", ") || item.source;
  return `<p class="article-sources"><strong>Referencias consultadas:</strong> ${sources}. <a href="${item.link}" rel="nofollow noopener" target="_blank">Publicacao original</a></p>`;
}

async function requestOpenAIJson(messages, maxTokens = 1800) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
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
    html: `${parsed.html || fallback.html}${referencesNote(item)}`,
    body: body.length ? body : fallback.body,
    tags: Array.isArray(parsed.tags) ? parsed.tags : fallback.tags,
    imageSearchQuery: parsed.imageSearchQuery || fallback.imageSearchQuery,
    imageAlt: parsed.imageAlt || parsed.title || fallback.imageAlt,
    editorialMeta: {
      ...fallback.editorialMeta,
      generationMode,
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
    1800,
  );

  return articleFromParsed(item, parsed, "openai-repair");
}

function publicFallbackTitle(item) {
  const subject = subjectName(item);
  const category = categoryFor(item);
  if (category === "Televisao") return `${subject} ganha novo capitulo na TV`;
  if (category === "Cinema") return `${subject} movimenta debate no cinema`;
  if (category === "Streaming") return `${subject} vira destaque no streaming`;
  if (category === "Musica") return `${subject} repercute entre nomes da musica`;
  if (category === "Famosos") return `${subject} volta aos holofotes entre famosos`;
  return `${subject} repercute no entretenimento`;
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
      sourceCount: item.sourceCount,
      evidenceSources: item.evidenceSources || [item.source],
      trendBoost: item.trendBoost,
      trendMatches: item.trendMatches || [],
      generationMode: "local-fallback",
    },
    createdAt: new Date().toISOString(),
  };
}

async function aiArticle(item) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || process.env.USE_OPENAI_FOR_POSTS !== "true") return localArticle(item);

  const prompt = `
Analise os dados abaixo e escreva uma materia jornalistica de entretenimento para leitor final.

Regras obrigatorias:
- A materia NAO pode mencionar curadoria, selecao, sistema, ranking, radar, Google Trends, algoritmo, mesa automatica, "foi escolhido porque" ou bastidor editorial.
- Nao copie frases das fontes.
- O titulo gerado precisa ser novo. Nao repita nem parafraseie de perto o titulo RSS.
- Use apenas fatos presentes nos dados fornecidos. Se faltar detalhe, escreva com cautela.
- Separe fato publicado de especulacao. Nao invente fala, data, valor, acusacao ou bastidor.
- O corpo deve ter pelo menos 6 paragrafos, 350 palavras e 2200 caracteres quando houver informacao suficiente.
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
      1800,
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
  const limit = Number(process.env.POSTS_PER_RUN || 6);
  const selected = news.slice(0, limit);
  const articles = [];

  for (const item of selected) {
    articles.push(await aiArticle(item));
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
    imageCredit: article.imageCredit || "Imagem: BuzzNews",
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
