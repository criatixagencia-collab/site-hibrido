const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const articlesPath = path.join(root, "data", "articles.json");
const outputDir = path.join(root, "public", "final-site");
const imagesDir = path.join(root, "public", "images");

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

function slug(value) {
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

function articleUrl(article, prefix) {
  return prefix + "noticias/" + articleSlug(article) + "/";
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
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
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
   NOVO LAYOUT OFICIAL — BuzzNews
   Baseado no teste-design/index.html
   ============================================== */

function stylesheet() {
  return "<style>\n" +
    "*,::after,::before,::backdrop,::file-selector-button{box-sizing:border-box;margin:0;padding:0;border:0 solid}\n" +
    "html{line-height:1.5;-webkit-text-size-adjust:100%;tab-size:4;font-family:ui-sans-serif,system-ui,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",\"Segoe UI Symbol\",\"Noto Color Emoji\";-webkit-tap-highlight-color:transparent}\n" +
    "a{color:inherit;text-decoration:inherit}\n" +
    "img,video{max-width:100%;height:auto;display:block;vertical-align:middle}\n" +
    "button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;border-radius:0;background-color:transparent;opacity:1}\n" +
    "ol,ul,menu{list-style:none}\n" +
    "h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}\n" +
    "b,strong{font-weight:bolder}\n" +
    ":root{--spacing:0.25rem;--color-neutral-200:oklch(92.2% 0 0);--color-neutral-300:oklch(87% 0 0);--color-neutral-500:oklch(55.6% 0 0);--color-neutral-950:oklch(14.5% 0 0);--color-black:#000;--text-xs:0.75rem;--text-xs--line-height:calc(1/0.75);--text-sm:0.875rem;--text-sm--line-height:calc(1.25/0.875);--text-base:1rem;--text-base--line-height:calc(1.5/1);--text-lg:1.125rem;--text-lg--line-height:calc(1.75/1.125);--text-4xl:2.25rem;--text-4xl--line-height:calc(2.5/2.25);--text-6xl:3.75rem;--text-6xl--line-height:1;--font-weight-bold:700;--font-weight-black:900;--tracking-normal:0em;--tracking-wide:0.025em;--tracking-widest:0.1em;--default-transition-duration:150ms;--default-transition-timing-function:cubic-bezier(0.4,0,0.2,1);--background:oklch(0 0 0);--foreground:oklch(0.98 0 0);--primary:oklch(0.62 0.22 25);--primary-foreground:oklch(0.98 0 0);--secondary:oklch(0.18 0 0);--muted-foreground:oklch(0.7 0 0);--border:oklch(0.22 0 0);--nav:oklch(0 0 0);--nav-foreground:oklch(0.98 0 0);--nav-accent:oklch(0.62 0.22 25);--nav-hover:oklch(0.18 0 0);--nav-border:oklch(0.22 0 0)}\n" +
    ".min-h-screen{min-height:100vh}.bg-background{background-color:var(--background)}.bg-nav{background-color:var(--nav)}.bg-primary{background-color:var(--primary)}.bg-secondary{background-color:var(--secondary)}.text-foreground{color:var(--foreground)}.text-primary{color:var(--primary)}.text-primary-foreground{color:var(--primary-foreground)}.text-muted-foreground{color:var(--muted-foreground)}.text-nav-foreground{color:var(--nav-foreground)}.text-nav-accent{color:var(--nav-accent)}.text-neutral-950{color:var(--color-neutral-950)}.text-neutral-500{color:var(--color-neutral-500)}.border-nav-border{border-color:var(--nav-border)}.border-border{border-color:var(--border)}.border-border\\/70{border-color:color-mix(in oklab,var(--border) 70%,transparent)}.border-b{border-bottom-width:1px;border-bottom-style:solid}.border-t{border-top-width:1px;border-top-style:solid}.sticky{position:sticky}.top-0{top:0}.z-50{z-index:50}.w-full{width:100%}.max-w-\\[1040px\\]{max-width:1040px}.mx-auto{margin-inline:auto}.flex{display:flex}.inline-flex{display:inline-flex}.contents{display:contents}.flex-col{flex-direction:column}.items-center{align-items:center}.items-start{align-items:flex-start}.justify-between{justify-content:space-between}.gap-2{gap:calc(var(--spacing)*2)}.gap-5{gap:calc(var(--spacing)*5)}.h-16{height:calc(var(--spacing)*16)}.h-5{height:calc(var(--spacing)*5)}.h-7{height:calc(var(--spacing)*7)}.h-11{height:calc(var(--spacing)*11)}.h-12{height:calc(var(--spacing)*12)}.w-5{width:calc(var(--spacing)*5)}.w-7{width:calc(var(--spacing)*7)}.w-11{width:calc(var(--spacing)*11)}.px-2{padding-inline:calc(var(--spacing)*2)}.px-3{padding-inline:calc(var(--spacing)*3)}.px-4{padding-inline:calc(var(--spacing)*4)}.px-5{padding-inline:calc(var(--spacing)*5)}.py-1{padding-block:calc(var(--spacing)*1)}.py-2{padding-block:calc(var(--spacing)*2)}.py-8{padding-block:calc(var(--spacing)*8)}.pt-2{padding-top:calc(var(--spacing)*2)}.pt-8{padding-top:calc(var(--spacing)*8)}.pb-10{padding-bottom:calc(var(--spacing)*10)}.mb-3{margin-bottom:calc(var(--spacing)*3)}.mt-5{margin-top:calc(var(--spacing)*5)}.mt-7{margin-top:calc(var(--spacing)*7)}.mt-8{margin-top:calc(var(--spacing)*8)}.text-center{text-align:center}.text-left{text-align:left}.text-xs{font-size:var(--text-xs);line-height:var(--text-xs--line-height)}.text-sm{font-size:var(--text-sm);line-height:var(--text-sm--line-height)}.text-lg{font-size:var(--text-lg);line-height:var(--text-lg--line-height)}.text-4xl{font-size:var(--text-4xl);line-height:var(--text-4xl--line-height)}.text-\\[11px\\]{font-size:11px}.text-\\[clamp\\(2\\.9rem\\,13vw\\,6\\.6rem\\)\\]{font-size:clamp(2.9rem,13vw,6.6rem)}.font-black{font-weight:var(--font-weight-black)}.font-bold{font-weight:var(--font-weight-bold)}.uppercase{text-transform:uppercase}.leading-none{line-height:1}.leading-\\[0\\.82\\]{line-height:0.82}.tracking-normal{letter-spacing:var(--tracking-normal)}.tracking-wide{letter-spacing:var(--tracking-wide)}.tracking-\\[0\\.14em\\]{letter-spacing:0.14em}.tracking-\\[0\\.16em\\]{letter-spacing:0.16em}.tracking-\\[0\\.18em\\]{letter-spacing:0.18em}.tracking-widest{letter-spacing:var(--tracking-widest)}.shrink-0{flex-shrink:0}.whitespace-nowrap{white-space:nowrap}.relative{position:relative}.hidden{display:none}.block{display:block}.overflow-x-auto{overflow-x:auto}.hover\\:text-nav-accent:hover{color:var(--nav-accent)}.hover\\:bg-nav-hover:hover{background-color:var(--nav-hover)}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke;transition-timing-function:var(--default-transition-timing-function);transition-duration:var(--default-transition-duration)}.space-y-2>:not(:last-child){margin-block-start:calc(calc(var(--spacing)*2)*var(--tw-space-y-reverse,0));margin-block-end:calc(calc(var(--spacing)*2)*calc(1-var(--tw-space-y-reverse,0)))}.max-w-\\[11ch\\]{max-width:11ch}.font-\\[Impact\\,Haettenschweiler\\,\\'Arial_Narrow_Bold\\'\\,sans-serif\\]{font-family:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif}.object-contain{object-fit:contain}.grayscale-\\[15\\%\\]{filter:grayscale(15%)}.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}\n" +
    ".story-excerpt{max-width:42rem;margin-top:calc(var(--spacing)*6);font-size:1rem;line-height:1.55;text-transform:none;letter-spacing:0;color:var(--muted-foreground)}.article-copy p{margin-bottom:1rem}.related-wrap{border-top:1px solid var(--border);padding:2rem 1rem 0}.related-grid{display:grid;gap:1rem}.related-block{border:1px solid var(--border);padding:1rem}.related-title{margin-bottom:1rem;font-size:.75rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:var(--primary)}.related-link{display:block;border-top:1px solid var(--border);padding:.9rem 0}.related-link:first-of-type{border-top:0;padding-top:0}.related-link span{display:block;margin-bottom:.35rem;font-size:.68rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-foreground)}.related-link strong{font-size:1rem;line-height:1.15;color:var(--foreground)}\n" +
    "@media(min-width:48rem){.md\\:bg-\\[\\#f7f4ee\\]{background-color:#f7f4ee}.md\\:text-neutral-950{color:var(--color-neutral-950)}.md\\:text-neutral-500{color:var(--color-neutral-500)}.md\\:border-neutral-300{border-color:var(--color-neutral-300)}.md\\:h-20{height:calc(var(--spacing)*20)}.md\\:px-6{padding-inline:calc(var(--spacing)*6)}.md\\:hidden{display:none}.md\\:block{display:block}.md\\:grid{display:grid}.md\\:text-6xl{font-size:var(--text-6xl);line-height:var(--text-6xl--line-height)}.md\\:text-base{font-size:var(--text-base);line-height:var(--text-base--line-height)}.md\\:text-\\[clamp\\(4\\.4rem\\,7\\.2vw\\,7\\.8rem\\)\\]{font-size:clamp(4.4rem,7.2vw,7.8rem)}.md\\:max-w-\\[9\\.5ch\\]{max-width:9.5ch}.md\\:grid-cols-\\[minmax\\(0\\,1fr\\)_360px\\]{grid-template-columns:minmax(0,1fr) 360px}.md\\:gap-8{gap:calc(var(--spacing)*8)}.md\\:items-start{align-items:flex-start}.md\\:text-left{text-align:left}.md\\:px-0{padding-inline:0}.md\\:pt-10{padding-top:calc(var(--spacing)*10)}.md\\:pb-12{padding-bottom:calc(var(--spacing)*12)}.md\\:mt-0{margin-top:0}.md\\:aspect-auto{aspect-ratio:auto}.md\\:bg-transparent{background-color:transparent}.md\\:overflow-visible{overflow:visible}.md\\:relative{position:relative}.md\\:inset-auto{inset:auto}.md\\:h-auto{height:auto}.md\\:w-full{width:100%}.md\\:object-contain{object-fit:contain}.md\\:grayscale-0{filter:grayscale(0%)}.md\\:hover\\:bg-neutral-200:hover{background-color:var(--color-neutral-200)}.story-excerpt{font-size:1.05rem;color:var(--color-neutral-500)}.article-copy p{font-size:1.05rem;line-height:1.7}.related-wrap{border-color:var(--color-neutral-300);padding:2.5rem 1.5rem 0}.related-grid{grid-template-columns:1fr 1fr;gap:1.5rem}.related-block{border-color:var(--color-neutral-300)}.related-link{border-color:var(--color-neutral-300)}.related-link strong{color:var(--color-neutral-950)}}\n" +
    "@media(min-width:64rem){.lg\\:grid-cols-\\[minmax\\(0\\,1fr\\)_430px\\]{grid-template-columns:minmax(0,1fr) 430px}}\n" +
    "</style>";
}

function pageShell(opts) {
  var title = opts.title;
  var description = opts.description;
  var body = opts.body;
  var prefix = opts.prefix || "";
  return "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n  <title>" + escapeHtml(title) + "</title>\n  <meta name=\"description\" content=\"" + escapeHtml(description) + "\">\n  " + stylesheet() + "\n</head>\n<body>\n  <div class=\"min-h-screen bg-background md:bg-[#f7f4ee]\">\n    <header class=\"sticky top-0 z-50 w-full border-b border-nav-border bg-nav text-nav-foreground md:border-neutral-300 md:bg-[#f7f4ee] md:text-neutral-950\">\n      <div class=\"mx-auto flex h-16 max-w-[1040px] items-center justify-between px-3 md:h-20 md:px-6\">\n        <button type=\"button\" aria-label=\"Abrir menu\" class=\"inline-flex h-11 w-11 items-center justify-center hover:bg-nav-hover md:hidden\">\n          <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"h-7 w-7\"><path d=\"M4 5h16\"></path><path d=\"M4 12h16\"></path><path d=\"M4 19h16\"></path></svg>\n        </button>\n        <a href=\"" + prefix + "index.html\" class=\"font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-4xl uppercase leading-none tracking-normal md:text-6xl md:text-neutral-950\">Buzz<span class=\"text-nav-accent\">News</span></a>\n        <nav aria-label=\"Categorias\" class=\"hidden md:block\">\n          <ul class=\"flex items-center gap-5\">\n            <li><a href=\"" + prefix + "index.html\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">News</a></li>\n            <li><a href=\"" + prefix + "index.html\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">Celebridades</a></li>\n            <li><a href=\"" + prefix + "index.html\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">M\u00fasica</a></li>\n            <li><a href=\"" + prefix + "index.html\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">TV</a></li>\n            <li><a href=\"" + prefix + "index.html\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">Cinema</a></li>\n            <li><a href=\"" + prefix + "index.html\" class=\"text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition-colors hover:text-nav-accent\">Fotos</a></li>\n          </ul>\n        </nav>\n        <button type=\"button\" aria-label=\"Buscar\" class=\"inline-flex h-11 w-11 items-center justify-center hover:bg-nav-hover md:hover:bg-neutral-200\">\n          <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"h-5 w-5\"><path d=\"m21 21-4.34-4.34\"></path><circle cx=\"11\" cy=\"11\" r=\"8\"></circle></svg>\n        </button>\n      </div>\n      <div class=\"border-t border-nav-border md:hidden\">\n        <ul class=\"flex gap-1 overflow-x-auto px-2 py-2 scrollbar-hide\">\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide hover:text-nav-accent\">News</a></li>\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide hover:text-nav-accent\">Celebridades</a></li>\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide hover:text-nav-accent\">M\u00fasica</a></li>\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide hover:text-nav-accent\">TV</a></li>\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide hover:text-nav-accent\">Cinema</a></li>\n          <li class=\"shrink-0\"><a href=\"" + prefix + "index.html\" class=\"block whitespace-nowrap px-3 py-1.5 text-xs font-black uppercase tracking-wide hover:text-nav-accent\">Fotos</a></li>\n        </ul>\n      </div>\n    </header>\n    " + body + "\n    <div class=\"h-12\" aria-hidden=\"true\"></div>\n    <div class=\"py-8 text-center text-xs uppercase tracking-widest text-muted-foreground md:bg-[#f7f4ee] md:text-neutral-500\">BuzzNews &copy; " + new Date().getFullYear() + " &mdash; Entretenimento agora</div>\n  </div>\n</body>\n</html>";
}

function renderCard(article, index, prefix) {
  if (!prefix) prefix = "";
  var category = article.category || "Entretenimento";
  var imageCredit = article.imageCredit || "Imagem ilustrativa";
  var loading = index === 0 ? "eager" : "lazy";
  var dateFormatted = formatDate(article.createdAt);
  var imgSrc = escapeHtml(imageFor(article, prefix));
  var imgAlt = escapeHtml(article.imageAlt || article.title);

  return "<article class=\"border-b border-border/70 bg-background pb-10 pt-8 md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-8 md:border-neutral-300 md:bg-[#f7f4ee] md:px-6 md:pb-12 md:pt-10 lg:grid-cols-[minmax(0,1fr)_430px]\">\n" +
    "    <a href=\"" + escapeHtml(articleUrl(article, prefix)) + "\" class=\"contents\">\n" +
    "      <div class=\"flex flex-col items-center px-4 text-center md:items-start md:px-0 md:text-left\">\n" +
    "        <p class=\"mb-3 inline-flex bg-primary px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary-foreground\">" + escapeHtml(category) + "</p>\n" +
    "        <h2 class=\"max-w-[11ch] font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-[clamp(2.9rem,13vw,6.6rem)] font-black uppercase leading-[0.82] tracking-normal text-foreground md:max-w-[9.5ch] md:text-[clamp(4.4rem,7.2vw,7.8rem)] md:text-neutral-950\">" + escapeHtml(article.title) + "</h2>\n" +
    "        <p class=\"story-excerpt\">" + escapeHtml(article.excerpt) + "</p>\n" +
    "        <div class=\"mt-7 space-y-2 text-sm uppercase tracking-[0.16em] text-muted-foreground md:text-base md:text-neutral-500\">\n" +
    "          <p>By <span class=\"font-bold text-primary\">BuzzNews Staff</span></p>\n" +
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
  var cards = "";
  for (var i = 0; i < articles.length; i++) {
    cards += renderCard(articles[i], i, "");
  }
  var body = "<main>\n    <div class=\"mx-auto flex w-full max-w-[1040px] flex-col bg-background md:bg-[#f7f4ee]\">\n      " + cards + "\n    </div>\n  </main>";
  return pageShell({
    title: "BuzzNews - Entretenimento agora",
    description: "BuzzNews re\u00fane not\u00edcias r\u00e1pidas de celebridades, esportes, m\u00fasica, TV e entretenimento.",
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

  var pageBody = "<main>\n    <div class=\"mx-auto flex w-full max-w-[1040px] flex-col bg-background md:bg-[#f7f4ee]\">\n      <article class=\"px-4 py-8 md:px-6 md:py-10\">\n        <div class=\"md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-8 lg:grid-cols-[minmax(0,1fr)_430px]\">\n          <div>\n            <p class=\"mb-3 inline-flex bg-primary px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary-foreground\">" + escapeHtml(category) + "</p>\n            <h1 class=\"max-w-[11ch] font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-[clamp(2.9rem,13vw,6.6rem)] font-black uppercase leading-[0.82] tracking-normal text-foreground md:max-w-[9.5ch] md:text-[clamp(4.4rem,7.2vw,7.8rem)] md:text-neutral-950\">" + escapeHtml(article.title) + "</h1>\n            <div class=\"mt-7 space-y-2 text-sm uppercase tracking-[0.16em] text-muted-foreground md:text-base md:text-neutral-500\">\n              <p>By <span class=\"font-bold text-primary\">BuzzNews Staff</span></p>\n              <p>" + escapeHtml(dateFormatted) + "</p>\n            </div>\n            <div class=\"mt-8 space-y-4 text-base leading-relaxed text-foreground md:text-neutral-950\">\n              " + bodyHtml + "\n            </div>\n            <footer class=\"mt-8 border-t border-border/70 pt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground md:border-neutral-300 md:text-neutral-500\">\n              <p>Fontes: " + sourcesHtml + "</p>\n            </footer>\n          </div>\n          <figure class=\"mt-8 md:mt-0\">\n            <div class=\"relative bg-secondary md:aspect-auto md:bg-transparent md:overflow-visible\">\n              <img src=\"" + imgSrc + "\" alt=\"" + imgAlt + "\" width=\"1024\" height=\"1280\" loading=\"eager\" class=\"relative h-auto w-full object-contain md:relative md:inset-auto md:h-auto md:w-full md:object-contain grayscale-[15%] md:grayscale-0\" style=\"object-position:center center\">\n            </div>\n            <figcaption class=\"px-4 pt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:px-0 md:text-neutral-500\">" + escapeHtml(imageCredit) + "</figcaption>\n          </figure>\n        </div>\n      </article>\n      <div class=\"related-wrap\">\n        <div class=\"related-grid\">\n          " + renderRelatedBlock("Mais vistas do dia", mostViewed) + "\n          " + renderRelatedBlock("Mais lidas do dia", mostRead) + "\n        </div>\n      </div>\n    </div>\n  </main>";

  return pageShell({
    title: article.title + " - BuzzNews",
    description: article.excerpt,
    body: pageBody,
    prefix: prefix,
  });
}

function writeFinalSite(articles) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  copyDir(imagesDir, path.join(outputDir, "images"));
  fs.writeFileSync(path.join(outputDir, "index.html"), renderHome(articles));

  for (var i = 0; i < articles.length && i < 12; i++) {
    var dir = path.join(outputDir, "noticias", articleSlug(articles[i]));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderArticlePage(articles[i], articles));
  }
}

var articles = readArticles();
if (!articles.length) throw new Error("Nenhuma materia em data/articles.json.");

writeFinalSite(articles);
console.log("Site final gerado em: " + outputDir);
console.log("Paginas de materia: " + Math.min(articles.length, 12));
