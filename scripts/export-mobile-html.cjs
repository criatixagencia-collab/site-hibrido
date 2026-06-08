const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "src/lib/news-data.ts");
const outputPath = path.join(root, "buzz-mobile-para-enviar.html");

const source = fs.readFileSync(sourcePath, "utf8").replace(/import\.meta\.env\.DEV/g, "false");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const sandbox = {
  exports: {},
  require,
  console,
};

vm.runInNewContext(compiled, sandbox, { filename: sourcePath });

const items = sandbox.exports.getNewsPage(0);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function imageSrc(src) {
  if (!src.startsWith("/")) return src;

  const filePath = path.join(root, "public", src);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
  const data = fs.readFileSync(filePath).toString("base64");
  return `data:${mime};base64,${data}`;
}

const articles = items
  .map((item) => {
    const paragraphs = item.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");

    return `
      <article class="story" id="${escapeHtml(item.slug)}">
        <div class="kicker">${escapeHtml(item.category)}</div>
        <h2>${escapeHtml(item.title)}</h2>
        <p class="excerpt">${escapeHtml(item.excerpt)}</p>
        <figure>
          <img src="${imageSrc(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">
          <figcaption>${escapeHtml(item.imageCredit)}</figcaption>
        </figure>
        <details>
          <summary>Ler noticia completa</summary>
          <div class="body">${paragraphs}</div>
        </details>
        <a class="source" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(item.sourceLabel)}
        </a>
      </article>
    `;
  })
  .join("");

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BuzzPop - Preview Mobile</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #fffaf2;
      --paper: #ffffff;
      --text: #16120d;
      --muted: #756b61;
      --line: #e1d8cc;
      --accent: #dc2626;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 250, 242, 0.96);
      padding: 14px 16px;
      backdrop-filter: blur(10px);
    }

    .brand {
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 34px;
      line-height: 0.9;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .tag {
      max-width: 130px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 800;
      line-height: 1.2;
      text-align: right;
      text-transform: uppercase;
    }

    main {
      max-width: 560px;
      margin: 0 auto;
      background: var(--paper);
    }

    .story {
      border-bottom: 1px solid var(--line);
      padding: 26px 16px 32px;
    }

    .kicker {
      display: inline-flex;
      margin-bottom: 12px;
      background: var(--accent);
      color: #ffffff;
      padding: 6px 9px;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    h1, h2, p { margin: 0; }

    h2 {
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: clamp(44px, 15vw, 76px);
      font-weight: 900;
      line-height: 0.86;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .excerpt {
      margin-top: 16px;
      color: #2d2721;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.25;
    }

    figure {
      margin: 22px -16px 0;
      background: #eee6da;
    }

    img {
      display: block;
      width: 100%;
      height: auto;
      object-fit: contain;
    }

    figcaption {
      padding: 8px 16px 0;
      color: var(--muted);
      background: var(--paper);
      font-size: 10px;
      font-weight: 700;
      line-height: 1.35;
      text-transform: uppercase;
      letter-spacing: 0.11em;
    }

    details {
      margin-top: 18px;
      border-top: 1px solid var(--line);
      padding-top: 14px;
    }

    summary {
      cursor: pointer;
      color: var(--accent);
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .body {
      margin-top: 18px;
      display: grid;
      gap: 16px;
      color: #2d2721;
      font-size: 18px;
      line-height: 1.55;
    }

    .source {
      display: inline-flex;
      margin-top: 18px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      text-decoration: none;
      letter-spacing: 0.08em;
    }
  </style>
</head>
<body>
  <header>
    <h1 class="brand">BuzzPop</h1>
    <div class="tag">Preview mobile estatico</div>
  </header>
  <main>
    ${articles}
  </main>
</body>
</html>
`;

fs.writeFileSync(outputPath, html);
console.log(outputPath);
