const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const articlesPath = path.join(root, "data", "articles.json");
const outputDir = path.join(root, "public", "final-site");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readArticles() {
  if (!fs.existsSync(articlesPath)) {
    throw new Error("data/articles.json nao encontrado. Rode npm run hybrid:refresh antes.");
  }
  return JSON.parse(fs.readFileSync(articlesPath, "utf8"));
}

function slug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function articleSlug(article) {
  return slug(article.slug || article.title);
}

function articleUrl(article, prefix = "") {
  return `${prefix}noticias/${articleSlug(article)}/`;
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
}

function imageFor(article, prefix = "") {
  const image = article.image || "/images/news-placeholder.svg";
  if (image.startsWith("/")) return `${prefix}${image.slice(1)}`;
  return image;
}

function sourceLabels(article) {
  return (article.evidenceSources || [article.source]).filter(Boolean).slice(0, 4);
}

function stylesheet(prefix = "") {
  return `<style>
    :root {
      --ink: oklch(16% 0.018 42);
      --muted: oklch(46% 0.026 48);
      --paper: oklch(97% 0.014 72);
      --surface: oklch(99% 0.008 72);
      --wash: oklch(91% 0.028 70);
      --line: oklch(80% 0.022 68);
      --red: oklch(50% 0.19 24);
      --red-deep: oklch(33% 0.13 24);
      --space-sm: 8px;
      --space-md: 12px;
      --space-lg: 16px;
      --space-xl: 24px;
      --space-2xl: 32px;
      --space-3xl: 48px;
      --space-4xl: 64px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        linear-gradient(90deg, color-mix(in oklch, var(--line), transparent 72%) 0 1px, transparent 1px 100%) 0 0 / 56px 56px,
        var(--paper);
      color: var(--ink);
      font-family: Avenir Next, Avenir, Trebuchet MS, sans-serif;
    }
    a { color: inherit; text-decoration: none; }
    img { display: block; max-width: 100%; }
    h1, h2, h3, p, figure { margin: 0; }
    .site-header {
      background: var(--ink);
      color: var(--paper);
      border-bottom: 6px solid var(--red);
    }
    .masthead {
      max-width: 1180px;
      margin: 0 auto;
      padding: var(--space-xl) clamp(16px, 4vw, 48px) var(--space-lg);
      display: grid;
      gap: var(--space-lg);
    }
    .topline {
      display: flex;
      justify-content: space-between;
      gap: var(--space-lg);
      color: color-mix(in oklch, var(--paper), transparent 28%);
      font-size: .76rem;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .brand {
      width: fit-content;
      font-family: Georgia, Times New Roman, serif;
      font-size: clamp(4rem, 14vw, 10rem);
      line-height: .78;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-sm);
      padding-top: var(--space-md);
      border-top: 1px solid color-mix(in oklch, var(--paper), transparent 78%);
      color: color-mix(in oklch, var(--paper), transparent 12%);
      font-size: .82rem;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .nav span {
      border: 1px solid color-mix(in oklch, currentColor, transparent 68%);
      border-radius: 999px;
      padding: 7px 12px;
    }
    main {
      max-width: 1180px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-top: 0;
    }
    .section-label {
      width: fit-content;
      color: var(--red);
      font-size: .75rem;
      font-weight: 950;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
    .lead {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(320px, .72fr);
      gap: var(--space-3xl);
      padding: clamp(24px, 5vw, 56px);
      border-bottom: 1px solid var(--line);
      background: color-mix(in oklch, var(--wash), var(--surface) 64%);
    }
    .lead-copy {
      display: grid;
      align-content: center;
      gap: var(--space-lg);
      min-width: 0;
    }
    .lead h1 {
      max-width: 760px;
      font-family: Georgia, Times New Roman, serif;
      font-size: clamp(2.55rem, 7vw, 6.2rem);
      line-height: .9;
      letter-spacing: 0;
    }
    .lead p {
      max-width: 680px;
      color: var(--muted);
      font-size: clamp(1.05rem, 2vw, 1.35rem);
      font-weight: 760;
      line-height: 1.34;
    }
    .read-link {
      width: fit-content;
      margin-top: var(--space-sm);
      border: 1px solid var(--red);
      border-radius: 999px;
      background: var(--red);
      color: var(--paper);
      padding: 12px 18px;
      font-size: .82rem;
      font-weight: 950;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .media-box {
      background: var(--wash);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    .media-box img {
      width: 100%;
      aspect-ratio: 4 / 5;
      object-fit: contain;
      background: var(--wash);
    }
    figcaption {
      padding: var(--space-sm) var(--space-md);
      color: var(--muted);
      font-size: .68rem;
      font-weight: 850;
      line-height: 1.35;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .section-band {
      padding: var(--space-xl) clamp(16px, 4vw, 48px);
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: var(--space-lg);
    }
    .section-band h2 {
      font-family: Georgia, Times New Roman, serif;
      font-size: clamp(1.8rem, 4vw, 3.4rem);
      line-height: .95;
    }
    .section-band p {
      max-width: 420px;
      color: var(--muted);
      font-weight: 760;
      line-height: 1.4;
      text-align: right;
    }
    .feed-list {
      display: grid;
    }
    .feed-item {
      display: grid;
      grid-template-columns: minmax(0, .95fr) minmax(220px, .38fr);
      gap: var(--space-2xl);
      padding: clamp(24px, 4vw, 44px);
      border-bottom: 1px solid var(--line);
      align-items: center;
      background: var(--surface);
    }
    .feed-copy {
      display: grid;
      gap: var(--space-md);
      min-width: 0;
    }
    .feed-copy h2 {
      font-family: Georgia, Times New Roman, serif;
      font-size: clamp(2rem, 4.8vw, 4.6rem);
      line-height: .92;
    }
    .feed-copy p {
      max-width: 780px;
      color: var(--muted);
      font-size: clamp(1rem, 1.6vw, 1.18rem);
      line-height: 1.42;
      font-weight: 760;
    }
    .feed-number {
      color: var(--red-deep);
      font-family: Georgia, Times New Roman, serif;
      font-size: 2.1rem;
      font-weight: 900;
      line-height: 1;
    }
    .feed-item .media-box img {
      aspect-ratio: 16 / 10;
    }
    .article-layout {
      display: grid;
      grid-template-columns: minmax(0, .76fr) minmax(300px, .42fr);
      gap: var(--space-3xl);
      padding: clamp(28px, 5vw, 60px);
    }
    .article-header {
      grid-column: 1 / -1;
      display: grid;
      gap: var(--space-md);
      max-width: 920px;
    }
    .article-header h1 {
      font-family: Georgia, Times New Roman, serif;
      font-size: clamp(2.3rem, 6vw, 5.6rem);
      line-height: .9;
    }
    .article-header p {
      max-width: 760px;
      color: var(--muted);
      font-size: 1.2rem;
      font-weight: 760;
      line-height: 1.38;
    }
    .article-body {
      max-width: 72ch;
      display: grid;
      gap: var(--space-lg);
      color: color-mix(in oklch, var(--ink), var(--muted) 14%);
      font-size: 1.08rem;
      line-height: 1.67;
    }
    .article-body p:first-child {
      font-size: 1.18rem;
      font-weight: 760;
      line-height: 1.52;
    }
    .article-aside {
      display: grid;
      align-content: start;
      gap: var(--space-xl);
    }
    .side-list {
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: color-mix(in oklch, var(--wash), var(--surface) 62%);
    }
    .side-list h2 {
      padding: var(--space-lg);
      border-bottom: 1px solid var(--line);
      font-family: Georgia, Times New Roman, serif;
      font-size: 1.5rem;
      line-height: 1;
    }
    .side-list a {
      display: grid;
      gap: var(--space-sm);
      padding: var(--space-lg);
      border-bottom: 1px solid var(--line);
    }
    .side-list a:last-child { border-bottom: 0; }
    .side-list strong {
      line-height: 1.18;
    }
    .side-list span {
      color: var(--muted);
      font-size: .76rem;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .story-footer {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-sm) var(--space-xl);
      border-top: 1px solid var(--line);
      margin-top: var(--space-xl);
      padding-top: var(--space-lg);
      color: var(--muted);
      font-size: .76rem;
      font-weight: 900;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    .site-footer {
      padding: var(--space-3xl) clamp(16px, 4vw, 48px);
      background: var(--ink);
      color: color-mix(in oklch, var(--paper), transparent 18%);
      display: flex;
      justify-content: space-between;
      gap: var(--space-xl);
      font-size: .82rem;
      font-weight: 850;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    @media (max-width: 860px) {
      main { border-left: 0; border-right: 0; }
      .lead, .article-layout { grid-template-columns: 1fr; }
      .lead .media-box { order: -1; }
      .media-box img { aspect-ratio: 16 / 11; }
      .feed-item { grid-template-columns: 1fr; }
      .feed-item .media-box { order: -1; }
      .section-band { display: grid; }
      .section-band p { text-align: left; }
      .site-footer { display: grid; }
    }
  </style>`;
}

