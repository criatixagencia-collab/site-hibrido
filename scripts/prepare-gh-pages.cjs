const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceSite = path.join(root, "public", "final-site");
const sourceImages = path.join(root, "public", "images");
const docsDir = path.join(root, "docs");
const docsImages = path.join(docsDir, "images");

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
}

if (!fs.existsSync(path.join(sourceSite, "index.html"))) {
  throw new Error("public/final-site/index.html nao encontrado. Rode npm run site:final antes.");
}

fs.mkdirSync(docsDir, { recursive: true });
fs.cpSync(sourceSite, docsDir, { recursive: true, force: true });
fs.writeFileSync(path.join(docsDir, ".nojekyll"), "");
copyDir(sourceImages, docsImages);

console.log(`GitHub Pages pronto em: ${docsDir}`);
console.log("Entrada: docs/index.html");
