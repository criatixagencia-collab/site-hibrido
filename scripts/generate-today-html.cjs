const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const articlesPath = path.join(root, "data", "articles.json");
const outputPath = path.join(root, "public", "site-hoje.html");

const blockedPublicSubjects = [
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

function cleanSummary(value = "", title = "") {
  const titleStart = title.slice(0, 45).toLowerCase();
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

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "03/06/2026";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function titleCase(value) {
  return String(value || "")
    .replace(/\s+-\s+.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadArticles() {
  if (!fs.existsSync(articlesPath)) {
    throw new Error("data/articles.json nao encontrado. Rode npm run hybrid:refresh antes.");
  }
  return JSON.parse(fs.readFileSync(articlesPath, "utf8"));
}

function filterArticles(items) {
  return items
    .filter((item) => !blockedPublicSubjects.some((pattern) => pattern.test(`${item.title} ${item.excerpt}`)))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 6);
}

function renderArticle(item, index) {
  const title = titleCase(item.title);
  const body = item.body?.length ? item.body : [cleanSummary(item.html || item.excerpt, item.title)];
  const category = item.category || "Entretenimento";
  const image = item.image || "/images/news-placeholder.svg";
  const references = (item.evidenceSources || [item.source])
    .slice(0, 5)
    .map((source) => `<li>${escapeHtml(source)}</li>`)
    .join("");

  return `<article class="story ${index === 0 ? "lead" : ""}">
    <div class="meta">
      <span>${escapeHtml(category)}</span>
      <time>${escapeHtml(formatDate(item.createdAt))}</time>
    </div>
    <h2>${escapeHtml(title)}</h2>
    <p class="dek">${escapeHtml(item.excerpt || cleanSummary(item.html, item.title))}</p>
    <figure>
      <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="${index === 0 ? "eager" : "lazy"}">
      <figcaption>${escapeHtml(item.imageCredit || "Imagem: referencia automatica")}</figcaption>
    </figure>
    <div class="body">
      ${body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
    </div>
    <footer>
      <strong>Referencias</strong>
      <ul>${references}</ul>
      <a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir publicacao original</a>
    </footer>
  </article>`;
}

function renderHtml(items) {
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BuzzPop Brasil Hoje - ${escapeHtml(generatedAt)}</title>
  <style>
    :root {
      --bg: #f4f1ea;
      --paper: #fffdf8;
      --ink: #171411;
      --muted: #696057;
      --line: #d8d0c5;
      --accent: #c5162e;
      --accent-dark: #970f22;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
    }
    header {
      border-bottom: 1px solid var(--line);
      background: var(--paper);
    }
    .masthead {
      max-width: 1120px;
      margin: 0 auto;
      padding: 18px 18px 14px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    h1 {
      margin: 0;
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: clamp(42px, 9vw, 92px);
      line-height: .82;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .stamp {
      max-width: 260px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      line-height: 1.35;
      text-align: right;
      text-transform: uppercase;
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      background: var(--paper);
      border-left: 1px solid var(--line);
      border-right: 1px solid var(--line);
    }
    .story {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, .72fr);
      gap: 28px;
      padding: 34px 28px;
      border-bottom: 1px solid var(--line);
    }
    .story:not(.lead) {
      grid-template-columns: minmax(0, .95fr) minmax(260px, .55fr);
    }
    .meta {
      grid-column: 1 / -1;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
    h2 {
      margin: 0;
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: clamp(44px, 7vw, 86px);
      line-height: .9;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .story:not(.lead) h2 {
      font-size: clamp(34px, 5vw, 58px);
    }
    .dek {
      margin: 16px 0 0;
      max-width: 720px;
      font-size: 20px;
      font-weight: 800;
      line-height: 1.25;
    }
    figure {
      grid-row: span 3;
      margin: 0;
      align-self: start;
      background: #ece5da;
    }
    img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 5;
      object-fit: cover;
    }
    figcaption {
      padding: 8px 10px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 800;
      line-height: 1.3;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .body {
      display: grid;
      gap: 15px;
      margin-top: 24px;
      max-width: 730px;
      font-size: 18px;
      line-height: 1.58;
    }
    p { margin: 0; }
    footer {
      margin-top: 22px;
      border-top: 1px solid var(--line);
      padding-top: 14px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    footer ul {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      list-style: none;
      margin: 10px 0 12px;
      padding: 0;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 700;
    }
    footer a {
      color: var(--accent-dark);
      text-decoration: none;
    }
    @media (max-width: 760px) {
      .masthead {
        align-items: flex-start;
        flex-direction: column;
      }
      .stamp {
        text-align: left;
      }
      main {
        border: 0;
      }
      .story,
      .story:not(.lead) {
        display: block;
        padding: 26px 16px 32px;
      }
      .meta {
        margin-bottom: 14px;
      }
      figure {
        margin: 20px -16px 0;
      }
      img {
        aspect-ratio: 16 / 11;
      }
      .body {
        font-size: 17px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="masthead">
      <h1>BuzzPop Brasil Hoje</h1>
      <div class="stamp">Edicao de teste gerada em ${escapeHtml(generatedAt)}</div>
    </div>
  </header>
  <main>
    ${items.map(renderArticle).join("\n")}
  </main>
</body>
</html>
`;
}

const selected = filterArticles(loadArticles());
if (!selected.length) {
  throw new Error("Nenhuma noticia de hoje passou no filtro.");
}

fs.writeFileSync(outputPath, renderHtml(selected));
console.log(`HTML gerado: ${outputPath}`);
console.log(`Materias: ${selected.map((item) => item.title).join(" | ")}`);
