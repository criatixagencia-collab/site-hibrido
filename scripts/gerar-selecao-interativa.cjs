#!/usr/bin/env node
/**
 * Gera a pagina oficial de selecao interativa em docs/selecao-interativa/.
 *
 * Entrada:
 * - data/selecao-pronta.json: materias escolhidas com textos completos.
 * - data/review-queue.json: cardapio original, fontes, score e imagens candidatas.
 *
 * Saida:
 * - docs/selecao-interativa/index.html
 * - docs/selecao-interativa/data.json
 * - docs/images/auto/selecao-interativa/* imagens baixadas localmente.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const outputDir = path.join(root, "docs", "selecao-interativa");
const imagesDir = path.join(root, "docs", "images", "auto", "selecao-interativa");
const publicImagePrefix = "../images/auto/selecao-interativa/";

const DEFAULT_TARGET = Number(process.env.CAIQUE_READY_ARTICLES || process.env.SELECTION_TARGET || 8);
const DEFAULT_START = Number(process.env.CAIQUE_READY_START || 0);
const MIN_BODY_CHARS = Number(process.env.SELECTION_MIN_BODY_CHARS || 800);
const MIN_PARAGRAPHS = Number(process.env.SELECTION_MIN_PARAGRAPHS || 3);
const MAX_IMAGES_PER_ITEM = Number(process.env.SELECTION_MAX_IMAGES || 8);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value, fallback) {
  const slug = normalizeKey(value).replace(/\s+/g, "-").slice(0, 90);
  return slug || fallback || "materia";
}

function bodyToParagraphs(body) {
  if (Array.isArray(body)) return body.map((p) => String(p || "").trim()).filter(Boolean);
  return String(body || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
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

function parseArgs(argv) {
  const args = { count: DEFAULT_TARGET, start: DEFAULT_START, items: null };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];
    if (current === "--count" && next) {
      args.count = Number(next);
      i += 1;
    } else if (current === "--start" && next) {
      args.start = Number(next);
      i += 1;
    } else if (current === "--items" && next) {
      args.items = next.split(",").map((part) => Number(part.trim())).filter(Number.isFinite);
      i += 1;
    }
  }
  return args;
}

function selectReadyItems(items, args) {
  if (args.items && args.items.length) {
    const zeroBased = args.items.some((index) => index === 0);
    return args.items
      .map((index) => items[zeroBased ? index : index - 1])
      .filter(Boolean);
  }
  return items.slice(args.start, args.start + args.count);
}

function selectionReviewItems(reviewItems) {
  const pending = reviewItems.filter((item) => item.reviewStatus === "pending-human");
  const items = pending.length ? pending : reviewItems;
  return items.slice().sort((left, right) => {
    const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
    if (scoreDelta) return scoreDelta;
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  });
}

function reviewKeys(item) {
  return [
    item.reviewId,
    item.id,
    item.slug,
    item.title,
    item.buzzpopTitle,
    item.editorialMeta && item.editorialMeta.originalTitle,
  ].filter(Boolean);
}

function buildReviewIndex(reviewItems) {
  const exact = new Map();
  const normalized = [];
  for (const item of reviewItems) {
    for (const key of reviewKeys(item)) {
      exact.set(String(key), item);
      exact.set(normalizeKey(key), item);
    }
    normalized.push({ item, title: normalizeKey(item.title), original: normalizeKey(item.editorialMeta?.originalTitle) });
  }
  return { exact, normalized };
}

function buildReadyIndex(readyItems) {
  const exact = new Map();
  const normalized = [];
  for (const item of readyItems) {
    for (const key of reviewKeys(item)) {
      exact.set(String(key), item);
      exact.set(normalizeKey(key), item);
    }
    const title = normalizeKey(item.title);
    const buzzpopTitle = normalizeKey(item.buzzpopTitle);
    if (title || buzzpopTitle) {
      normalized.push({ item, title, buzzpopTitle });
    }
  }
  return { exact, normalized };
}

function findReviewMatch(item, reviewIndex) {
  const keys = [
    item.reviewId,
    item.id,
    item.slug,
    item.title,
    item.buzzpopTitle,
    item.originalTitle,
  ].filter(Boolean);

  for (const key of keys) {
    const exact = reviewIndex.exact.get(String(key)) || reviewIndex.exact.get(normalizeKey(key));
    if (exact) return exact;
  }

  const title = normalizeKey(item.buzzpopTitle || item.title);
  if (!title) return null;
  return reviewIndex.normalized.find((entry) => {
    return entry.title === title || entry.original === title || entry.title.includes(title) || title.includes(entry.title);
  })?.item || null;
}

function findReadyMatch(reviewItem, readyIndex) {
  const keys = [
    reviewItem.reviewId,
    reviewItem.id,
    reviewItem.slug,
    reviewItem.title,
    reviewItem.editorialMeta && reviewItem.editorialMeta.originalTitle,
  ].filter(Boolean);

  for (const key of keys) {
    const exact = readyIndex.exact.get(String(key)) || readyIndex.exact.get(normalizeKey(key));
    if (exact) return exact;
  }

  const title = normalizeKey(reviewItem.title || reviewItem.editorialMeta?.originalTitle);
  if (!title) return null;
  return readyIndex.normalized.find((entry) => {
    const candidates = [entry.title, entry.buzzpopTitle].filter((candidate) => candidate && candidate.length >= 12);
    return candidates.some((candidate) => {
      return candidate === title || candidate.includes(title) || title.includes(candidate);
    });
  })?.item || null;
}

function reviewBodyText(item) {
  const body = Array.isArray(item.body) ? item.body.join("\n\n") : String(item.body || "");
  const claims = Array.isArray(item.evidenceClaims) ? item.evidenceClaims.filter(Boolean) : [];
  const parts = [
    item.excerpt || body,
    claims.length ? claims.slice(0, 4).join("\n\n") : "",
  ].filter(Boolean);
  return parts.join("\n\n").trim();
}

function fallbackItemFromReview(item, requestedNumber) {
  return {
    ...item,
    id: item.id || item.reviewId || `review-${requestedNumber}`,
    reviewId: item.reviewId || item.id || "",
    title: item.title || "",
    buzzpopTitle: item.title || "",
    buzzpopLine: item.excerpt || "",
    buzzpopBody: reviewBodyText(item),
    categoryHint: item.category || "Entretenimento",
    sources: item.evidenceSources || [item.source].filter(Boolean),
    sourceCount: item.sourceCount || 1,
    __fromReviewQueueFallback: true,
    __requestedNumber: requestedNumber,
  };
}

function selectItemsForInteractive({ readyItems, reviewItems, args, readyIndex }) {
  if (!args.items || !args.items.length) {
    return selectReadyItems(readyItems, args).map((item, index) => ({
      item,
      requestedNumber: args.start + index + 1,
    }));
  }

  const reviewSelection = selectionReviewItems(reviewItems);
  const zeroBased = args.items.some((index) => index === 0);
  return args.items.map((requested) => {
    const position = zeroBased ? requested : requested - 1;
    const reviewItem = reviewSelection[position];
    if (reviewItem) {
      const readyMatch = findReadyMatch(reviewItem, readyIndex);
      if (readyMatch) {
        return { item: readyMatch, reviewItem, requestedNumber: requested };
      }
      return {
        item: fallbackItemFromReview(reviewItem, requested),
        reviewItem,
        requestedNumber: requested,
        usedReviewQueueFallback: true,
      };
    }

    const readyItem = readyItems[position];
    if (readyItem) {
      return { item: readyItem, requestedNumber: requested };
    }

    throw new Error(`Materia ${requested} nao encontrada em selecao-pronta.json nem em review-queue.json.`);
  });
}

function candidateUrl(candidate) {
  if (!candidate) return "";
  if (typeof candidate === "string") return candidate;
  return candidate.imageUrl || candidate.url || candidate.src || "";
}

function candidateCredit(candidate, fallback) {
  if (!candidate || typeof candidate === "string") return fallback || "Imagem pendente de revisao";
  return candidate.credit || candidate.source || candidate.title || fallback || "Imagem pendente de revisao";
}

function normalizeCandidates(item, reviewMatch) {
  const raw = [];
  if (Array.isArray(item?.imageCandidates)) raw.push(...item.imageCandidates);
  if (Array.isArray(item?.images)) raw.push(...item.images);
  if (Array.isArray(reviewMatch?.imageCandidates)) raw.push(...reviewMatch.imageCandidates);
  if (Array.isArray(reviewMatch?.images)) raw.push(...reviewMatch.images);
  if (reviewMatch?.image || reviewMatch?.imageUrl) {
    raw.unshift({
      imageUrl: reviewMatch.image || reviewMatch.imageUrl,
      credit: reviewMatch.imageCredit || reviewMatch.source,
      pageUrl: reviewMatch.sourceUrl,
    });
  }
  if (item.image || item.imageUrl) {
    raw.unshift({
      imageUrl: item.image || item.imageUrl,
      credit: item.imageCredit || item.imageOrigin,
      pageUrl: item.sourceUrl,
    });
  }

  const seen = new Set();
  return raw
    .map((candidate) => ({ candidate, url: candidateUrl(candidate) }))
    .filter(({ url }) => /^https?:\/\//i.test(url) || /^\/?images\/auto\//i.test(url))
    .filter(({ url }) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, MAX_IMAGES_PER_ITEM);
}

function localImageSource(url) {
  const clean = String(url || "").replace(/^\/+/, "");
  if (!clean.startsWith("images/auto/")) return null;
  const candidates = [
    path.join(root, "docs", clean),
    path.join(root, "public", clean),
    path.join(root, "public", "final-site", clean),
  ];
  return candidates.find((filePath) => fs.existsSync(filePath)) || null;
}

function extensionFromContentType(contentType, url) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  const clean = String(url || "").split("?")[0].toLowerCase();
  const ext = path.extname(clean);
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  return ".jpg";
}

async function downloadImage(url, fileBase) {
  const localSource = localImageSource(url);
  if (localSource) {
    const ext = extensionFromContentType("", localSource);
    const fileName = `${fileBase}${ext}`;
    const filePath = path.join(imagesDir, fileName);
    fs.copyFileSync(localSource, filePath);
    return { fileName, localUrl: publicImagePrefix + fileName, bytes: fs.statSync(filePath).size };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CaiqueSelectionBot/1.0)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.toLowerCase().includes("image")) {
      throw new Error(`conteudo nao e imagem (${contentType})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1024) throw new Error("imagem muito pequena ou vazia");
    const ext = extensionFromContentType(contentType, url);
    const fileName = `${fileBase}${ext}`;
    const filePath = path.join(imagesDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return { fileName, localUrl: publicImagePrefix + fileName, bytes: buffer.length };
  } finally {
    clearTimeout(timeout);
  }
}

async function buildImageOptions(item, reviewMatch, slug) {
  const candidates = normalizeCandidates(item, reviewMatch);
  const options = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const { candidate, url } = candidates[index];
    const fileBase = `${slug}-img-${String(index + 1).padStart(2, "0")}`;
    try {
      const local = await downloadImage(url, fileBase);
      options.push({
        url: local.localUrl,
        originalUrl: url,
        pageUrl: typeof candidate === "object" ? candidate.pageUrl || "" : "",
        credit: candidateCredit(candidate, reviewMatch?.imageCredit || reviewMatch?.source),
        source: typeof candidate === "object" ? candidate.source || "" : "",
        title: typeof candidate === "object" ? candidate.title || "" : "",
        bytes: local.bytes,
      });
    } catch (error) {
      console.warn(`Aviso: imagem ignorada para "${item.buzzpopTitle || item.title}": ${url} (${error.message})`);
    }
  }
  return options;
}

function validateCompleteText(item, paragraphs) {
  const body = String(item.buzzpopBody || item.body || "");
  const title = item.buzzpopTitle || item.title || "materia sem titulo";
  if (body.length < MIN_BODY_CHARS || paragraphs.length < MIN_PARAGRAPHS) {
    throw new Error(
      `Texto incompleto para "${title}". ` +
      `Encontrado: ${body.length} caracteres e ${paragraphs.length} paragrafos. ` +
      `Minimo: ${MIN_BODY_CHARS} caracteres e ${MIN_PARAGRAPHS} paragrafos.`,
    );
  }
}

function renderImageOptions(item) {
  if (!item.imageOptions.length) {
    return '<p class="empty-images">Nenhuma imagem local foi baixada para esta materia. Volte ao passo de busca de imagens antes de publicar.</p>';
  }
  return item.imageOptions.map((image, index) => {
    const id = `img_${item.num}_${index}`;
    return (
      '<label class="img-option" for="' + escapeHtml(id) + '">' +
        '<input type="radio" name="img_' + escapeHtml(item.num) + '" id="' + escapeHtml(id) + '" value="' + escapeHtml(index) + '" data-image-index="' + escapeHtml(index) + '">' +
        '<img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(item.imageAlt || item.title) + '" loading="lazy">' +
        '<span class="img-label">Opcao ' + escapeHtml(index + 1) + ' - ' + escapeHtml(image.credit || "Imagem pendente de revisao") + '</span>' +
      '</label>'
    );
  }).join("");
}

function renderHtml(items, generatedAt) {
  const cards = items.map((item) => {
    const bodyHtml = item.bodyParagraphs.map((paragraph) => '<p>' + escapeHtml(paragraph) + '</p>').join("");
    const sources = item.sources.length ? item.sources.join(" / ") : "fontes registradas no review queue";
    return (
      '<article class="card" data-num="' + escapeHtml(item.num) + '" data-review-id="' + escapeHtml(item.reviewId || "") + '" data-slug="' + escapeHtml(item.slug || "") + '" data-title="' + escapeHtml(item.title || "") + '">' +
        '<div class="card-top">' +
          '<span class="num">Materia ' + escapeHtml(String(item.num).padStart(2, "0")) + '</span>' +
          '<span class="badge">' + escapeHtml(item.category) + '</span>' +
          (item.score ? '<span class="badge muted">Score ' + escapeHtml(item.score) + '</span>' : '') +
          '<span class="status-pill" data-role="status-pill">Nao aprovada</span>' +
        '</div>' +
        '<h2>' + escapeHtml(item.title) + '</h2>' +
        '<p class="line">' + escapeHtml(item.excerpt) + '</p>' +
        '<div class="body-text">' + bodyHtml + '</div>' +
        '<p class="sources"><strong>Fontes:</strong> ' + escapeHtml(sources) + '</p>' +
        '<section class="image-block">' +
          '<h3>Escolha a imagem</h3>' +
          '<div class="img-grid">' + renderImageOptions(item) + '</div>' +
        '</section>' +
        '<div class="decision-bar">' +
          '<div class="decision-buttons">' +
            '<button type="button" class="decision-btn approve" data-action="approved">Aprovar</button>' +
            '<button type="button" class="decision-btn clear" data-action="pending">Desfazer aprovacao</button>' +
          '</div>' +
          '<p class="decision-status" data-role="decision-status">Status: nao aprovada</p>' +
        '</div>' +
      '</article>'
    );
  }).join("");

  const script = `
<script>
(function(){
  var storageKey = "site-hibrido-selecao-interativa:" + location.pathname;
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var state = {};

  try {
    state = JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
  } catch (error) {
    state = {};
  }

  function cardKey(card) {
    return card.dataset.reviewId || card.dataset.slug || card.dataset.num;
  }

  function selectedImageLabel(card, decision) {
    if (decision.imageIndex === undefined || decision.imageIndex === null || decision.imageIndex === "") return "sem imagem";
    return "opcao " + (Number(decision.imageIndex) + 1);
  }

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function updateCard(card) {
    var key = cardKey(card);
    var decision = state[key] || { status: "pending" };
    var status = decision.status || "pending";
    var pill = card.querySelector('[data-role="status-pill"]');
    var label = card.querySelector('[data-role="decision-status"]');
    var selected = card.querySelector('input[type="radio"][data-image-index="' + decision.imageIndex + '"]');

    if (status === "rejected") status = "pending";
    card.classList.remove("is-approved", "is-pending");
    card.classList.add(status === "approved" ? "is-approved" : "is-pending");

    if (selected) selected.checked = true;
    if (pill) {
      pill.textContent = status === "approved" ? "Aprovada" : "Nao aprovada";
    }
    if (label) {
      label.textContent = "Status: " + (status === "approved" ? "aprovada" : "nao aprovada") + " - Imagem: " + selectedImageLabel(card, decision);
    }
  }

  function updateSummary() {
    var approved = 0;
    cards.forEach(function(card) {
      var decision = state[cardKey(card)] || {};
      if (decision.status === "approved") approved += 1;
    });
    var rejected = cards.length - approved;
    var summary = document.querySelector('[data-role="summary"]');
    if (summary) {
      summary.textContent = approved + " aprovadas - " + rejected + " rejeitadas automaticamente";
    }
  }

  function setStatus(card, status) {
    var key = cardKey(card);
    var current = state[key] || {};
    state[key] = {
      status: status,
      imageIndex: current.imageIndex,
      title: card.dataset.title || "",
      reviewId: card.dataset.reviewId || "",
      slug: card.dataset.slug || "",
      num: card.dataset.num || "",
      updatedAt: new Date().toISOString()
    };
    if (status === "pending" && state[key].imageIndex === undefined) {
      delete state[key];
    }
    persist();
    updateCard(card);
    updateSummary();
  }

  function setImage(card, imageIndex) {
    var key = cardKey(card);
    var current = state[key] || { status: "pending" };
    var status = current.status === "approved" ? "approved" : "pending";
    state[key] = {
      status: status,
      imageIndex: Number(imageIndex),
      title: card.dataset.title || "",
      reviewId: card.dataset.reviewId || "",
      slug: card.dataset.slug || "",
      num: card.dataset.num || "",
      updatedAt: new Date().toISOString()
    };
    persist();
    updateCard(card);
    updateSummary();
  }

  function decisionsArray() {
    return cards.map(function(card) {
      var key = cardKey(card);
      var decision = state[key] || { status: "pending" };
      var approved = decision.status === "approved";
      return {
        num: Number(card.dataset.num || 0),
        reviewId: card.dataset.reviewId || "",
        slug: card.dataset.slug || "",
        title: card.dataset.title || "",
        status: approved ? "approved" : "rejected",
        approved: approved,
        imageIndex: decision.imageIndex === undefined ? null : Number(decision.imageIndex),
        imageOption: decision.imageIndex === undefined ? "" : "opcao " + (Number(decision.imageIndex) + 1)
      };
    });
  }

  function whatsappText() {
    return decisionsArray().map(function(item) {
      var status = item.approved ? "APROVAR" : "REJEITAR";
      var image = item.imageOption || "sem imagem";
      return item.num + ". " + status + " - " + image + " - " + item.title;
    }).join("\\n");
  }

  function copyText(text, button) {
    navigator.clipboard.writeText(text).then(function() {
      var original = button.textContent;
      button.textContent = "Copiado";
      setTimeout(function(){ button.textContent = original; }, 1400);
    }).catch(function() {
      window.prompt("Copie o texto:", text);
    });
  }

  cards.forEach(function(card) {
    updateCard(card);
    card.addEventListener("click", function(event) {
      var action = event.target && event.target.dataset ? event.target.dataset.action : "";
      if (action) setStatus(card, action);
    });
    card.addEventListener("change", function(event) {
      if (event.target && event.target.matches('input[type="radio"][data-image-index]')) {
        setImage(card, event.target.dataset.imageIndex);
      }
    });
  });

  document.querySelector('[data-action="copy-whatsapp"]')?.addEventListener("click", function(event) {
    copyText(whatsappText(), event.currentTarget);
  });

  document.querySelector('[data-action="copy-json"]')?.addEventListener("click", function(event) {
    copyText(JSON.stringify({ generatedAt: new Date().toISOString(), decisions: decisionsArray() }, null, 2), event.currentTarget);
  });

  document.querySelector('[data-action="clear-all"]')?.addEventListener("click", function() {
    if (!confirm("Limpar todas as decisoes desta pagina?")) return;
    state = {};
    persist();
    cards.forEach(updateCard);
    updateSummary();
  });

  updateSummary();
})();
</script>`;

  return '<!doctype html>\n' +
    '<html lang="pt-BR">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>Selecao Interativa - Site Hibrido</title>\n' +
    '<meta name="description" content="Pagina interativa para aprovacao de materias e escolha de imagens do site hibrido.">\n' +
    '<style>\n' +
    '*,::after,::before{box-sizing:border-box;margin:0;padding:0}\n' +
    ':root{--bg:#0d0b0b;--panel:#171313;--panel-2:#211b1b;--text:#f4eeee;--muted:#b8aaa7;--line:#342a29;--red:#c12222;--yellow:#f0c646;--green:#1f8f55;--green-bg:#13231a}\n' +
    'body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.55}\n' +
    '.container{width:100%;max-width:960px;margin:0 auto;padding:1.4rem 1rem 2.5rem}\n' +
    '.top{border-bottom:1px solid var(--line);margin-bottom:1rem;padding-bottom:1rem}\n' +
    'h1{font-size:clamp(1.7rem,5vw,2.7rem);font-weight:900;text-transform:uppercase;letter-spacing:0;line-height:1}\n' +
    '.sub{color:var(--muted);font-size:.9rem;margin-top:.5rem}\n' +
    '.notice{background:#181313;border:1px solid var(--line);border-radius:8px;color:#e8dddd;margin-top:.9rem;padding:.85rem;font-size:.88rem}\n' +
    '.approval-board{align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:8px;display:flex;gap:.75rem;justify-content:space-between;margin:1rem 0;padding:.75rem;position:sticky;top:.5rem;z-index:10}\n' +
    '.summary{font-size:.86rem;font-weight:850;color:var(--yellow)}\n' +
    '.export-actions{display:flex;flex-wrap:wrap;gap:.45rem;justify-content:flex-end}\n' +
    '.tool-btn{background:#2a2221;border:1px solid #4a3b38;border-radius:6px;color:var(--text);cursor:pointer;font-size:.74rem;font-weight:850;padding:.45rem .6rem;text-transform:uppercase;letter-spacing:.04em}\n' +
    '.tool-btn:hover{background:#352a28}\n' +
    '.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;margin-bottom:1rem;padding:1rem;transition:border-color .18s,background .18s}\n' +
    '.card.is-approved{background:var(--green-bg);border-color:color-mix(in srgb,var(--green) 70%,#fff 0%)}\n' +
    '.card-top{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;margin-bottom:.75rem}\n' +
    '.num{background:var(--red);border-radius:6px;color:#fff;font-size:.72rem;font-weight:900;letter-spacing:.08em;padding:.28rem .55rem;text-transform:uppercase}\n' +
    '.badge,.status-pill{background:#241e1d;border:1px solid #3d3230;border-radius:999px;color:var(--yellow);font-size:.68rem;font-weight:850;letter-spacing:.06em;padding:.22rem .52rem;text-transform:uppercase}\n' +
    '.badge.muted{color:var(--muted)}\n' +
    '.status-pill{margin-left:auto;color:var(--muted)}.is-approved .status-pill{background:#14351f;border-color:#2b7c4a;color:#9df0bc}\n' +
    'h2{font-size:1.25rem;font-weight:850;line-height:1.25;margin-bottom:.45rem;word-break:break-word;overflow-wrap:break-word}\n' +
    '.line{background:#211918;border:1px solid #352928;border-radius:8px;color:#d8cfcc;font-size:.92rem;margin-bottom:.85rem;padding:.65rem .75rem;word-break:break-word;overflow-wrap:break-word}\n' +
    '.body-text{background:var(--panel-2);border-radius:8px;color:#eee5e2;font-size:.95rem;margin:.75rem 0;padding:.9rem}\n' +
    '.body-text p{margin:0 0 1rem}.body-text p:last-child{margin-bottom:0}\n' +
    '.sources{color:var(--muted);font-size:.78rem;margin:.7rem 0 1rem;word-break:break-word;overflow-wrap:break-word}\n' +
    '.image-block h3{color:var(--yellow);font-size:.9rem;margin-bottom:.65rem;text-transform:uppercase;letter-spacing:.07em}\n' +
    '.img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.65rem}\n' +
    '.img-option{background:#100d0d;border:2px solid #332827;border-radius:8px;cursor:pointer;display:block;overflow:hidden;transition:border-color .18s,box-shadow .18s,transform .18s}\n' +
    '.img-option:hover{transform:translateY(-1px)}\n' +
    '.img-option input{height:0;opacity:0;position:absolute;width:0}\n' +
    '.img-option:has(input:checked){border-color:var(--yellow);box-shadow:0 0 0 2px rgba(240,198,70,.25)}\n' +
    '.img-option img{background:#050505;display:block;height:142px;object-fit:cover;width:100%}\n' +
    '.img-label{color:#c7bbb8;display:block;font-size:.7rem;line-height:1.25;padding:.45rem}\n' +
    '.empty-images{border:1px dashed #4b5563;border-radius:8px;color:#fca5a5;font-size:.82rem;padding:.75rem}\n' +
    '.decision-bar{align-items:center;border-top:1px solid var(--line);display:flex;gap:.75rem;justify-content:space-between;margin-top:1rem;padding-top:.9rem}\n' +
    '.decision-buttons{display:flex;flex-wrap:wrap;gap:.45rem}.decision-btn{border:1px solid transparent;border-radius:6px;color:#fff;cursor:pointer;font-size:.78rem;font-weight:900;letter-spacing:.05em;padding:.55rem .72rem;text-transform:uppercase}.decision-btn.approve{background:var(--green)}.decision-btn.clear{background:#312827;border-color:#4d403d;color:#d8cfcc}.decision-btn:hover{filter:brightness(1.08)}\n' +
    '.decision-status{color:#d8cfcc;font-size:.82rem;font-weight:750;text-align:right}\n' +
    '.footer{color:#666;font-size:.72rem;letter-spacing:.08em;margin-top:2rem;text-align:center;text-transform:uppercase}\n' +
    '@media(max-width:680px){.approval-board,.decision-bar{align-items:stretch;flex-direction:column}.export-actions,.decision-buttons{justify-content:stretch}.tool-btn,.decision-btn{flex:1}.decision-status{text-align:left}}\n' +
    '@media(max-width:560px){.container{padding-inline:.75rem}.img-grid{grid-template-columns:1fr 1fr}.img-option img{height:120px}.status-pill{margin-left:0}}\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<main class="container">\n' +
    '<header class="top">\n' +
    '<h1>Selecao Interativa</h1>\n' +
    '<p class="sub">' + escapeHtml(formatDate(generatedAt)) + ' - ' + escapeHtml(items.length) + ' materias com textos completos</p>\n' +
    '<p class="notice">Esta pagina e a Etapa 2: revisar textos completos e escolher imagens. A Etapa 1 continua separada em selecao-dia/.</p>\n' +
    '</header>\n' +
    '<section class="approval-board" aria-label="Resumo da aprovacao">\n' +
    '<strong class="summary" data-role="summary">0 aprovadas - ' + escapeHtml(items.length) + ' rejeitadas automaticamente</strong>\n' +
    '<div class="export-actions">\n' +
    '<button type="button" class="tool-btn" data-action="copy-whatsapp">Copiar WhatsApp</button>\n' +
    '<button type="button" class="tool-btn" data-action="copy-json">Copiar JSON</button>\n' +
    '<button type="button" class="tool-btn" data-action="clear-all">Limpar</button>\n' +
    '</div>\n' +
    '</section>\n' +
    cards +
    '<div class="footer">Site Hibrido &copy; ' + new Date().getFullYear() + '</div>\n' +
    '</main>\n' +
    script + '\n' +
    '</body>\n' +
    '</html>\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selecaoPronta = readJson(path.join(dataDir, "selecao-pronta.json"));
  if (!selecaoPronta || !Array.isArray(selecaoPronta.items) || !selecaoPronta.items.length) {
    throw new Error("data/selecao-pronta.json vazio ou inexistente. Reescreva as materias completas antes de gerar a pagina interativa.");
  }

  const reviewQueue = readJson(path.join(dataDir, "review-queue.json"));
  const reviewItems = Array.isArray(reviewQueue?.items) ? reviewQueue.items : [];
  const readyItems = Array.isArray(selecaoPronta.items) ? selecaoPronta.items : [];
  const reviewIndex = buildReviewIndex(reviewItems);
  const readyIndex = buildReadyIndex(readyItems);
  const selectedEntries = selectItemsForInteractive({ readyItems, reviewItems, args, readyIndex });
  if (!selectedEntries.length) throw new Error("Nenhuma materia selecionada para a pagina interativa.");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(imagesDir, { recursive: true });

  const outputItems = [];
  for (let index = 0; index < selectedEntries.length; index += 1) {
    const entry = selectedEntries[index];
    const item = entry.item;
    const reviewMatch = entry.reviewItem || findReviewMatch(item, reviewIndex) || {};
    const title = item.buzzpopTitle || item.title || reviewMatch.title || "";
    const body = String(item.buzzpopBody || item.body || "");
    const bodyParagraphs = bodyToParagraphs(body);
    if (item.__fromReviewQueueFallback) {
      console.warn(`⚠️ Matéria ${entry.requestedNumber} usou texto do review-queue (não passou pelo rewrite): ${title}`);
    } else {
      validateCompleteText({ ...item, buzzpopBody: body, buzzpopTitle: title }, bodyParagraphs);
    }

    const slug = slugify(item.slug || reviewMatch.slug || title, `materia-${index + 1}`);
    const imageOptions = await buildImageOptions(item, reviewMatch, slug);
    if (!imageOptions.length) {
      throw new Error(
        `Materia "${title}" nao tem nenhuma imagem candidata baixavel. ` +
          "Preencha imageCandidates/images/image em data/selecao-pronta.json ou data/review-queue.json antes de gerar a selecao interativa.",
      );
    }
    const sources = (item.evidenceSources || item.sources || reviewMatch.evidenceSources || [reviewMatch.source]).filter(Boolean);

    outputItems.push({
      num: index + 1,
      id: item.id || reviewMatch.id || "",
      reviewId: item.reviewId || reviewMatch.reviewId || reviewMatch.id || "",
      slug,
      title,
      excerpt: item.buzzpopLine || item.excerpt || reviewMatch.excerpt || "",
      category: item.categoryHint || item.category || reviewMatch.category || "Entretenimento",
      score: Number(reviewMatch.score || item.score || 0),
      body,
      bodyParagraphs,
      sources,
      sourceCount: Number(item.sourceCount || reviewMatch.sourceCount || sources.length || 0),
      imageOptions,
      image: imageOptions[0]?.url || "",
      imageAlt: reviewMatch.imageAlt || item.imageAlt || title,
      rewriteStatus: item.__fromReviewQueueFallback ? "review-queue-fallback" : "complete",
      requestedNumber: entry.requestedNumber,
    });
  }

  const dataJson = {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: selecaoPronta.generatedAt || "",
    mode: "selecao-interativa-oficial",
    items: outputItems.map((item) => ({
      num: item.num,
      id: item.id,
      reviewId: item.reviewId,
      slug: item.slug,
      title: item.title,
      excerpt: item.excerpt,
      category: item.category,
      score: item.score,
      body: item.body,
      sources: item.sources,
      sourceCount: item.sourceCount,
      image: item.image,
      imageAlt: item.imageAlt,
      imageOptions: item.imageOptions,
      rewriteStatus: item.rewriteStatus,
      requestedNumber: item.requestedNumber,
    })),
  };

  fs.writeFileSync(path.join(outputDir, "data.json"), JSON.stringify(dataJson, null, 2), "utf8");
  fs.writeFileSync(path.join(outputDir, "index.html"), renderHtml(outputItems, dataJson.generatedAt), "utf8");

  console.log("Pagina de selecao interativa gerada em docs/selecao-interativa/");
  console.log(`Materias: ${outputItems.length}`);
  console.log(`Imagens locais: ${outputItems.reduce((total, item) => total + item.imageOptions.length, 0)}`);
  for (const item of outputItems) {
    const words = item.body.split(/\s+/).filter(Boolean).length;
    console.log(`#${item.num} ${item.title.slice(0, 62)} - ${item.body.length}c, ${words}p, ${item.bodyParagraphs.length} paragrafos, ${item.imageOptions.length} imagens`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
