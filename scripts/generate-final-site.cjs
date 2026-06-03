const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const articlesPath = path.join(root, "data", "articles.json");
const outputPath = path.join(root, "public", "site-final.html");

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

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
}

function imageFor(article) {
  return article.image || "/images/news-placeholder.svg";
}

function sourceLabels(article) {
  return (article.evidenceSources || [article.source]).filter(Boolean).slice(0, 4);
}

function renderLead(article) {
  const id = slug(article.slug || article.title);
  return `<section class="lead">
    <a class="lead-copy" href="#${escapeHtml(id)}">
      <span class="section-label">${escapeHtml(article.category || "Entretenimento")}</span>
      <h2>${escapeHtml(article.title)}</h2>
      <p>${escapeHtml(article.excerpt)}</p>
      <span class="read-link">Ler a matéria</span>
    </a>
    <figure class="lead-media">
      <img src="${escapeHtml(imageFor(article))}" alt="${escapeHtml(article.imageAlt || article.title)}" loading="eager">
      <figcaption>${escapeHtml(article.imageCredit || "Imagem: arquivo / divulgação")}</figcaption>
    </figure>
  </section>`;
}

function renderTopCard(article, index) {
  const id = slug(article.slug || article.title);
  return `<a class="top-card" href="#${escapeHtml(id)}">
    <span class="card-number">${String(index + 1).padStart(2, "0")}</span>
    <span class="section-label">${escapeHtml(article.category || "Pop")}</span>
    <h3>${escapeHtml(article.title)}</h3>
    <p>${escapeHtml(article.excerpt)}</p>
  </a>`;
}

function renderArticle(article) {
  const id = slug(article.slug || article.title);
  const body = article.body?.length ? article.body : [article.excerpt];
  const sources = sourceLabels(article);
  return `<article class="story" id="${escapeHtml(id)}">
    <div class="story-heading">
      <span class="section-label">${escapeHtml(article.category || "Entretenimento")}</span>
      <h2>${escapeHtml(article.title)}</h2>
      <p>${escapeHtml(article.excerpt)}</p>
    </div>
    <figure class="story-media">
      <img src="${escapeHtml(imageFor(article))}" alt="${escapeHtml(article.imageAlt || article.title)}" loading="lazy">
      <figcaption>${escapeHtml(article.imageCredit || "Imagem: arquivo / divulgação")}</figcaption>
    </figure>
    <div class="story-body">
      ${body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </div>
    <footer class="story-footer">
      <span>Publicado em ${escapeHtml(formatDate(article.createdAt))}</span>
      <span>${sources.map(escapeHtml).join(" / ")}</span>
    </footer>
  </article>`;
}