function pageShell({ title, description, body, prefix = "" }) {
  const generatedAt = formatDate(new Date().toISOString());
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${stylesheet(prefix)}
</head>
<body>
  <header class="site-header">
    <div class="masthead">
      <div class="topline">
        <span>Entretenimento agora</span>
        <span>${escapeHtml(generatedAt)}</span>
      </div>
      <a class="brand" href="${prefix}index.html">BuzzNews</a>
      <nav class="nav" aria-label="Editorias">
        <span>Famosos</span>
        <span>TV</span>
        <span>Cinema</span>
        <span>Streaming</span>
        <span>Música</span>
      </nav>
    </div>
  </header>
  ${body}
  <footer class="site-footer">
    <span>BuzzNews</span>
    <span>Atualizado em ${escapeHtml(generatedAt)}</span>
  </footer>
</body>
</html>`;
}

function renderLead(article) {
  return `<section class="lead">
    <a class="lead-copy" href="${escapeHtml(articleUrl(article))}">
      <span class="section-label">${escapeHtml(article.category || "Entretenimento")}</span>
      <h1>${escapeHtml(article.title)}</h1>
      <p>${escapeHtml(article.excerpt)}</p>
      <span class="read-link">Ler a matéria</span>
    </a>
    <figure class="media-box">
      <img src="${escapeHtml(imageFor(article))}" alt="${escapeHtml(article.imageAlt || article.title)}" loading="eager">
      <figcaption>${escapeHtml(article.imageCredit || "Imagem ilustrativa")}</figcaption>
    </figure>
  </section>`;
}

function renderCard(article, index, prefix = "") {
  return `<a class="feed-item" href="${escapeHtml(articleUrl(article, prefix))}">
    <div class="feed-copy">
      <span class="feed-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="section-label">${escapeHtml(article.category || "Entretenimento")}</span>
      <h2>${escapeHtml(article.title)}</h2>
      <p>${escapeHtml(article.excerpt)}</p>
    </div>
    <figure class="media-box">
      <img src="${escapeHtml(imageFor(article))}" alt="${escapeHtml(article.imageAlt || article.title)}" loading="${index === 0 ? "eager" : "lazy"}">
      <figcaption>${escapeHtml(article.imageCredit || "Imagem ilustrativa")}</figcaption>
    </figure>
  </a>`;
}

function renderHome(articles) {
  const items = articles;
  const body = `<main>
    <section class="section-band">
      <h2>Últimas notícias</h2>
      <p>Entretenimento, TV, cinema, música, streaming e famosos em atualização contínua.</p>
    </section>
    <section class="feed-list" aria-label="Feed de noticias">
      ${items.map((article, index) => renderCard(article, index)).join("")}
    </section>
  </main>`;

  return pageShell({
    title: "BuzzNews - Entretenimento agora",
    description: "Noticias de entretenimento, TV, cinema, musica, streaming e famosos em leitura rapida.",
    body,
  });
}

function renderSideList(title, articles, currentSlug, prefix) {
  const items = articles.filter((article) => articleSlug(article) !== currentSlug).slice(0, 4);
  return `<aside class="side-list">
    <h2>${escapeHtml(title)}</h2>
    ${items
      .map(
        (article) => `<a href="${escapeHtml(articleUrl(article, prefix))}">
          <span>${escapeHtml(article.category || "Entretenimento")}</span>
          <strong>${escapeHtml(article.title)}</strong>
        </a>`,
      )
      .join("")}
  </aside>`;
}

function renderArticlePage(article, allArticles) {
  const currentSlug = articleSlug(article);
  const prefix = "../../";
  const body = article.body?.length ? article.body : [article.excerpt];
  const sources = sourceLabels(article);
  const pageBody = `<main>
    <article class="article-layout">
      <header class="article-header">
        <span class="section-label">${escapeHtml(article.category || "Entretenimento")}</span>
        <h1>${escapeHtml(article.title)}</h1>
        <p>${escapeHtml(article.excerpt)}</p>
      </header>
      <div>
        <div class="article-body">
          ${body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        </div>
        <footer class="story-footer">
          <span>Publicado em ${escapeHtml(formatDate(article.createdAt))}</span>
          <span>${sources.map(escapeHtml).join(" / ")}</span>
        </footer>
      </div>
      <aside class="article-aside">
        <figure class="media-box">
          <img src="${escapeHtml(imageFor(article, prefix))}" alt="${escapeHtml(article.imageAlt || article.title)}" loading="eager">
          <figcaption>${escapeHtml(article.imageCredit || "Imagem ilustrativa")}</figcaption>
        </figure>
        ${renderSideList("Mais vistas do dia", allArticles, currentSlug, prefix)}
        ${renderSideList("Mais lidas do dia", allArticles.slice().reverse(), currentSlug, prefix)}
      </aside>
    </article>
  </main>`;

  return pageShell({
    title: `${article.title} - BuzzNews`,
    description: article.excerpt,
    body: pageBody,
    prefix,
  });
}

function writeFinalSite(articles) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "index.html"), renderHome(articles));

  for (const article of articles.slice(0, 12)) {
    const dir = path.join(outputDir, "noticias", articleSlug(article));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderArticlePage(article, articles));
  }
}

const articles = readArticles();
if (!articles.length) throw new Error("Nenhuma materia em data/articles.json.");

writeFinalSite(articles);
console.log(`Site final gerado em: ${outputDir}`);
console.log(`Paginas de materia: ${articles.slice(0, 12).length}`);
