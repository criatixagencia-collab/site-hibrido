#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { selectionAssets } = require("./lib/selection-assets.cjs");

const root = path.resolve(__dirname, "..");

function isTracked(file) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", path.relative(root, file)], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const { images } = selectionAssets(root);
  const missing = images.filter(
    (image) => !fs.existsSync(image) || !fs.statSync(image).isFile(),
  );
  const untracked = images.filter((image) => fs.existsSync(image) && !isTracked(image));
  const issues = [];

  for (const image of missing) {
    issues.push(`arquivo ausente: ${path.relative(root, image)}`);
  }
  for (const image of untracked) {
    issues.push(`imagem fora do Git: ${path.relative(root, image)}`);
  }

  if (issues.length) {
    console.error("Selecao do Dia bloqueada:");
    issues.forEach((issue) => console.error(`- ${issue}`));
    console.error(
      "Rode npm run stage:selection-assets e depois npm run validate:selection-assets.",
    );
    process.exit(1);
  }

  console.log(
    `OK: ${images.length} imagem(ns) da Selecao do Dia existem em docs/images/auto e estao no Git.`,
  );
}

main();
