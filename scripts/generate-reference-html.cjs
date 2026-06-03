const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const newsPath = path.join(root, "data", "news.json");
const articlesPath = path.join(root, "data", "articles.json");
const outputPath = path.join(root, "public", "site-hoje-referencia.html");

const blockedSubjects = [
  /melhem/i,
  /processa/i,
  /acus/i,
  /pris[aã]o/i,
  /crime/i,
  /pol[ií]tica/i,
  /bolsonaro/i,
  /lula/i,
  /stf/i,
];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function cleanSummary(value = "", title = "") {
  const titleStart = title.slice(0, 42).toLowerCase();
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith(titleStart))
    .map((line) =>
      line
        .replace(/\s+(UOL|O Globo|CNN Brasil|Not[ií]cias da TV|Omelete|Folha de S\.Paulo|R7 Entretenimento|TudoCelular\.com|MJ Beats)$/i, "")
        .trim(),
    )
    .find(Boolean) || title;
}

function formatDate(value, mode = "short") {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "03 jun";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: mode === "long" ? "long" : "short",
    hour: mode === "long" ? "2-digit" : undefined,
    minute: mode === "long" ? "2-digit" : undefined,
  }).format(date);
}

function titleCase(value) {
  return String(value || "")
    .replace(/\s+-\s+.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryFor(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/novela|ibope|audi[eê]ncia|cora[cç][aã]o|quem ama cuida|casa do patr[aã]o/.test(text)) return "TV";
  if (/filme|cinema|bilheteria|he-man|ator|atriz/.test(text)) return "Cinema";
  if (/netflix|streaming|s[eé]rie/.test(text)) return "Streaming";
  if (/m[uú]sica|cantor|cantora|show|xuxa|chico|caetano/.test(text)) return "Musica";
  if (/virginia|leonardo|famos/.test(text)) return "Famosos";
  return "Pop";
}

function sourceList(item) {
  return (item.evidenceSources || item.sources?.map((source) => source.label) || [item.source])
    .filter(Boolean)
    .slice(0, 5);
}

function imageFor(item) {
  return item.image || item.imageUrl || "/images/news-placeholder.svg";
}

function selectNews(items) {
  const today = "2026-06-03";
  return items
    .filter((item) => item.sourceCount >= 3)
    .filter((item) => String(item.publishedAt || "").startsWith(today))
    .filter((item) => !blockedSubjects.some((pattern) => pattern.test(`${item.title} ${item.summary}`)))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 6);
}

function selectArticlesForNews(news, articles) {
  const ids = new Set(news.map((item) => item.id));
  const titles = new Set(news.map((item) => titleCase(item.title).toLowerCase()));
  const selected = articles.filter((article) => {
    if (ids.has(article.id)) return true;
    return titles.has(titleCase(article.title).toLowerCase());
  });

  return selected.length ? selected : articles.slice(0, 6);
}

function renderHero(lead) {
  if (!lead) {
    return `<div class="hero-card"><span class="label">Sem destaque</span></div>`;
  }
  return `<div class="hero-card">
    <span class="label">Destaque aprovado</span>
    <a class="lead-image" href="${escapeHtml(lead.link || lead.sourceUrl)}" target="_blank" rel="noopener">
      <img src="${escapeHtml(imageFor(lead))}" alt="${escapeHtml(lead.title)}" loading="eager">
    </a>
    <h2>${escapeHtml(titleCase(lead.title))}</h2>
    <div class="lead-proof">
      <span>${escapeHtml(lead.sourceCount || sourceList(lead).length)} fontes</span>
      ${lead.score ? `<span>forca ${escapeHtml(lead.score)}</span>` : ""}
      ${lead.trendBoost ? "<span>Google Trends</span>" : ""}
    </div>
    <p>${escapeHtml(sourceList(lead).join(" / "))}</p>
  </div>`;
}

function renderNewsItem(item, index) {
  const sources = sourceList(item);
  return `<article class="news-item">
    <div class="rank">${index + 1}</div>
    <div>
      <a class="news-thumb" href="${escapeHtml(item.link || item.sourceUrl)}" target="_blank" rel="noopener">
        <img src="${escapeHtml(imageFor(item))}" alt="${escapeHtml(item.title)}" loading="lazy">
      </a>
      <h3><a href="${escapeHtml(item.link || item.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(titleCase(item.title))}</a></h3>
      <div class="meta">
        <span class="pill strong">${escapeHtml(item.sourceCount || sources.length)} fontes</span>
        ${item.trendBoost ? '<span class="pill trend">Google Trends</span>' : ""}
        <span class="pill">${escapeHtml(formatDate(item.publishedAt))}</span>
        ${item.score ? `<span class="pill">forca ${escapeHtml(item.score)}</span>` : ""}
      </div>
      <div class="source-strip">
        ${sources.map((source) => `<span>${escapeHtml(source)}</span>`).join("")}
      </div>
      <p class="summary">${escapeHtml(cleanSummary(item.summary, item.title))}</p>
    </div>
  </article>`;
}

