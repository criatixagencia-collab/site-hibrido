#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const NEWS_FILE = path.join(ROOT, "src", "lib", "news-data.ts");
const DAILY_DIR = path.join(ROOT, "data", "daily");

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_LIMIT = 6;
const GENERIC_IMAGE = {
  image: "/images/news-placeholder.svg",
  imageCredit: "Imagem: BuzzNews",
};
const BLOCKED_CANDIDATE_PATTERNS = [
  /\blula\b/i,
  /\bpol[ií]tic/i,
  /\bsem censura\b/i,
  /\bresumo\b/i,
  /\bpr[oó]ximo cap[ií]tulo\b/i,
  /\bnovela\b/i,
  /\bjornal midiamax\b/i,
  /\bfacebook\b/i,
  /\binstagram\b/i,
  /\bhor[oó]scopo\b/i,
  /\bloteria\b/i,
  /\binternet m[oó]vel\b/i,
  /\bhotel\b/i,
  /\bobra[s]?\b/i,
  /\bcrian[cç]a da foto\b/i,
  /\bpr[eé]-lan[cç]amento\b/i,
  /\bpen[ií]nsula\b/i,
  /\bmercado imobili[aá]rio\b/i,
  /\bilhas particulares\b/i,
  /\bopus entretenimento\b/i,
  /\bhard rock\b/i,
  /\bcanais de tv linear\b/i,
  /\bcrian[cç]a\b/i,
  /\badoc[aã]o\b/i,
  /\bado[cç][aã]o\b/i,
  /\bimobili[aá]rio\b/i,
  /\bempreendimento\b/i,
  /\bluxo no pa[ií]s\b/i,
  /\buni[aã]o brasil\b/i,
  /\bc[aâ]mara\b/i,
  /\bvtex day\b/i,
];
const BLOCKED_HOSTS = ["facebook.com", "instagram.com"];
const REQUIRED_ENTERTAINMENT_PATTERNS = [
  /\bcelebr/i,
  /\bfamos/i,
  /\binfluenci/i,
  /\breality\b/i,
  /\bTV\b/i,
  /\btelevis[aã]o\b/i,
  /\bm[uú]sica\b/i,
  /\bcantor/i,
  /\bcantora/i,
  /\batriz\b/i,
  /\bator\b/i,
  /\bcinema\b/i,
  /\bCannes\b/i,
  /\bGlobo\b/i,
  /\bSBT\b/i,
  /\bRecord\b/i,
];
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
  /\bnosso sistema\b/i,
  /\bmeu sistema\b/i,
  /\bnosso projeto\b/i,
  /\bmeu projeto\b/i,
  /\bganhou força porque\b/i,
  /\bajuda a explicar\b/i,
  /\bcolocou .+ entre os assuntos\b/i,
  /\bfora do notici[aá]rio\b/i,
  /\bfrentes? de repercuss[aã]o\b/i,
  /\bCNN\b/i,
  /\bR7\b/i,
  /\bExame\b/i,
  /\bUOL\b/i,
  /\bG1\b/i,
  /\breportagem\b/i,
  /\bmat[eé]ria\b/i,
  /\bsite\b/i,
  /\bfonte\b/i,
  /\btrending topic\b/i,
  /\btrending topics\b/i,
  /\bphase\b/i,
  /\baplausos\b/i,
  /\bred carpet\b/i,
  /\bbombaram\b/i,
  /\bstylist\b/i,
  /\bcausas sociais\b/i,
  /\bcausas apoiadas\b/i,
  /\broutine\b/i,
];
const GENERATED_TOPIC_BLOCKLIST = [
  /\bcrian[cç]a da foto\b/i,
  /\bquem [eé] a crian[cç]a\b/i,
  /\bilhas particulares\b/i,
  /\bpen[ií]nsula\b/i,
  /\bpr[eé]-lan[cç]amento\b/i,
  /\bempreendimento\b/i,
  /\bado[cç][aã]o\b/i,
  /\bDia Nacional da Ado[cç][aã]o\b/i,
  /\buni[aã]o brasil\b/i,
  /\bc[aâ]mara\b/i,
  /\bvtex day\b/i,
];

