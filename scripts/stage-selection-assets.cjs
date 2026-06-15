#!/usr/bin/env node
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { selectionAssets } = require("./lib/selection-assets.cjs");

const root = path.resolve(__dirname, "..");
const { htmlFile, images } = selectionAssets(root);
const files = [htmlFile, ...images].map((file) => path.relative(root, file));

execFileSync("git", ["add", "--", ...files], {
  cwd: root,
  stdio: "inherit",
});

console.log(
  `Selecao do Dia adicionada ao staging: 1 HTML e ${images.length} imagem(ns). Nenhum commit ou push foi feito.`,
);
