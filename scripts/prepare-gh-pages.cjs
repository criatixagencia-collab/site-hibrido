const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceHtml = path.join(root, "public", "site-hoje-referencia.html");
const sourceImages = path.join(root, "public", "images");
const docsDir = path.join(root, "docs");
const docsImages = path.join(docsDir, "images");

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

if (!fs.existsSync(sourceHtml)) {
  throw new Error("public/site-hoje-referencia.html nao encontrado. Rode npm run site:referencia antes.");
}

fs.rmSync(docsDir, { recursive: true, force: true });
fs.mkdirSync(docsDir, { recursive: true });

let html = fs.readFileSync(sourceHtml, "utf8");
html = html
  .replaceAll('src="/images/', 'src="./images/')
  .replaceAll("src='/images/", "src='./images/")
  .replaceAll('href="/images/', 'href="./images/')
  .replaceAll("href='/images/", "href='./images/");

fs.writeFileSync(path.join(docsDir, "index.html"), html);
fs.writeFileSync(path.join(docsDir, ".nojekyll"), "");
copyDir(sourceImages, docsImages);

console.log(`GitHub Pages pronto em: ${docsDir}`);
console.log("Entrada: docs/index.html");
