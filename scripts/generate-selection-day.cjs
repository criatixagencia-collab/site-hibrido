#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const reviewQueuePath = path.join(root, "data", "review-queue.json");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(safeDate);
}

function readReviewQueue(filePath = reviewQueuePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error("data/review-queue.json nao encontrado. Rode npm run hybrid:refresh antes.");
  }

  const queue = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(queue.items)) {
    throw new Error("data/review-queue.json invalido: campo items[] ausente.");
  }
  return queue;
}

function sourceText(item) {
  const sources = Array.isArray(item.evidenceSources) && item.evidenceSources.length
    ? item.evidenceSources
    : [item.source].filter(Boolean);
  return sources.join(" / ");
}

function confidencePercent(item) {
  const confidence = Number(item.editorialMeta?.automatedReview?.confidence || 0);
  if (!Number.isFinite(confidence) || confidence <= 0) return "";
  return Math.round(confidence * 100) + "%";
}

function selectionItems(queue) {
  const pending = queue.items.filter((item) => item.reviewStatus === "pending-human");
  const items = pending.length ? pending : queue.items;
  return items.slice().sort((left, right) => {
    const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
    if (scoreDelta) return scoreDelta;
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  });
}

function renderWhatsappList(items) {
  return items.map((item, index) => {
    const num = index + 1;
    const confidence = confidencePercent(item);
    const meta = [
      item.category || "Entretenimento",
      `score ${Number(item.score || 0)}`,
      confidence ? `conf. ${confidence}` : "",
    ].filter(Boolean).join(" · ");
    return `${num}. ${item.title}\n${meta}\nFontes: ${sourceText(item) || "sem fontes"}`;
  }).join("\n\n");
}

