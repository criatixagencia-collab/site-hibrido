const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const articlesPath = path.join(root, "data", "articles.json");
const reviewQueuePath = path.join(root, "data", "review-queue.json");
const outputDir = path.join(root, "public", "final-site");
const imagesDir = path.join(root, "public", "images");
const docsImagesDir = path.join(root, "docs", "images");
const MIN_SELECTION_BODY_CHARACTERS = 300;
const HOME_SECTIONS = [
  { key: "famosos", label: "Famosos", aliases: ["famosos", "celebridades", "celebridade", "influenciadores", "influenciador", "famosas"] },
  { key: "musica", label: "Música", aliases: ["musica", "música", "cantor", "cantora", "banda", "bandas"] },
  { key: "tv", label: "TV", aliases: ["tv", "televisao", "televisão", "reality"] },
  { key: "cinema", label: "Cinema", aliases: ["cinema", "filmes", "filme", "streaming"] },
];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readArticles() {
  if (!fs.existsSync(articlesPath)) {
    throw new Error("data/articles.json nao encontrado. Rode npm run hybrid:refresh antes.");
  }
  return JSON.parse(fs.readFileSync(articlesPath, "utf8"));
}

function readReviewSelectionItems(fallbackArticles) {
  if (!fs.existsSync(reviewQueuePath)) return fallbackArticles;
  var queue = JSON.parse(fs.readFileSync(reviewQueuePath, "utf8"));
  var pending = Array.isArray(queue.items)
    ? queue.items.filter(function (item) { return item.reviewStatus === "pending-human"; })
    : [];
  return pending.length ? pending : fallbackArticles;
}

function bodyText(article) {
  return (Array.isArray(article.body) && article.body.length ? article.body : [article.excerpt || ""])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function bodyCharacterCount(article) {
  return bodyText(article).length;
}

function filterSelectionItems(items) {
  var valid = [];
  var rejected = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var characters = bodyCharacterCount(item);
    if (characters >= MIN_SELECTION_BODY_CHARACTERS) {
      valid.push(item);
    } else {
      rejected.push({
        id: item.reviewId || item.id || item.slug || item.title,
        title: item.title,
        characters: characters,
      });
    }
  }

  if (rejected.length) {
    console.warn(
      "Selecao do Dia: " +
        rejected.length +
        " rascunho(s) abaixo de " +
        MIN_SELECTION_BODY_CHARACTERS +
        " caracteres foram ignorados.",
    );
    rejected.forEach(function (item) {
      console.warn(
        "- " +
          item.id +
          ": " +
          item.characters +
          "/" +
          MIN_SELECTION_BODY_CHARACTERS +
          " caracteres | " +
          item.title,
      );
    });
  }

  return valid;
}

function slug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/g, "");
}

function articleSlug(article) {
  return slug(article.slug || article.title);
}

function articleUrl(article, prefix) {
  return prefix + "noticias/" + articleSlug(article) + "/";
}

function popularityLabel(article) {
  var score = article.score || 0;
  var sources = article.sourceCount || 0;
  if (score >= 140 || sources >= 2) return { icon: '🔥', label: 'Muito noticiada', desc: 'Grande repercussão em portais e redes sociais' };
  if (score >= 120) return { icon: '📈', label: 'Em alta', desc: 'Ganhou destaque em diversos veículos' };
  return { icon: '📰', label: 'Em discussão', desc: 'Assunto comentado em canais de entretenimento' };
}

