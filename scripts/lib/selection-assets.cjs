const fs = require("node:fs");
const path = require("node:path");

function extractSelectionImagePaths(html, htmlFile) {
  const references = new Set();
  const imagePattern = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi;
  let match;

  while ((match = imagePattern.exec(html))) {
    const source = match[2].trim();
    if (source.includes("${")) continue;
    if (!source || /^(?:https?:|data:|blob:|\/\/)/i.test(source)) {
      throw new Error(`Imagem externa ou invalida na selecao: ${source || "(vazia)"}`);
    }

    const cleanSource = decodeURIComponent(source.split(/[?#]/, 1)[0]);
    const absolutePath = path.resolve(path.dirname(htmlFile), cleanSource);
    references.add(absolutePath);
  }

  return [...references];
}

function selectionAssets(root) {
  const htmlFile = path.join(root, "docs", "selecao-interativa", "index.html");
  const dataFile = path.join(root, "docs", "selecao-interativa", "data.json");
  const imagesDir = path.join(root, "docs", "images", "auto");
  if (!fs.existsSync(htmlFile)) {
    throw new Error("docs/selecao-interativa/index.html nao encontrado.");
  }

  const html = fs.readFileSync(htmlFile, "utf8");
  const images = extractSelectionImagePaths(html, htmlFile);
  for (const image of images) {
    const relative = path.relative(imagesDir, image);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(
        `Imagem da selecao fora de docs/images/auto: ${path.relative(root, image)}`,
      );
    }
  }

  const files = [htmlFile];
  if (fs.existsSync(dataFile)) files.push(dataFile);

  return { htmlFile, dataFile, files, imagesDir, images };
}

module.exports = { extractSelectionImagePaths, selectionAssets };