function renderSelectionDay(queue) {
  const items = selectionItems(queue);
  const generatedAt = queue.generatedAt || new Date().toISOString();
  const cards = items.map((item, index) => {
    const num = index + 1;
    const rank = String(num).padStart(2, "0");
    const confidence = confidencePercent(item);
    const reviewId = item.reviewId || item.id || "";
    return (
      '<article class="item">' +
        '<div class="rank">' +
          '<span>Matéria</span>' +
          '<strong>' + escapeHtml(rank) + '</strong>' +
        '</div>' +
        '<div class="item-body">' +
          '<div class="badges">' +
            '<span class="badge category">' + escapeHtml(item.category || "Entretenimento") + '</span>' +
            '<span class="badge">Score ' + escapeHtml(Number(item.score || 0)) + '</span>' +
            (confidence ? '<span class="badge">Confiança ' + escapeHtml(confidence) + '</span>' : '') +
          '</div>' +
          '<h2>' + escapeHtml(item.title) + '</h2>' +
          '<p class="excerpt">' + escapeHtml(item.excerpt || "") + '</p>' +
          '<dl>' +
            '<div><dt>Fontes</dt><dd>' + escapeHtml(sourceText(item) || "sem fontes registradas") + '</dd></div>' +
            '<div><dt>Categoria</dt><dd>' + escapeHtml(item.category || "Entretenimento") + '</dd></div>' +
            '<div><dt>Score</dt><dd>' + escapeHtml(Number(item.score || 0)) + '</dd></div>' +
            (confidence ? '<div><dt>Confiança IA</dt><dd>' + escapeHtml(confidence) + '</dd></div>' : '') +
            (reviewId ? '<div><dt>ID</dt><dd>' + escapeHtml(reviewId) + '</dd></div>' : '') +
          '</dl>' +
        '</div>' +
      '</article>'
    );
  }).join("");

  const whatsappList = renderWhatsappList(items);

  return '<!doctype html>\n' +
    '<html lang="pt-BR">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>Seleção do Dia — BuzzPop</title>\n' +
    '<meta name="description" content="Lista numerada de matérias candidatas para aprovação editorial do BuzzPop.">\n' +
    '<style>\n' +
    '*,::after,::before{box-sizing:border-box;margin:0;padding:0}\n' +
    'html,body{max-width:100%;overflow-x:hidden}\n' +
    'body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0a0a0a;color:#fafafa;line-height:1.5}\n' +
    '.container{width:100%;max-width:860px;margin:0 auto;padding:1.5rem 1rem 2.5rem;overflow-x:hidden}\n' +
    '.top{border-bottom:1px solid #262626;margin-bottom:1rem;padding-bottom:1rem}\n' +
    'h1{font-size:clamp(1.6rem,6vw,2.6rem);font-weight:900;text-transform:uppercase;letter-spacing:0;line-height:1;word-break:break-word;overflow-wrap:break-word}\n' +
    '.sub{color:#9ca3af;font-size:.86rem;margin-top:.45rem;word-break:break-word;overflow-wrap:break-word}\n' +
    '.count{display:inline-flex;margin-top:.8rem;background:#c12222;color:#fff;padding:.42rem .68rem;border-radius:6px;font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}\n' +
    '.item{display:grid;grid-template-columns:4.6rem minmax(0,1fr);background:#141414;border:1px solid #262626;border-radius:10px;margin-bottom:.8rem;overflow:hidden}\n' +
    '.rank{background:#c12222;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25rem;padding:.75rem .4rem;text-transform:uppercase;font-weight:900;letter-spacing:.08em}\n' +
    '.rank span{font-size:.56rem}.rank strong{font-size:1.35rem;line-height:1;letter-spacing:0}\n' +
    '.item-body{min-width:0;padding:1rem}\n' +
    '.badges{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.55rem}\n' +
    '.badge{display:inline-flex;background:#202020;border:1px solid #333;color:#facc15;border-radius:999px;padding:.22rem .52rem;font-size:.64rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}\n' +
    '.badge.category{background:#c12222;border-color:#c12222;color:#fff}\n' +
    'h2{font-size:1.05rem;line-height:1.25;font-weight:850;margin-bottom:.45rem;word-break:break-word;overflow-wrap:break-word}\n' +
    '.excerpt{font-size:.9rem;color:#d1d5db;margin-bottom:.75rem;word-break:break-word;overflow-wrap:break-word}\n' +
    'dl{display:grid;gap:.45rem;font-size:.75rem;color:#a3a3a3}\n' +
    'dl div{border-top:1px solid #242424;padding-top:.45rem;min-width:0}\n' +
    'dt{font-size:.62rem;font-weight:900;color:#737373;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.12rem}\n' +
    'dd{word-break:break-word;overflow-wrap:break-word}\n' +
    '.copy{background:#0f0f0f;border:1px solid #333;border-radius:10px;margin-top:1.1rem;padding:1rem}\n' +
    '.copy h2{font-size:.85rem;text-transform:uppercase;letter-spacing:.1em;color:#facc15;margin-bottom:.5rem}\n' +
    'pre{white-space:pre-wrap;word-break:break-word;color:#e5e7eb;font: .78rem/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}\n' +
    '.footer{color:#666;text-align:center;font-size:.72rem;margin-top:2rem;text-transform:uppercase;letter-spacing:.08em}\n' +
    '@media(max-width:520px){.item{grid-template-columns:1fr}.rank{flex-direction:row;justify-content:flex-start}.rank strong{font-size:1rem}.container{padding-inline:.8rem}}\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<main class="container">\n' +
      '<header class="top">\n' +
        '<h1>Seleção do Dia</h1>\n' +
        '<p class="sub">Lista textual para aprovação por número no WhatsApp · Gerada em ' + escapeHtml(formatDate(generatedAt)) + '</p>\n' +
        '<span class="count">' + escapeHtml(items.length) + ' matérias para revisar</span>\n' +
      '</header>\n' +
      cards +
      '<section class="copy">\n' +
        '<h2>Lista para WhatsApp</h2>\n' +
        '<pre>' + escapeHtml(whatsappList) + '</pre>\n' +
      '</section>\n' +
      '<div class="footer">BuzzPop Brasil &copy; ' + new Date().getFullYear() + '</div>\n' +
    '</main>\n' +
    '</body>\n' +
    '</html>\n';
}

function writeSelectionDay(options = {}) {
  const cwd = options.root || root;
  const queue = options.queue || readReviewQueue(path.join(cwd, "data", "review-queue.json"));
  const html = renderSelectionDay(queue);
  const outputDirs = options.outputDirs || [
    path.join(cwd, "public", "final-site", "selecao-dia"),
    path.join(cwd, "docs", "selecao-dia"),
  ];

  for (const outputDir of outputDirs) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "index.html"), html);
  }

  if (options.log !== false) {
    console.log(
      "Selecao do Dia textual gerada: " +
        outputDirs.map((dir) => path.relative(cwd, path.join(dir, "index.html"))).join(", "),
    );
  }
  return { count: selectionItems(queue).length, outputDirs };
}

if (require.main === module) {
  try {
    writeSelectionDay();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { renderSelectionDay, writeSelectionDay };