function formatDate(value) {
  var date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) date = new Date();
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function normalizeCategory(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getSectionForArticle(article) {
  var normalized = normalizeCategory(article.category);
  for (var i = 0; i < HOME_SECTIONS.length; i++) {
    if (HOME_SECTIONS[i].aliases.indexOf(normalized) !== -1) return HOME_SECTIONS[i];
  }
  return HOME_SECTIONS[0];
}

function sortArticlesByDate(articles) {
  return articles.slice().sort(function (left, right) {
    var leftDate = new Date(left.createdAt || left.publishedAt || 0).getTime();
    var rightDate = new Date(right.createdAt || right.publishedAt || 0).getTime();
    return rightDate - leftDate;
  });
}

function imageFor(article, prefix) {
  var image = article.image || "/images/news-placeholder.svg";
  if (image.charAt(0) === "/") return prefix + image.slice(1);
  return image;
}

function sourceLabels(article) {
  return (article.evidenceSources || [article.source]).filter(Boolean).slice(0, 4);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
}

function selectionImagePath(article) {
  var image = String(article.image || "");
  if (!image || image === "/images/news-placeholder.svg") return "";
  if (!/^\/?images\/auto\/[^/]+$/i.test(image)) {
    throw new Error(
      "Imagem da selecao precisa ser local em /images/auto/: " +
        (article.title || article.reviewId || article.id || image),
    );
  }
  return image.replace(/^\/+/, "");
}

function ensureSelectionImages(selectionItems) {
  var copied = [];
  var outputImages = path.join(outputDir, "images", "auto");
  fs.mkdirSync(outputImages, { recursive: true });

  for (var i = 0; i < selectionItems.length; i++) {
    var relativeImage = selectionImagePath(selectionItems[i]);
    if (!relativeImage) continue;

    var fileName = path.basename(relativeImage);
    var sourceCandidates = [
      path.join(imagesDir, "auto", fileName),
      path.join(docsImagesDir, "auto", fileName),
    ];
    var source = sourceCandidates.find(function (candidate) {
      return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
    });

    if (!source) {
      throw new Error(
        "Imagem referenciada pela selecao nao foi encontrada: " +
          relativeImage +
          " (" +
          (selectionItems[i].title || selectionItems[i].reviewId || selectionItems[i].id) +
          ")",
      );
    }

    var destination = path.join(outputImages, fileName);
    if (path.resolve(source) !== path.resolve(destination)) {
      fs.copyFileSync(source, destination);
    }
    copied.push(relativeImage);
  }

  console.log(
    "Imagens da selecao verificadas/copiadas: " + new Set(copied).size,
  );
}

function relatedArticles(articles, currentArticle, limit) {
  var currentSlug = articleSlug(currentArticle);
  return articles
    .filter(function (article) {
      return articleSlug(article) !== currentSlug;
    })
    .slice(0, limit);
}

/* ==============================================
   NOVO LAYOUT OFICIAL — BuzzPop
   Baseado no teste-design/index.html
   ============================================== */

function stylesheet() {
  return "<style>\n" +
    "*,::after,::before,::backdrop,::file-selector-button{box-sizing:border-box;margin:0;padding:0;border:0 solid}\n" +
    "html{line-height:1.5;-webkit-text-size-adjust:100%;tab-size:4;font-family:ui-sans-serif,system-ui,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",\"Segoe UI Symbol\",\"Noto Color Emoji\";-webkit-tap-highlight-color:transparent}\n" +
    "html,body{max-width:100%;overflow-x:hidden}\n" +
    "a{color:inherit;text-decoration:inherit}\n" +
    "img,video{max-width:100%;height:auto;display:block;vertical-align:middle}\n" +
    "button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;border-radius:0;background-color:transparent;opacity:1}\n" +
    "ol,ul,menu{list-style:none}\n" +
    "h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}\n" +
    "b,strong{font-weight:bolder}\n" +
    ":root{--spacing:0.25rem;--color-neutral-200:oklch(92.2% 0 0);--color-neutral-300:oklch(87% 0 0);--color-neutral-500:oklch(55.6% 0 0);--color-neutral-950:oklch(14.5% 0 0);--color-black:#000;--text-xs:0.75rem;--text-xs--line-height:calc(1/0.75);--text-sm:0.875rem;--text-sm--line-height:calc(1.25/0.875);--text-base:1rem;--text-base--line-height:calc(1.5/1);--text-lg:1.125rem;--text-lg--line-height:calc(1.75/1.125);--text-4xl:2.25rem;--text-4xl--line-height:calc(2.5/2.25);--text-6xl:3.75rem;--text-6xl--line-height:1;--font-weight-bold:700;--font-weight-black:900;--tracking-normal:0em;--tracking-wide:0.025em;--tracking-widest:0.1em;--default-transition-duration:150ms;--default-transition-timing-function:cubic-bezier(0.4,0,0.2,1);--background:oklch(0 0 0);--foreground:oklch(0.98 0 0);--primary:oklch(0.62 0.22 25);--primary-foreground:oklch(0.98 0 0);--secondary:oklch(0.18 0 0);--muted-foreground:oklch(0.7 0 0);--border:oklch(0.22 0 0);--nav:oklch(0 0 0);--nav-foreground:oklch(0.98 0 0);--nav-accent:oklch(0.62 0.22 25);--nav-hover:oklch(0.18 0 0);--nav-border:oklch(0.22 0 0)}\n" +
    ".min-h-screen{min-height:100vh;overflow-x:hidden}.bg-background{background-color:var(--background)}.bg-nav{background-color:var(--nav)}.bg-primary{background-color:var(--primary)}.bg-secondary{background-color:var(--secondary)}.text-foreground{color:var(--foreground)}.text-primary{color:var(--primary)}.text-primary-foreground{color:var(--primary-foreground)}.text-muted-foreground{color:var(--muted-foreground)}.text-nav-foreground{color:var(--nav-foreground)}.text-nav-accent{color:var(--nav-accent)}.text-neutral-950{color:var(--color-neutral-950)}.text-neutral-500{color:var(--color-neutral-500)}.border-neutral-300{border-color:var(--nav-border)}.border-border{border-color:var(--border)}.border-border\\/70{border-color:color-mix(in oklab,var(--border) 70%,transparent)}.border-b{border-bottom-width:1px;border-bottom-style:solid}.border-t{border-top-width:1px;border-top-style:solid}.sticky{position:sticky}.top-0{top:0}.z-50{z-index:50}.w-full{width:100%}.max-w-\\[1040px\\]{max-width:1040px}.mx-auto{margin-inline:auto}.flex{display:flex}.inline-flex{display:inline-flex}.contents{display:contents}.flex-col{flex-direction:column}.items-center{align-items:center}.items-start{align-items:flex-start}.justify-between{justify-content:space-between}.gap-2{gap:calc(var(--spacing)*2)}.gap-5{gap:calc(var(--spacing)*5)}.h-16{height:calc(var(--spacing)*16)}.h-5{height:calc(var(--spacing)*5)}.h-7{height:calc(var(--spacing)*7)}.h-11{height:calc(var(--spacing)*11)}.h-12{height:calc(var(--spacing)*12)}.w-5{width:calc(var(--spacing)*5)}.w-7{width:calc(var(--spacing)*7)}.w-11{width:calc(var(--spacing)*11)}.px-2{padding-inline:calc(var(--spacing)*2)}.px-3{padding-inline:calc(var(--spacing)*3)}.px-4{padding-inline:calc(var(--spacing)*4)}.px-5{padding-inline:calc(var(--spacing)*5)}.py-1{padding-block:calc(var(--spacing)*1)}.py-2{padding-block:calc(var(--spacing)*2)}.py-8{padding-block:calc(var(--spacing)*8)}.pt-2{padding-top:calc(var(--spacing)*2)}.pt-8{padding-top:calc(var(--spacing)*8)}.pb-10{padding-bottom:calc(var(--spacing)*10)}.mb-3{margin-bottom:calc(var(--spacing)*3)}.mt-5{margin-top:calc(var(--spacing)*5)}.mt-7{margin-top:calc(var(--spacing)*7)}.mt-8{margin-top:calc(var(--spacing)*8)}.text-center{text-align:center}.text-left{text-align:left}.text-xs{font-size:var(--text-xs);line-height:var(--text-xs--line-height)}.text-sm{font-size:var(--text-sm);line-height:var(--text-sm--line-height)}.text-lg{font-size:var(--text-lg);line-height:var(--text-lg--line-height)}.text-4xl{font-size:var(--text-4xl);line-height:var(--text-4xl--line-height)}.text-\\[11px\\]{font-size:11px}.text-\\[clamp\\(2\\.35rem\\,9\\.2vw\\,4\\.75rem\\)\\]{font-size:clamp(2.35rem,9.2vw,4.75rem)}.font-black{font-weight:var(--font-weight-black)}.font-bold{font-weight:var(--font-weight-bold)}.uppercase{text-transform:uppercase}.leading-none{line-height:1}.leading-\\[0\\.9\\]{line-height:0.9}.tracking-normal{letter-spacing:var(--tracking-normal)}.tracking-wide{letter-spacing:var(--tracking-wide)}.tracking-\\[0\\.14em\\]{letter-spacing:0.14em}.tracking-\\[0\\.16em\\]{letter-spacing:0.16em}.tracking-\\[0\\.18em\\]{letter-spacing:0.18em}.tracking-widest{letter-spacing:var(--tracking-widest)}.shrink-0{flex-shrink:0}.whitespace-nowrap{white-space:nowrap}.relative{position:relative}.hidden{display:none}.block{display:block}.overflow-x-auto{overflow-x:auto}.hover\\:text-nav-accent:hover{color:var(--nav-accent)}.hover\\:bg-nav-hover:hover{background-color:var(--nav-hover)}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke;transition-timing-function:var(--default-transition-timing-function);transition-duration:var(--default-transition-duration)}.space-y-2>:not(:last-child){margin-block-start:calc(calc(var(--spacing)*2)*var(--tw-space-y-reverse,0));margin-block-end:calc(calc(var(--spacing)*2)*calc(1-var(--tw-space-y-reverse,0)))}.max-w-\\[13ch\\]{max-width:min(13ch,100%);overflow-wrap:break-word}.font-\\[Impact\\,Haettenschweiler\\,\\'Arial_Narrow_Bold\\'\\,sans-serif\\]{font-family:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif}.object-contain{object-fit:contain}.grayscale-\\[15\\%\\]{filter:grayscale(15%)}.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}\n" +
    "header>div:first-child{position:relative}header>div:first-child>a{position:absolute;left:50%;transform:translateX(-50%)}.brand-logo{display:block;line-height:0}.brand-logo-mobile{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:.18rem;font-family:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;text-align:center;text-transform:uppercase;letter-spacing:0}.brand-logo-mobile-main{font-size:1.85rem;line-height:.82;color:var(--foreground)}.brand-logo-mobile-tag{display:inline-flex;align-items:center;justify-content:center;padding:.2rem .45rem .14rem;background:var(--primary);color:var(--color-black);font-size:.64rem;line-height:1;font-weight:900;letter-spacing:.12em;border-radius:2px}.brand-logo-desktop{display:none;width:176px;height:3.625rem;overflow:hidden}.brand-logo-desktop picture,.brand-logo-desktop img{display:block;width:100%;height:100%}.brand-logo-desktop img{object-fit:cover;object-position:center}.story-excerpt{max-width:38rem;margin-top:calc(var(--spacing)*4);font-size:.92rem;line-height:1.45;text-transform:none;letter-spacing:0;color:var(--muted-foreground)}.article-copy p{margin-bottom:1rem}.related-wrap{border-top:1px solid var(--border);padding:2rem 1rem 0}.related-grid{display:grid;gap:1rem}.related-block{border:1px solid var(--border);padding:1rem}.related-title{margin-bottom:1rem;font-size:.75rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:var(--primary)}.related-link{display:block;border-top:1px solid var(--border);padding:.9rem 0}.related-link:first-of-type{border-top:0;padding-top:0}.related-link span{display:block;margin-bottom:.35rem;font-size:.68rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-foreground)}.related-link strong{font-size:1rem;line-height:1.15;color:var(--foreground)}\n" +
    "@media(min-width:48rem){header>div:first-child>a{position:static;transform:none}.brand-logo-mobile{display:none}.brand-logo-desktop{display:block}.md\\:bg-\\[\\#f7f4ee\\]{background-color:#f7f4ee}.md\\:text-neutral-950{color:var(--color-neutral-950)}.md\\:text-neutral-500{color:var(--color-neutral-500)}.md\\:border-neutral-300{border-color:var(--color-neutral-300)}.md\\:h-20{height:calc(var(--spacing)*20)}.md\\:px-6{padding-inline:calc(var(--spacing)*6)}.md\\:hidden{display:none}.md\\:block{display:block}.md\\:grid{display:grid}.md\\:text-6xl{font-size:var(--text-6xl);line-height:var(--text-6xl--line-height)}.md\\:text-base{font-size:var(--text-base);line-height:var(--text-base--line-height)}.md\\:text-\\[clamp\\(3\\.2rem\\,4\\.8vw\\,5\\.4rem\\)\\]{font-size:clamp(3.2rem,4.8vw,5.4rem)}.md\\:max-w-\\[11ch\\]{max-width:11ch}.md\\:grid-cols-\\[minmax\\(0\\,1fr\\)_360px\\]{grid-template-columns:minmax(0,1fr) 360px}.md\\:gap-8{gap:calc(var(--spacing)*8)}.md\\:items-start{align-items:flex-start}.md\\:text-left{text-align:left}.md\\:px-0{padding-inline:0}.md\\:pt-10{padding-top:calc(var(--spacing)*10)}.md\\:pb-12{padding-bottom:calc(var(--spacing)*12)}.md\\:mt-0{margin-top:0}.md\\:aspect-auto{aspect-ratio:auto}.md\\:bg-transparent{background-color:transparent}.md\\:overflow-visible{overflow:visible}.md\\:relative{position:relative}.md\\:inset-auto{inset:auto}.md\\:h-auto{height:auto}.md\\:w-full{width:100%}.md\\:object-contain{object-fit:contain}.md\\:grayscale-0{filter:grayscale(0%)}.md\\:hover\\:bg-neutral-200:hover{background-color:var(--color-neutral-200)}.story-excerpt{max-width:34rem;font-size:.94rem;line-height:1.42;color:var(--color-neutral-500)}.article-copy p{font-size:1.05rem;line-height:1.7}.related-wrap{border-color:var(--color-neutral-300);padding:2.5rem 1.5rem 0}.related-grid{grid-template-columns:1fr 1fr;gap:1.5rem}.related-block{border-color:var(--color-neutral-300)}.related-link{border-color:var(--color-neutral-300)}.related-link strong{color:var(--color-neutral-950)}}\n" +
    "@media(min-width:64rem){.lg\\:grid-cols-\\[minmax\\(0\\,1fr\\)_430px\\]{grid-template-columns:minmax(0,1fr) 430px}}\n" +
    "</style>";
}

function pageShell(opts) {
  var title = opts.title;
  var description = opts.description;
  var body = opts.body;
  var prefix = opts.prefix || "";
  return "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n  <title>" + escapeHtml(title) + "</title>\n  <meta name=\"description\" content=\"" + escapeHtml(description) + "\">\n  <link rel=\"icon\" href=\"" + prefix + "images/news-placeholder.svg\" type=\"image/svg+xml\">\n  " + stylesheet() + "\n</head>\n<body>\n  <div class=\"min-h-screen bg-background md:bg-[#f7f4ee]\">\n    <header class=\"sticky top-0 z-50 w-full border-b border-neutral-300 bg-nav text-nav-foreground md:bg-[#f7f4ee] md:text-neutral-950\">\n      <div class=\"mx-auto flex h-16 max-w-[1040px] items-center justify-between px-3 md:h-20 md:px-6\">\n        <button type=\"button\" aria-label=\"Abrir menu\" class=\"inline-flex h-11 w-11 items-center justify-center hover:bg-nav-hover md:hidden\">\n          <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"h-7 w-7\"><path d=\"M4 5h16\"></path><path d=\"M4 12h16\"></path><path d=\"M4 19h16\"></path></svg>\n        </button>\n        <a href=\"" + prefix + "index.html\" aria-label=\"BuzzPop Brasil\"><span class=\"brand-logo\"><span class=\"brand-logo-mobile\" aria-hidden=\"true\"><span class=\"brand-logo-mobile-main\">BuzzPop</span><span class=\"brand-logo-mobile-tag\">Brasil</span></span><span class=\"brand-logo-desktop\" aria-hidden=\"true\"><picture><source media=\"(min-width: 768px)\" srcset=\"" + prefix + "images/buzzpop-logo-desktop.png\"><img src=\"" + prefix + "images/buzzpop-logo-compact.png\" alt=\"\"></picture></span></span></a>\n        <nav aria-label=\"Categorias\" class=\"hidden md:block\">\n          <ul class=\"flex items-center gap-5\">\n            <li><a href=\"" + prefix + "index.html#famosos\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">Famosos</a></li>\n            <li><a href=\"" + prefix + "index.html#musica\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">M\u00fasica</a></li>\n            <li><a href=\"" + prefix + "index.html#tv\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">TV</a></li>\n            <li><a href=\"" + prefix + "index.html#cinema\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">Cinema</a></li>\n          </ul>\n        </nav>\n        <button type=\"button\" aria-label=\"Buscar\" class=\"inline-flex h-11 w-11 items-center justify-center hover:bg-nav-hover md:hover:bg-neutral-200\">\n          <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"h-5 w-5\"><path d=\"m21 21-4.34-4.34\"></path><circle cx=\"11\" cy=\"11\" r=\"8\"></circle></svg>\n        </button>\n      </div>\n      <div class=\"border-t border-neutral-300 md:hidden\">\n        <ul class=\"flex gap-1 overflow-x-auto px-2 py-2 scrollbar-hide\">\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html#famosos\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide text-nav-foreground hover:text-nav-accent\">Famosos</a></li>\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html#musica\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide text-nav-foreground hover:text-nav-accent\">M\u00fasica</a></li>\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html#tv\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide text-nav-foreground hover:text-nav-accent\">TV</a></li>\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html#cinema\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide text-nav-foreground hover:text-nav-accent\">Cinema</a></li>\n        </ul>\n      </div>\n    </header>\n    " + body + "\n    <div class=\"h-12\" aria-hidden=\"true\"></div>\n    <div class=\"py-8 text-center text-xs uppercase tracking-widest text-muted-foreground md:bg-[#f7f4ee] md:text-neutral-500\">BuzzPop Brasil &copy; " + new Date().getFullYear() + " &mdash; <a href=\"" + prefix + "selecao-dia/\" style=\"color:var(--primary);text-decoration:underline\">Seleção do Dia</a> &mdash; Entretenimento agora</div>\n  </div>\n</body>\n</html>";
}

function renderCard(article, index, prefix) {
  if (!prefix) prefix = "";
  var category = article.category || "Entretenimento";
  var imageCredit = article.imageCredit || "Imagem ilustrativa";
  var loading = index === 0 ? "eager" : "lazy";
  var dateFormatted = formatDate(article.createdAt);
  var imgSrc = escapeHtml(imageFor(article, prefix));
  var imgAlt = escapeHtml(article.imageAlt || article.title);

  return "<article class=\"border-b border-border/70 bg-background pb-10 pt-8 md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-8 md:bg-[#f7f4ee] md:px-6 md:pb-12 md:pt-10 lg:grid-cols-[minmax(0,1fr)_430px]\">\n" +
    "    <a href=\"" + escapeHtml(articleUrl(article, prefix)) + "\" class=\"contents\">\n" +
    "      <div class=\"flex flex-col items-center px-4 text-center md:items-start md:px-0 md:text-left\">\n" +
    "        <p class=\"mb-3 inline-flex bg-primary px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary-foreground\">" + escapeHtml(category) + "</p>\n" +
    "        <h2 class=\"max-w-[13ch] font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-[clamp(2.35rem,9.2vw,4.75rem)] font-black uppercase leading-[0.9] tracking-normal text-foreground md:max-w-[11ch] md:text-[clamp(3.2rem,4.8vw,5.4rem)] md:text-neutral-950\">" + escapeHtml(article.title) + "</h2>\n" +
    "        <p class=\"story-excerpt\">" + escapeHtml(article.excerpt) + "</p>\n" +
    "        <div class=\"mt-7 space-y-2 text-sm uppercase tracking-[0.16em] text-muted-foreground md:text-base md:text-neutral-500\">\n" +
    "          <p>By <span class=\"font-bold text-primary\">BuzzPop Staff</span></p>\n" +
    "          <p>" + escapeHtml(dateFormatted) + "</p>\n" +
    "        </div>\n" +
    "        <span class=\"mt-5 inline-flex items-center gap-2 text-lg font-bold text-primary\">\n" +
    "          <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"h-5 w-5 text-muted-foreground md:text-neutral-500\"><path d=\"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719\"></path></svg>\n" +
    "          Coment\u00e1rios\n" +
    "        </span>\n" +
    "      </div>\n" +
    "      <figure class=\"mt-8 md:mt-0\">\n" +
    "        <div class=\"relative bg-secondary md:aspect-auto md:bg-transparent md:overflow-visible\">\n" +
    "          <img src=\"" + imgSrc + "\" alt=\"" + imgAlt + "\" width=\"1024\" height=\"1280\" loading=\"" + loading + "\" class=\"relative h-auto w-full object-contain md:relative md:inset-auto md:h-auto md:w-full md:object-contain grayscale-[15%] md:grayscale-0\" style=\"object-position:center center\">\n" +
    "        </div>\n" +
    "        <figcaption class=\"px-4 pt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:px-0 md:text-neutral-500\">" + escapeHtml(imageCredit) + "</figcaption>\n" +
    "      </figure>\n" +
    "    </a>\n" +
    "  </article>";
}

function renderHome(articles) {
  var sortedArticles = sortArticlesByDate(articles);
  var cards = "";

  for (var sectionIndex = 0; sectionIndex < HOME_SECTIONS.length; sectionIndex++) {
    var section = HOME_SECTIONS[sectionIndex];
    var sectionArticles = sortedArticles.filter(function (article) {
      return getSectionForArticle(article).key === section.key;
    });

    cards += "<section id=\"" + escapeHtml(section.key) + "\" class=\"px-4 pt-8 md:px-6 md:pt-10\">\n" +
      "        <div class=\"border-b border-neutral-300 pb-3 md:pb-4\">\n" +
      "          <p class=\"text-xs font-black uppercase tracking-[0.18em] text-primary\">" + escapeHtml(section.label) + "</p>\n" +
      "        </div>\n" +
      "      </section>\n";

    if (!sectionArticles.length) {
      cards += "<section class=\"border-b border-border/70 bg-background px-4 pb-10 pt-5 md:bg-[#f7f4ee] md:px-6 md:pb-12\">\n" +
        "        <p class=\"text-sm uppercase tracking-[0.16em] text-muted-foreground md:text-base md:text-neutral-500\">Em atualizacao editorial.</p>\n" +
        "      </section>\n";
      continue;
    }

    for (var articleIndex = 0; articleIndex < sectionArticles.length; articleIndex++) {
      cards += renderCard(sectionArticles[articleIndex], articleIndex, "");
    }
  }

  var body = "<main>\n    <div class=\"mx-auto flex w-full max-w-[1040px] flex-col bg-background md:bg-[#f7f4ee]\">\n      " + cards + "\n    </div>\n  </main>";
  return pageShell({
    title: "BuzzPop - Entretenimento agora",
    description: "BuzzPop re\u00fane not\u00edcias r\u00e1pidas de famosos, m\u00fasica, TV e cinema.",
    body: body,
  });
}

function renderArticlePage(article, allArticles) {
  var prefix = "../../";
  var body = article.body && article.body.length ? article.body : [article.excerpt];
  var sources = sourceLabels(article);
  var dateFormatted = formatDate(article.createdAt);
  var category = article.category || "Entretenimento";
  var imageCredit = article.imageCredit || "Imagem ilustrativa";
  var imgSrc = escapeHtml(imageFor(article, prefix));
  var imgAlt = escapeHtml(article.imageAlt || article.title);

  var bodyHtml = "";
  for (var i = 0; i < body.length; i++) {
    bodyHtml += "<p>" + escapeHtml(body[i]) + "</p>\n              ";
  }

  var sourcesHtml = "";
  for (var j = 0; j < sources.length; j++) {
    if (j > 0) sourcesHtml += " / ";
    sourcesHtml += escapeHtml(sources[j]);
  }

  function renderRelatedBlock(title, articles) {
    var links = "";
    for (var k = 0; k < articles.length; k++) {
      links += "<a class=\"related-link\" href=\"" + escapeHtml(articleUrl(articles[k], prefix)) + "\">\n" +
        "                <span>" + escapeHtml(articles[k].category || "Entretenimento") + "</span>\n" +
        "                <strong>" + escapeHtml(articles[k].title) + "</strong>\n" +
        "              </a>\n";
    }
    return "<section class=\"related-block\">\n" +
      "              <h2 class=\"related-title\">" + escapeHtml(title) + "</h2>\n" +
      "              " + links +
      "            </section>";
  }

  var mostViewed = relatedArticles(allArticles, article, 5);
  var mostRead = relatedArticles(allArticles.slice().reverse(), article, 5);

  var pageBody = "<main>\n    <div class=\"mx-auto flex w-full max-w-[1040px] flex-col bg-background md:bg-[#f7f4ee]\">\n      <article class=\"px-4 py-8 md:px-6 md:py-10\">\n        <div class=\"md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-8 lg:grid-cols-[minmax(0,1fr)_430px]\">\n          <div>\n            <p class=\"mb-3 inline-flex bg-primary px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary-foreground\">" + escapeHtml(category) + "</p>\n            <h1 class=\"max-w-[13ch] font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-[clamp(2.35rem,9.2vw,4.75rem)] font-black uppercase leading-[0.9] tracking-normal text-foreground md:max-w-[11ch] md:text-[clamp(3.2rem,4.8vw,5.4rem)] md:text-neutral-950\">" + escapeHtml(article.title) + "</h1>\n            <div class=\"mt-7 space-y-2 text-sm uppercase tracking-[0.16em] text-muted-foreground md:text-base md:text-neutral-500\">\n              <p>By <span class=\"font-bold text-primary\">BuzzPop Staff</span></p>\n              <p>" + escapeHtml(dateFormatted) + "</p>\n            </div>\n            <div class=\"mt-8 space-y-4 text-base leading-relaxed text-foreground md:text-neutral-950\">\n              " + bodyHtml + "\n            </div>\n            <footer class=\"mt-8 border-t border-border/70 pt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground md:text-neutral-500\">\n              <p>Fontes: " + sourcesHtml + "</p>\n            </footer>\n          </div>\n          <figure class=\"mt-8 md:mt-0\">\n            <div class=\"relative bg-secondary md:aspect-auto md:bg-transparent md:overflow-visible\">\n              <img src=\"" + imgSrc + "\" alt=\"" + imgAlt + "\" width=\"1024\" height=\"1280\" loading=\"eager\" class=\"relative h-auto w-full object-contain md:relative md:inset-auto md:h-auto md:w-full md:object-contain grayscale-[15%] md:grayscale-0\" style=\"object-position:center center\">\n            </div>\n            <figcaption class=\"px-4 pt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:px-0 md:text-neutral-500\">" + escapeHtml(imageCredit) + "</figcaption>\n          </figure>\n        </div>\n      </article>\n      <div class=\"related-wrap\">\n        <div class=\"related-grid\">\n          " + renderRelatedBlock("Mais vistas do dia", mostViewed) + "\n          " + renderRelatedBlock("Mais lidas do dia", mostRead) + "\n        </div>\n      </div>\n    </div>\n  </main>";

  return pageShell({
    title: article.title + " - BuzzPop",
    description: article.excerpt,
    body: pageBody,
    prefix: prefix,
  });
}

function renderSelectionPage(articles) {
  var selectionItems = filterSelectionItems(readReviewSelectionItems(articles));
  ensureSelectionImages(selectionItems);
  var isReviewQueue = selectionItems !== articles;
  var sorted = selectionItems.slice().sort(function (l, r) {
    return (r.score || 0) - (l.score || 0);
  });
  var selectionTotal = sorted.length;
  var items = '';
  for (var i = 0; i < sorted.length; i++) {
    var a = sorted[i];
    var pop = popularityLabel(a);
    var num = (i + 1) + '.';
    var rankLabel = String(i + 1).padStart(2, '0');
    var sourceHtml = a.html ? a.html.match(/<p class="article-sources"[^>]*>([\s\S]*?)<\/p>/i) : null;
    var sourceText = sourceHtml ? sourceHtml[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : (a.source || '');
    var date = formatDate(a.createdAt);
    var selectionImage = selectionImagePath(a);
    var imgSrc = selectionImage ? ('../' + selectionImage) : '';
    var imgCredit = a.imageCredit || '';
    var imageSource = a.imagePolicy || '';
    var titleHtml = isReviewQueue
      ? '<strong class="card-title"><span class="card-num">' + escapeHtml(num) + '</span> ' + escapeHtml(a.title) + '</strong>'
      : '<a href="../noticias/' + articleSlug(a) + '/" class="card-title"><span class="card-num">' + escapeHtml(num) + '</span> ' + escapeHtml(a.title) + '</a>';
    var bodyHtml = Array.isArray(a.body) && a.body.length
      ? '<div class="draft-body">' + a.body.map(function (paragraph) {
          return '<p>' + escapeHtml(paragraph) + '</p>';
        }).join('') + '</div>'
      : '';
    var reviewId = a.reviewId || a.id || '';
    var evidence = Array.isArray(a.evidenceSources) && a.evidenceSources.length
      ? a.evidenceSources.join(' / ')
      : sourceText;
    items +=
      '<div class="card">' +
        '<div class="selection-rank"><span>Mat\u00e9ria</span><strong>' + escapeHtml(rankLabel) + '</strong><em>de ' + escapeHtml(selectionTotal) + '</em></div>' +
        (imgSrc ? '<div class="card-image"><img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(a.title) + '" loading="lazy"><p class="img-credit">Cr\u00e9dito: ' + escapeHtml(imgCredit) + '</p></div>' : '') +
        '<div class="card-body">' +
          '<div class="card-header">' +
            '<span class="badge cat-badge">' + escapeHtml(a.category || 'Entretenimento') + '</span>' +
            '<span class="badge pop-badge">' + pop.icon + ' ' + pop.label + '</span>' +
          '</div>' +
          titleHtml +
          '<p class="card-excerpt">' + escapeHtml(a.excerpt) + '</p>' +
          bodyHtml +
          '<p class="card-meta">' + escapeHtml(date) + ' \u00b7 ' + escapeHtml(a.market || 'brasil') + '</p>' +
          '<div class="card-tags">' +
            (Array.isArray(a.tags) ? a.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') : '') +
          '</div>' +
          (reviewId ? '<p class="card-source"><strong>ID de aprovação:</strong> ' + escapeHtml(reviewId) + '</p>' : '') +
          '<p class="card-source"><strong>Fontes:</strong> ' + escapeHtml(evidence) + '</p>' +
          (a.sourceUrl ? '<p class="card-source"><strong>Link principal:</strong> <a href="' + escapeHtml(a.sourceUrl) + '">' + escapeHtml(a.source || a.sourceUrl) + '</a></p>' : '') +
          (imgCredit ? '<p class="card-source"><strong>Cr\u00e9dito da imagem:</strong> ' + escapeHtml(imgCredit) + '</p>' : '') +
          (imageSource ? '<p class="card-source"><strong>Origem da imagem:</strong> ' + escapeHtml(imageSource) + '</p>' : '') +
        '</div>' +
      '</div>';
  }

  var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seleção do Dia — BuzzPop</title><meta name="description" content="As notícias mais quentes do entretenimento brasileiro selecionadas pela BuzzPop.">' +
    '<style>' +
    '*,::after,::before{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#fafafa;line-height:1.5}' +
    '.container{max-width:720px;margin:0 auto;padding:1.5rem 1rem}' +
    '.page-title{font-size:clamp(1.5rem,5vw,2.2rem);font-weight:900;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.25rem}' +
    '.page-sub{color:#888;font-size:0.85rem;margin-bottom:2rem;border-bottom:1px solid #222;padding-bottom:1rem}' +
    '.page-count{display:inline-flex;align-items:center;gap:.45rem;margin:.75rem 0 0;padding:.45rem .7rem;background:#171717;border:1px solid #2a2a2a;border-radius:8px;color:#fafafa;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}' +
    '.page-count strong{color:#facc15;font-size:.9rem}' +
    '.card{background:#141414;border:1px solid #222;border-radius:12px;margin-bottom:1.25rem;overflow:hidden}' +
    '.selection-rank{display:flex;align-items:center;gap:.55rem;background:#c12222;color:#fff;padding:.65rem .85rem;text-transform:uppercase;letter-spacing:.12em;font-size:.68rem;font-weight:900}' +
    '.selection-rank strong{display:inline-flex;align-items:center;justify-content:center;min-width:2.35rem;height:2.05rem;background:#fff;color:#c12222;border-radius:6px;font-size:1.08rem;letter-spacing:0}' +
    '.selection-rank em{font-style:normal;color:#ffd8d8;letter-spacing:.08em}' +
    '.card-body{padding:1.2rem}' +
    '.card-header{display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem}' +
    '.badge{font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;padding:0.25rem 0.6rem;border-radius:999px}' +
    '.cat-badge{background:#c12222;color:#fff}' +
    '.pop-badge{background:#1a1a1a;border:1px solid #333;color:#facc15}' +
    '.card-title{display:block;font-size:1.1rem;font-weight:700;color:#fafafa;text-decoration:none;line-height:1.3;margin-bottom:0.5rem}.card-num{display:inline-flex;align-items:center;justify-content:center;width:1.6rem;height:1.6rem;background:#c12222;color:#fff;border-radius:6px;font-size:0.78rem;font-weight:900;margin-right:0.5rem;flex-shrink:0}' +
    '.card-title:hover{color:#facc15}' +
    '.card-excerpt{font-size:0.88rem;color:#aaa;margin-bottom:0.6rem}' +
    '.card-meta{font-size:0.72rem;color:#666;margin-bottom:0.6rem}' +
    '.draft-body{margin:0.9rem 0;color:#ddd;font-size:0.92rem}.draft-body p{margin:0 0 0.7rem}' +
    '.card-tags{display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.75rem}' +
    '.tag{font-size:0.65rem;background:#222;padding:0.2rem 0.5rem;border-radius:6px;color:#ccc}' +
    '.card-source{font-size:0.72rem;color:#777;border-top:1px solid #222;padding-top:0.75rem}' +
    '.card-source a{color:#facc15}.card-image{position:relative}.card-image img{display:block;width:100%;max-height:260px;object-fit:cover}.img-credit{font-size:0.65rem;color:#888;padding:0.3rem 0.75rem;text-align:right;border-bottom:1px solid #222;margin:0}' +
    '.footer{text-align:center;padding:2rem 0;font-size:0.75rem;color:#555}' +
    '@media(min-width:600px){.card-body{padding:1.5rem}.card-title{font-size:1.2rem}}' +
    '</style></head><body>' +
    '<div class="container">' +
      '<h1 class="page-title">📋 Seleção do Dia</h1>' +
      '<p class="page-sub">As notícias mais quentes do entretenimento brasileiro · ' + formatDate(new Date().toISOString()) + ' · <a href="../index.html" style="color:#facc15">Ir para BuzzPop</a><br><span class="page-count"><strong>' + escapeHtml(selectionTotal) + '</strong> matérias na seleção de hoje</span></p>' +
      items +
      '<div class="footer">BuzzPop Brasil &copy; ' + new Date().getFullYear() + ' — Entretenimento agora · <a href="../index.html" style="color:#facc15">BuzzPop</a></div>' +
    '</div></body></html>';

  var selDir = path.join(outputDir, "selecao-dia");
  fs.mkdirSync(selDir, { recursive: true });
  fs.writeFileSync(path.join(selDir, "index.html"), html);
  console.log("Pagina de selecao do dia: " + selDir + "/index.html");
}

function writeFinalSite(articles) {
  fs.mkdirSync(outputDir, { recursive: true });
  copyDir(imagesDir, path.join(outputDir, "images"));
  fs.writeFileSync(path.join(outputDir, "index.html"), renderHome(articles));

  for (var i = 0; i < articles.length; i++) {
    var dir = path.join(outputDir, "noticias", articleSlug(articles[i]));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderArticlePage(articles[i], articles));
  }
  
  renderSelectionPage(articles);
}

var articles = readArticles();
if (!articles.length) throw new Error("Nenhuma materia em data/articles.json.");

writeFinalSite(articles);
console.log("Site final gerado em: " + outputDir);
console.log("Paginas de materia: " + Math.min(articles.length, 12));
