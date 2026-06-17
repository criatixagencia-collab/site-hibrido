#!/usr/bin/env node
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const script = path.join(__dirname, "gerar-selecao-interativa.cjs");
const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status || 0);
