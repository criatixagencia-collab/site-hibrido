#!/usr/bin/env node
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { selectionAssets } = require("./lib/selection-assets.cjs");

const root = path.resolve(__dirname, "..");
const { files: selectionFiles, images } = selectionAssets(root);
const files = [...selectionFiles, ...images].map((file) => path.relative(root, file));

execFileSync("git", ["add", "--", ...files], {
  cwd: root,
  stdio: "inherit",
});

console.log(
  `Selecao Interativa adicionada ao staging: ${selectionFiles.length} arquivo(s) e ${images.length} imagem(ns). Nenhum commit ou push foi feito.`,
);