function renderHtml(articles) {
  const items = articles.slice(0, 6);
  const lead = items[0];
  const secondary = items.slice(1, 4);
  const rest = items.slice(4);
  const generatedAt = formatDate(new Date().toISOString());

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BuzzNews - Entretenimento agora</title>
  <meta name="description" content="Noticias de entretenimento, TV, cinema, musica, streaming e famosos em leitura rapida.">
  <style>
    :root {
      --ink: oklch(16% 0.018 42);
      --muted: oklch(46% 0.026 48);
      --paper: oklch(97% 0.014 72);
      --surface: oklch(99% 0.008 72);
      --wash: oklch(91% 0.028 70);
      --line: oklch(80% 0.022 68);
      --red: oklch(50% 0.19 24);
      --red-deep: oklch(33% 0.13 24);
      --gold: oklch(73% 0.13 78);
      --green: oklch(48% 0.12 150);
      --space-xs: 4px;
      --space-sm: 8px;
      --space-md: 12px;
      --space-lg: 16px;
      --space-xl: 24px;
      --space-2xl: 32px;
      --space-3xl: 48px;
      --space-4xl: 64px;
    }

    * { box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    body {
      margin: 0;
      background:
        linear-gradient(90deg, color-mix(in oklch, var(--line), transparent 70%) 0 1px, transparent 1px 100%) 0 0 / 56px 56px,
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
      font-size: 0.76rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      font-family: Georgia, Times New Roman, serif;
      font-size: clamp(4rem, 14vw, 10rem);
      line-height: 0.78;
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
      font-size: 0.82rem;
      font-weight: 900;
      letter-spacing: 0.08em;
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

    .lead {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.72fr);
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

    .section-label {
      width: fit-content;
      color: var(--red);
      font-size: 0.75rem;
      font-weight: 950;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .lead h2 {
      max-width: 760px;
      font-family: Georgia, Times New Roman, serif;
      font-size: clamp(2.55rem, 7vw, 6.2rem);
      line-height: 0.9;
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
      font-size: 0.82rem;
      font-weight: 950;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .lead-media, .story-media {
      background: var(--wash);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }

    .lead-media img {
      width: 100%;
      aspect-ratio: 4 / 5;
      object-fit: cover;
    }

    figcaption {
      padding: var(--space-sm) var(--space-md);
      color: var(--muted);
      font-size: 0.68rem;
      font-weight: 850;
      line-height: 1.35;
      letter-spacing: 0.08em;
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
      line-height: 0.95;
    }

    .section-band p {
      max-width: 420px;
      color: var(--muted);
      font-weight: 760;
      line-height: 1.4;
      text-align: right;
    }

    .top-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border-bottom: 1px solid var(--line);
    }

    .top-card {
      display: grid;
      gap: var(--space-md);
      min-height: 280px;
      padding: var(--space-xl);
      border-right: 1px solid var(--line);
      align-content: start;
    }

    .top-card:last-child { border-right: 0; }

    .card-number {
      color: var(--red-deep);
      font-family: Georgia, Times New Roman, serif;
      font-size: 2.1rem;
      font-weight: 900;
      line-height: 1;
    }

    .top-card h3 {
      font-family: Georgia, Times New Roman, serif;
      font-size: clamp(1.45rem, 2.2vw, 2.15rem);
      line-height: 1;
    }

    .top-card p {
      color: var(--muted);
      line-height: 1.48;
      font-weight: 680;
    }

    .story {
      display: grid;
      grid-template-columns: minmax(0, 0.78fr) minmax(320px, 0.42fr);
      gap: var(--space-3xl);
      padding: clamp(28px, 5vw, 60px);
      border-bottom: 1px solid var(--line);
      scroll-margin-top: 16px;
    }

    .story-heading {
      grid-column: 1 / -1;
      display: grid;
      gap: var(--space-md);
      max-width: 880px;
    }

    .story-heading h2 {
      font-family: Georgia, Times New Roman, serif;
      font-size: clamp(2rem, 5vw, 4.6rem);
      line-height: 0.93;
    }

    .story-heading > p {
      max-width: 760px;
      color: var(--muted);
      font-size: 1.18rem;
      font-weight: 760;
      line-height: 1.38;
    }

    .story-media img {
      width: 100%;
      aspect-ratio: 16 / 11;
      object-fit: cover;
    }

    .story-body {
      max-width: 72ch;
      display: grid;
      gap: var(--space-lg);
      color: color-mix(in oklch, var(--ink), var(--muted) 14%);
      font-size: 1.08rem;
      line-height: 1.67;
    }

    .story-body p:first-child {
      font-size: 1.18rem;
      font-weight: 760;
      line-height: 1.52;
    }

    .story-footer {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-sm) var(--space-xl);
      border-top: 1px solid var(--line);
      padding-top: var(--space-lg);
      color: var(--muted);
      font-size: 0.76rem;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .extra-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-bottom: 1px solid var(--line);
    }

    .site-footer {
      padding: var(--space-3xl) clamp(16px, 4vw, 48px);
      background: var(--ink);
      color: color-mix(in oklch, var(--paper), transparent 18%);
      display: flex;
      justify-content: space-between;
      gap: var(--space-xl);
      font-size: 0.82rem;
      font-weight: 850;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    @media (max-width: 860px) {
      main { border-left: 0; border-right: 0; }
      .lead, .story { grid-template-columns: 1fr; }
      .lead-media { order: -1; }
      .lead-media img { aspect-ratio: 16 / 11; }
      .top-grid, .extra-row { grid-template-columns: 1fr; }
      .top-card { border-right: 0; border-bottom: 1px solid var(--line); min-height: auto; }
      .section-band { display: grid; }
      .section-band p { text-align: left; }
      .site-footer { display: grid; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="masthead">
      <div class="topline">
        <span>Entretenimento agora</span>
        <span>${escapeHtml(generatedAt)}</span>
      </div>
      <h1>BuzzNews</h1>
      <nav class="nav" aria-label="Editorias">
        <span>Famosos</span>
        <span>TV</span>
        <span>Cinema</span>
        <span>Streaming</span>
        <span>Música</span>
      </nav>
    </div>
  </header>
  <main>
    ${lead ? renderLead(lead) : ""}
    <section class="section-band">
      <h2>Mais lidas agora</h2>
      <p>Um giro rápido pelos assuntos que movimentam a cultura pop nesta edição.</p>
    </section>
    <section class="top-grid">
      ${secondary.map(renderTopCard).join("")}
    </section>
    ${rest.length ? `<section class="extra-row">${rest.map((article, index) => renderTopCard(article, index + secondary.length)).join("")}</section>` : ""}
    <section class="section-band">
      <h2>Matérias completas</h2>
      <p>Leia os textos em formato de notícia, com contexto e atualização em blocos curtos.</p>
    </section>
    ${items.map(renderArticle).join("")}
  </main>
  <footer class="site-footer">
    <span>BuzzNews</span>
    <span>Atualizado em ${escapeHtml(generatedAt)}</span>
  </footer>
</body>
</html>`;
}

const articles = readArticles();
if (!articles.length) throw new Error("Nenhuma materia em data/articles.json.");

fs.writeFileSync(outputPath, renderHtml(articles));
console.log(`Site final gerado: ${outputPath}`);
console.log(`Materias: ${articles.slice(0, 6).map((article) => article.title).join(" | ")}`);