function renderArticle(item) {
  const title = titleCase(item.title);
  const body = item.body?.length ? item.body : [cleanSummary(item.html || item.excerpt, item.title)];
  const sources = sourceList(item);
  return `<article class="article-item">
    <a class="article-thumb" href="${escapeHtml(item.link || item.sourceUrl)}" target="_blank" rel="noopener">
      <img src="${escapeHtml(imageFor(item))}" alt="${escapeHtml(title)}" loading="lazy">
    </a>
    <p class="kicker">${escapeHtml(categoryFor(item))}</p>
    <h3>${escapeHtml(title)}</h3>
    <p class="summary lead-summary">${escapeHtml(cleanSummary(item.summary || item.excerpt, item.title))}</p>
    <details>
      <summary>Ler materia</summary>
      <div class="story-body">
        ${body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </div>
    </details>
    <div class="source-strip compact">
      ${sources.map((source) => `<span>${escapeHtml(source)}</span>`).join("")}
    </div>
  </article>`;
}

function renderHtml(news, articles) {
  const lead = news[0];
  const trendCount = news.filter((item) => item.trendBoost).length;
  const sourceAverage = news.length
    ? news.reduce((total, item) => total + (item.sourceCount || sourceList(item).length || 1), 0) / news.length
    : 0;
  const articleItems = selectArticlesForNews(news, articles);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Radar Pop Verificado - Teste Visual</title>
    <style>
      :root {
        --ink: oklch(17% 0.02 55);
        --muted: oklch(45% 0.03 55);
        --paper: oklch(96% 0.015 71);
        --surface: oklch(99% 0.01 71);
        --wash: oklch(91% 0.035 76);
        --line: oklch(82% 0.025 70);
        --accent: oklch(51% 0.18 29);
        --accent-dark: oklch(34% 0.14 29);
        --trend: oklch(58% 0.14 155);
        --gold: oklch(73% 0.14 82);
        --space-sm: 8px;
        --space-md: 12px;
        --space-lg: 16px;
        --space-xl: 24px;
        --space-2xl: 32px;
        --space-3xl: 48px;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          linear-gradient(90deg, color-mix(in oklch, var(--line), transparent 58%) 0 1px, transparent 1px 100%) 0 0 / 48px 48px,
          var(--paper);
        color: var(--ink);
        font-family: Avenir Next, Avenir, Trebuchet MS, sans-serif;
      }
      h1, h2, h3, p { margin: 0; }
      .topbar {
        display: grid;
        gap: var(--space-2xl);
        padding: clamp(24px, 5vw, 64px);
        background: linear-gradient(135deg, color-mix(in oklch, var(--ink), transparent 0%), color-mix(in oklch, var(--accent-dark), var(--ink) 42%));
        color: var(--paper);
      }
      .brand-line {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        align-items: center;
        justify-content: space-between;
        color: color-mix(in oklch, var(--paper), transparent 26%);
        font-size: .78rem;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .hero-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(300px, .55fr);
        gap: var(--space-2xl);
        align-items: end;
      }
      h1 {
        max-width: 960px;
        font-family: Georgia, Times New Roman, serif;
        font-size: clamp(3rem, 7vw, 7rem);
        line-height: .9;
        letter-spacing: 0;
      }
      h2 {
        font-family: Georgia, Times New Roman, serif;
        font-size: clamp(1.45rem, 2.4vw, 2.4rem);
        line-height: 1.02;
      }
      h3 {
        font-size: 1.04rem;
        line-height: 1.25;
      }
      .kicker, .label {
        color: color-mix(in oklch, currentColor, transparent 35%);
        font-size: .76rem;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .hero-card {
        display: grid;
        gap: var(--space-lg);
        border: 1px solid color-mix(in oklch, var(--paper), transparent 72%);
        border-radius: 8px;
        background: color-mix(in oklch, var(--paper), transparent 92%);
        padding: var(--space-xl);
      }
      .lead-image, .news-thumb, .article-thumb {
        display: block;
        overflow: hidden;
        border: 1px solid color-mix(in oklch, currentColor, transparent 82%);
        border-radius: 6px;
        background: color-mix(in oklch, var(--ink), transparent 90%);
      }
      .lead-image { aspect-ratio: 16 / 9; }
      .lead-image img, .news-thumb img, .article-thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .hero-card p {
        color: color-mix(in oklch, var(--paper), transparent 24%);
        line-height: 1.45;
      }
      .lead-proof, .meta, .source-strip {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
      }
      .lead-proof span, .pill {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        border: 1px solid color-mix(in oklch, currentColor, transparent 74%);
        border-radius: 999px;
        padding: 0 var(--space-md);
        color: var(--muted);
        font-size: .78rem;
        font-weight: 850;
      }
      .lead-proof span { color: var(--paper); }
      .pill.strong {
        color: var(--accent-dark);
        background: color-mix(in oklch, var(--accent), transparent 88%);
      }
      .pill.trend {
        color: oklch(30% 0.1 155);
        background: color-mix(in oklch, var(--trend), transparent 84%);
      }
      main {
        padding: var(--space-2xl) clamp(16px, 4vw, 64px) var(--space-3xl);
      }
      .status-band {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1px;
        border: 1px solid var(--line);
        background: var(--line);
        margin-bottom: var(--space-2xl);
      }
      .status-band > div {
        display: grid;
        gap: var(--space-sm);
        background: var(--surface);
        padding: var(--space-xl);
      }
      .status-band strong {
        font-family: Georgia, Times New Roman, serif;
        font-size: 2.2rem;
        line-height: 1;
      }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr);
        gap: var(--space-2xl);
        align-items: start;
      }
      .panel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        overflow: hidden;
      }
      .section-head {
        display: grid;
        gap: var(--space-sm);
        padding: var(--space-xl);
        border-bottom: 1px solid var(--line);
        background: color-mix(in oklch, var(--wash), var(--surface) 55%);
      }
      .news-list, .article-list { display: grid; }
      .news-item {
        display: grid;
        grid-template-columns: 52px minmax(0, 1fr);
        gap: var(--space-lg);
        padding: var(--space-xl);
        border-bottom: 1px solid var(--line);
      }
      .news-item:last-child, .article-item:last-child { border-bottom: 0; }
      .rank {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--ink);
        color: var(--paper);
        font-weight: 950;
      }
      .news-item h3, .article-item h3 { margin-bottom: var(--space-md); }
      .news-thumb, .article-thumb {
        aspect-ratio: 16 / 9;
        margin-bottom: var(--space-lg);
      }
      .source-strip { margin-top: var(--space-md); }
      .source-strip span {
        border: 1px solid var(--line);
        border-radius: 4px;
        background: var(--paper);
        color: var(--accent-dark);
        font-size: .82rem;
        font-weight: 850;
        line-height: 1.25;
        padding: 6px var(--space-sm);
      }
      .summary {
        color: var(--muted);
        line-height: 1.55;
        margin-top: var(--space-md);
      }
      .article-item {
        padding: var(--space-xl);
        border-bottom: 1px solid var(--line);
      }
      .article-item a, .news-item a {
        color: var(--accent-dark);
        font-weight: 850;
        text-decoration: none;
      }
      details {
        margin-top: var(--space-lg);
        border-top: 1px solid var(--line);
        padding-top: var(--space-md);
      }
      summary {
        cursor: pointer;
        color: var(--accent-dark);
        font-size: .8rem;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .story-body {
        display: grid;
        gap: var(--space-md);
        margin-top: var(--space-lg);
        color: var(--ink);
        line-height: 1.62;
      }
      .compact {
        gap: 6px;
      }
      .compact span {
        font-size: .72rem;
      }
      @media (max-width: 820px) {
        .hero-grid, .grid { grid-template-columns: 1fr; }
        .status-band { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 560px) {
        .topbar { padding: 24px 16px 32px; }
        main { padding: 16px; }
        .status-band { grid-template-columns: 1fr; }
        .news-item {
          grid-template-columns: 1fr;
          padding: 18px;
        }
        .rank {
          width: 36px;
          height: 36px;
        }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <nav class="brand-line" aria-label="Identidade do painel">
        <span>Radar Pop Verificado</span>
        <span>3+ fontes</span>
        <span>Edicao de hoje</span>
      </nav>
      <div class="hero-grid">
        <div>
          <p class="kicker">Mesa automatica de entretenimento</p>
          <h1>So entra assunto repetido em varios lugares.</h1>
        </div>
        ${renderHero(lead)}
      </div>
    </header>

    <main>
      <section class="status-band" aria-label="Resumo editorial">
        <div>
          <span class="label">Aprovadas</span>
          <strong>${news.length}</strong>
        </div>
        <div>
          <span class="label">Com Google Trends</span>
          <strong>${trendCount}</strong>
        </div>
        <div>
          <span class="label">Media de fontes</span>
          <strong>${sourceAverage.toFixed(1).replace(".", ",")}</strong>
        </div>
        <div>
          <span class="label">Posts prontos</span>
          <strong>${articleItems.length || articles.length}</strong>
        </div>
      </section>

      <section class="grid">
        <div class="panel">
          <div class="section-head">
            <p class="kicker">Fila verificada</p>
            <h2>Assuntos com cobertura repetida</h2>
          </div>
          <div class="news-list">
            ${news.map(renderNewsItem).join("")}
          </div>
        </div>

        <aside class="panel posts-panel">
          <div class="section-head">
            <p class="kicker">Rascunhos</p>
            <h2>Materias em linguagem de portal</h2>
          </div>
          <div class="article-list">
            ${articleItems.map(renderArticle).join("")}
          </div>
        </aside>
      </section>
    </main>
  </body>
</html>`;
}

const news = selectNews(readJson(newsPath, []));
const articles = readJson(articlesPath, []);
if (!news.length) throw new Error("Nenhuma noticia de hoje passou no filtro.");

fs.writeFileSync(outputPath, renderHtml(news, articles));
console.log(`HTML gerado: ${outputPath}`);
console.log(`Materias: ${news.map((item) => item.title).join(" | ")}`);