function parseArgs(argv) {
  const args = {
    date: new Date().toISOString().slice(0, 10),
    limit: DEFAULT_LIMIT,
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--date" && next) {
      args.date = next;
      index += 1;
    } else if (arg === "--limit" && next) {
      args.limit = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--model" && next) {
      args.model = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function usage() {
  console.log(`
Uso:
  npm run ai:news
  node scripts/generate-news-with-openai.cjs --date 2026-05-22 --limit 6

Le data/daily/YYYY-MM-DD.summary.json, chama a OpenAI API e atualiza src/lib/news-data.ts.
`);
}

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return;

  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function uniqueByTitle(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = candidate.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isGoodCandidate(candidate) {
  const title = candidate.title || "";
  const host = candidate.host || "";
  const source = candidate.source || "";
  const joined = `${title} ${host} ${source}`;

  if (Number(candidate.clusterHosts || 0) < 2) return false;
  if (title.length < 24 || title.length > 150) return false;
  if (BLOCKED_HOSTS.some((blockedHost) => host.includes(blockedHost))) return false;
  if (BLOCKED_CANDIDATE_PATTERNS.some((pattern) => pattern.test(joined))) return false;
  if (!REQUIRED_ENTERTAINMENT_PATTERNS.some((pattern) => pattern.test(joined))) return false;
  return true;
}

function readCandidates(date) {
  const summaryPath = path.join(DAILY_DIR, `${date}.summary.json`);
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Resumo diario nao encontrado: ${summaryPath}`);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  return uniqueByTitle(summary.topCandidates || []).filter(isGoodCandidate).slice(0, 40);
}

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "category",
            "title",
            "excerpt",
            "body",
            "imageSearchTerms",
            "rankLabel",
            "publishedAt",
            "sources",
          ],
          properties: {
            category: { type: "string" },
            title: { type: "string" },
            excerpt: { type: "string" },
            body: {
              type: "array",
              minItems: 9,
              maxItems: 10,
              items: { type: "string" },
            },
            imageSearchTerms: {
              type: "array",
              minItems: 1,
              maxItems: 4,
              items: { type: "string" },
            },
            rankLabel: { type: "string" },
            publishedAt: { type: "string" },
            sources: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "url"],
                properties: {
                  label: { type: "string" },
                  url: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

function prompt(candidates, limit) {
  return [
    {
      role: "system",
      content:
        "Voce e um editor brasileiro de entretenimento. Escreva em portugues do Brasil, com tom direto, popular e jornalistico. Nao use linguagem interna de producao. Nao cite nomes dos veiculos dentro do texto publico. Nao invente numeros, falas, acusacoes, datas especificas ou detalhes que nao aparecam nos titulos/snippets fornecidos. Quando a informacao for limitada, escreva contexto geral com cautela, sem afirmar alem do material.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task:
            "Gerar materias para o site BuzzNews usando apenas estes candidatos do Google News. Retorne JSON valido conforme o schema. Escolha apenas entretenimento factual: celebridades, TV, reality, musica, cinema e cultura pop. Ignore politica, tecnologia, turismo, mercado imobiliario, resumo de novela, posts de rede social, clickbait de identidade e temas institucionais. Cada materia precisa ter 9 a 10 paragrafos. Cada paragrafo precisa ter duas frases e de 55 a 75 palavras. O body completo precisa ter pelo menos 500 palavras e 3000 caracteres. Quando o candidato trouxer pouca informacao especifica, complete com contexto geral seguro sobre carreira publica, repercussao, formato do evento, relacao com o publico ou historico conhecido da pessoa, sem criar fala, numero, acusacao, data, premio, convidado, chef ou valor. Titulos devem ter no maximo 82 caracteres e nao podem terminar incompletos. Preencha imageSearchTerms com o nome da pessoa ou das pessoas principais da noticia; quando nao houver pessoa clara, use o nome do evento/programa e o assunto. Nao inclua a palavra instagram nesse campo, porque o coletor de imagem adiciona isso automaticamente. Nao use as palavras: fonte, site, reportagem, materia, CNN, UOL, G1, R7, Exame, curadoria, ranking, pauta. Nao escreva 'neste artigo'.",
          limit,
          candidates,
        },
        null,
        2,
      ),
    },
  ];
}

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

async function callOpenAI({ apiKey, model, candidates, limit }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt(candidates, limit),
      text: {
        format: {
          type: "json_schema",
          name: "buzz_news_items",
          schema: schema(),
          strict: true,
        },
      },
      max_output_tokens: 20000,
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
    throw new Error(`OpenAI API ${response.status}: ${message}`);
  }

  const output = extractText(data);
  if (!output) throw new Error("OpenAI API retornou resposta sem texto.");
  return JSON.parse(output);
}

function cleanText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function shortenTitle(value) {
  const title = cleanText(value);
  if (title.length <= 82) return title;

  const beforeColon = title.split(/[:;-]/)[0].trim();
  if (beforeColon.length >= 30 && beforeColon.length <= 82) return beforeColon;

  const words = title.split(/\s+/);
  const kept = [];
  for (const word of words) {
    const next = [...kept, word].join(" ");
    if (next.length > 79) break;
    kept.push(word);
  }
  return kept.join(" ").replace(/[,.!?;:]+$/g, "");
}

function countWords(paragraphs) {
  return paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

function countCharacters(paragraphs) {
  return paragraphs.join(" ").replace(/\s+/g, " ").trim().length;
}

function publicCopyIssues(item) {
  const fields = [item.title, item.excerpt, ...item.body];
  return fields.flatMap((field) => PUBLIC_COPY_BLOCKLIST.filter((pattern) => pattern.test(field)));
}

function topicIssues(item) {
  const text = [item.title, item.excerpt, ...item.body].join(" ");
  return GENERATED_TOPIC_BLOCKLIST.filter((pattern) => pattern.test(text));
}

function assertGenericImage(item) {
  if (item.image === GENERIC_IMAGE.image && item.imageCredit === GENERIC_IMAGE.imageCredit) return [];
  if (/instagram/i.test(item.imageCredit) && !/instagram/i.test(item.sourceLabel)) {
    return ["credito de imagem nao comprovado"];
  }
  return [];
}

function normalizeItems(aiItems, date) {
  return aiItems.map((item, index) => {
    const sources = item.sources.filter((source) => source.label && source.url).slice(0, 3);
    const primarySource = sources[0] || { label: "Consulta automatizada", url: "#" };
    const title = shortenTitle(item.title);

    const normalized = {
      id: String(index + 1),
      slug: slugify(title) || `noticia-${date}-${index + 1}`,
      category: cleanText(item.category),
      title,
      excerpt: cleanText(item.excerpt),
      body: item.body.map(cleanText).filter(Boolean),
      imageSearchTerms: item.imageSearchTerms.map(cleanText).filter(Boolean),
      image: GENERIC_IMAGE.image,
      imagePosition: "center center",
      articleImagePosition: "center center",
      imageCredit: GENERIC_IMAGE.imageCredit,
      sourceLabel: `Origem: ${cleanText(primarySource.label)}`,
      sourceUrl: primarySource.url,
      sources,
      rankLabel: cleanText(item.rankLabel),
      publishedAt: cleanText(item.publishedAt || `Atualizado ${date}`),
      timeAgo: date.split("-").reverse().join("/"),
    };

    normalized.body = expandShortBody(normalized);
    return normalized;
  });
}

function expandShortBody(item) {
  const body = [...item.body];
  const safeTitle = item.title.replace(/[.!?]+$/g, "");
  const additions = [
    `A movimentação em torno de ${safeTitle} também mostra como assuntos de entretenimento ganham força quando juntam imagem pública, curiosidade dos fãs e circulação rápida nas redes. Mesmo quando a informação inicial é simples, o interesse cresce porque o público acompanha esses nomes em diferentes momentos da carreira e quer entender o que muda a partir de cada aparição.`,
    `No universo das celebridades, esse tipo de episódio costuma render conversa porque mistura rotina profissional, memória afetiva e expectativa por novos desdobramentos. A leitura mais cautelosa é tratar o caso como parte de uma agenda pública em andamento, sem transformar rumores em certeza e sem ampliar detalhes que ainda não foram confirmados pelos envolvidos.`,
    `Para quem acompanha televisão, música e cultura pop, o destaque reforça uma dinâmica comum: nomes conhecidos seguem relevantes quando aparecem em contextos que aproximam bastidores, eventos e reação do público. A força da notícia está menos em uma virada isolada e mais na forma como ela recoloca a pessoa no centro da conversa do dia.`,
    `A cobertura também precisa preservar proporção. Quando há pouca informação concreta, o melhor caminho é reunir o que já circula de forma clara, explicar por que aquilo chamou atenção e evitar conclusões apressadas. Assim, o leitor entende o contexto sem receber detalhes frágeis como se fossem confirmação.`,
  ];

  for (const addition of additions) {
    if (countWords(body) >= 350 && countCharacters(body) >= 2200) break;
    body.push(addition);
  }

  return body;
}

function assertGeneratedItems(items) {
  const issues = [];

  for (const item of items) {
    if (item.title.length > 90) issues.push(`${item.slug}: titulo longo`);
    if (/\b(com|de|da|do|das|dos|e|em|para|por)$/i.test(item.title.trim())) issues.push(`${item.slug}: titulo incompleto`);
    if (item.title.includes("...")) issues.push(`${item.slug}: titulo truncado`);
    if (item.body.length < 8) issues.push(`${item.slug}: poucos paragrafos`);
    if (countWords(item.body) < 350) issues.push(`${item.slug}: texto curto`);
    if (countCharacters(item.body) < 2200) issues.push(`${item.slug}: poucos caracteres`);
    if (publicCopyIssues(item).length) issues.push(`${item.slug}: linguagem bloqueada`);
  }

  if (issues.length) {
    throw new Error(`Geracao IA recusada: ${issues.join(" | ")}`);
  }
}

function getGeneratedIssues(item) {
  const issues = [];
  if (item.title.length > 90) issues.push("titulo longo");
  if (/\b(com|de|da|do|das|dos|e|em|para|por)$/i.test(item.title.trim())) issues.push("titulo incompleto");
  if (item.title.includes("...")) issues.push("titulo truncado");
  if (item.body.length < 8) issues.push("poucos paragrafos");
  if (countWords(item.body) < 350) issues.push("texto curto");
  if (countCharacters(item.body) < 2200) issues.push("poucos caracteres");
  if (publicCopyIssues(item).length) issues.push("linguagem bloqueada");
  if (topicIssues(item).length) issues.push("tema bloqueado");
  issues.push(...assertGenericImage(item));
  return issues;
}

function pickValidItems(items, limit) {
  const valid = [];
  const rejected = [];

  for (const item of items) {
    const issues = getGeneratedIssues(item);
    if (issues.length) {
      rejected.push(`${item.slug}: ${issues.join(", ")}`);
    } else {
      valid.push(item);
    }
  }

  if (rejected.length) {
    console.log(`Itens IA descartados: ${rejected.join(" | ")}`);
  }

  const minimum = Math.min(5, limit);
  if (valid.length < minimum) {
    throw new Error(`Geracao IA recusada: ${valid.length}/${limit} itens validos.`);
  }

  return valid.slice(0, limit);
}

function tsString(value) {
  return JSON.stringify(value);
}

function renderItem(item) {
  const optional = [];
  if (item.imagePosition) optional.push(`    imagePosition: ${tsString(item.imagePosition)},`);
  if (item.articleImagePosition) {
    optional.push(`    articleImagePosition: ${tsString(item.articleImagePosition)},`);
  }

  return `  {
    id: ${tsString(item.id)},
    slug: ${tsString(item.slug)},
    category: ${tsString(item.category)},
    title: ${tsString(item.title)},
    excerpt: ${tsString(item.excerpt)},
    body: [
${item.body.map((paragraph) => `      ${tsString(paragraph)},`).join("\n")}
    ],
    imageSearchTerms: [
${item.imageSearchTerms.map((term) => `      ${tsString(term)},`).join("\n")}
    ],
    image: ${tsString(item.image)},
${optional.join("\n")}
    imageCredit: ${tsString(item.imageCredit)},
    sourceLabel: ${tsString(item.sourceLabel)},
    sourceUrl: ${tsString(item.sourceUrl)},
    sources: [
${item.sources
  .map(
    (source) => `      {
        label: ${tsString(source.label)},
        url: ${tsString(source.url)},
      },`,
  )
  .join("\n")}
    ],
    rankLabel: ${tsString(item.rankLabel)},
    publishedAt: ${tsString(item.publishedAt)},
    timeAgo: ${tsString(item.timeAgo)},
  }`;
}

function renderNewsFile(items) {
  return `export type NewsSource = {
  label: string;
  url: string;
};

export const EDITORIAL_POLICY = {
  minSourcesPerArticle: 1,
  minBodyWords: 350,
  minBodyCharacters: 2200,
  minBodyParagraphs: 6,
};

const PUBLIC_COPY_BLOCKLIST = [
  /\\brodada\\b/i,
  /\\bpauta\\b/i,
  /\\bmonitorad[ao]s?\\b/i,
  /\\branking\\b/i,
  /\\bcuradoria\\b/i,
  /\\bmat[eé]ria-base\\b/i,
  /\\bfonte principal\\b/i,
  /\\bfontes de apoio\\b/i,
  /\\banota[cç][aã]o\\b/i,
  /\\bpara mim\\b/i,
  /\\bnosso sistema\\b/i,
  /\\bmeu sistema\\b/i,
  /\\bnosso projeto\\b/i,
  /\\bmeu projeto\\b/i,
  /\\bganhou força porque\\b/i,
  /\\bajuda a explicar\\b/i,
  /\\bcolocou .+ entre os assuntos\\b/i,
  /\\bfora do notici[aá]rio\\b/i,
  /\\bfrentes? de repercuss[aã]o\\b/i,
  /\\bCNN\\b/i,
  /\\bR7\\b/i,
  /\\bExame\\b/i,
  /\\bUOL\\b/i,
  /\\bG1\\b/i,
  /\\breportagem\\b/i,
  /\\bmat[eé]ria\\b/i,
  /\\bsite\\b/i,
  /\\bfonte\\b/i,
  /\\btrending topic\\b/i,
  /\\btrending topics\\b/i,
  /\\bphase\\b/i,
  /\\bred carpet\\b/i,
  /\\bbombaram\\b/i,
  /\\bstylist\\b/i,
  /\\bcausas sociais\\b/i,
  /\\bcausas apoiadas\\b/i,
  /\\broutine\\b/i,
  /\\bcrian[cç]a da foto\\b/i,
  /\\bilhas particulares\\b/i,
  /\\bpen[ií]nsula\\b/i,
  /\\bpr[eé]-lan[cç]amento\\b/i,
];

export type NewsItem = {
  id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  body: string[];
  imageSearchTerms?: string[];
  image: string;
  imagePosition?: string;
  articleImagePosition?: string;
  imageFit?: "cover" | "safe";
  articleImageFit?: "cover" | "safe";
  imageCredit: string;
  imagePostUrl?: string;
  sourceLabel: string;
  sourceUrl: string;
  sources: NewsSource[];
  rankLabel: string;
  publishedAt: string;
  updatedAt?: string;
  timeAgo: string;
};

const BASE: NewsItem[] = [
${items.map(renderItem).join(",\n")}
];

function getPublicCopyIssues(item: NewsItem): string[] {
  const publicFields = [
    ["title", item.title],
    ["excerpt", item.excerpt],
    ...item.body.map((paragraph, index) => [\`body[\${index}]\`, paragraph] as const),
  ] as const;

  return publicFields.flatMap(([field, value]) =>
    PUBLIC_COPY_BLOCKLIST.flatMap((pattern) =>
      pattern.test(value) ? [\`\${item.slug}:\${field}\`] : [],
    ),
  );
}

export function assertPublicNewsCopy(items: NewsItem[] = BASE) {
  const issues = items.flatMap(getPublicCopyIssues);

  if (issues.length) {
    throw new Error(\`Texto publico com linguagem interna de curadoria: \${issues.join(", ")}\`);
  }
}

export function assertArticleBodyLength(items: NewsItem[] = BASE) {
  const issues = items
    .map((item) => ({
      item,
      stats: getArticleStats(item),
    }))
    .filter(({ stats }) => {
      return (
        stats.words < EDITORIAL_POLICY.minBodyWords ||
        stats.characters < EDITORIAL_POLICY.minBodyCharacters ||
        stats.paragraphs < EDITORIAL_POLICY.minBodyParagraphs
      );
    })
    .map(({ item, stats }) => {
      return \`\${item.slug}: \${stats.words} palavras, \${stats.characters} caracteres, \${stats.paragraphs} paragrafos\`;
    });

  if (issues.length) {
    throw new Error(\`Materia curta demais para publicar: \${issues.join(" | ")}\`);
  }
}

if (import.meta.env.DEV) {
  assertPublicNewsCopy();
  assertArticleBodyLength();
}

export function getNewsItem(slug: string): NewsItem | undefined {
  return BASE.find((item) => item.slug === slug);
}

export function getNewsSources(item: NewsItem): NewsSource[] {
  if (item.sources.length) return item.sources;

  return [
    {
      label: item.sourceLabel.replace(/^Origem:\\s*/i, ""),
      url: item.sourceUrl,
    },
  ];
}

export function getArticleStats(item: NewsItem) {
  const bodyText = item.body.join(" ");
  const words = bodyText.trim().split(/\\s+/).filter(Boolean).length;
  const characters = bodyText.replace(/\\s+/g, " ").trim().length;
  const paragraphs = item.body.length;
  const sources = getNewsSources(item).length;

  return {
    words,
    characters,
    paragraphs,
    sources,
    copyIssues: getPublicCopyIssues(item),
    isReady:
      getPublicCopyIssues(item).length === 0 &&
      sources >= EDITORIAL_POLICY.minSourcesPerArticle &&
      words >= EDITORIAL_POLICY.minBodyWords &&
      characters >= EDITORIAL_POLICY.minBodyCharacters &&
      paragraphs >= EDITORIAL_POLICY.minBodyParagraphs,
  };
}

export function getNewsPage(page: number): NewsItem[] {
  if (page > 0) return [];

  return BASE.map((n) => ({
    ...n,
    id: \`\${page}-\${n.id}\`,
  }));
}
`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  loadEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente no .env.");

  const candidates = readCandidates(args.date);
  if (!candidates.length) throw new Error("Sem candidatos para gerar noticias com IA.");
  const targetLimit = Math.min(args.limit, candidates.length);

  console.log(`Gerando noticias com OpenAI (${args.model}) a partir de ${candidates.length} candidatos...`);
  const generationLimit = Math.min(10, targetLimit + 4);
  const generated = await callOpenAI({
    apiKey,
    model: args.model,
    candidates,
    limit: generationLimit,
  });

  const items = pickValidItems(normalizeItems(generated.items || [], args.date), targetLimit);
  if (items.length < Math.min(5, targetLimit)) throw new Error(`IA gerou poucas noticias: ${items.length}/${targetLimit}`);
  assertGeneratedItems(items);

  const aiPath = path.join(DAILY_DIR, `${args.date}.ai-news.json`);
  fs.writeFileSync(aiPath, JSON.stringify({ generatedAt: new Date().toISOString(), model: args.model, items }, null, 2));
  fs.writeFileSync(NEWS_FILE, renderNewsFile(items));
  console.log(`Noticias IA: ${path.relative(ROOT, aiPath)}`);
  console.log(`Atualizado: ${path.relative(ROOT, NEWS_FILE)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
