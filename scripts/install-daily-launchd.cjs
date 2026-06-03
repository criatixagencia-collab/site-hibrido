#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const LABEL = "com.buzznews.daily";
const PLIST = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const LOG_DIR = path.join(ROOT, "logs");
const NPM_BIN = process.env.BUZZNEWS_NPM_BIN || "/usr/local/bin/npm";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`Comando falhou: ${command} ${args.join(" ")}`);
  }

  return result.status === 0;
}

function main() {
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NPM_BIN}</string>
    <string>run</string>
    <string>daily:push</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>8</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${path.join(LOG_DIR, "daily.out.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(LOG_DIR, "daily.err.log")}</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
`;

  fs.writeFileSync(PLIST, plist);
  const domain = `gui/${process.getuid()}`;
  run("launchctl", ["bootout", domain, PLIST], { allowFailure: true });

  if (!run("launchctl", ["bootstrap", domain, PLIST], { allowFailure: true })) {
    run("launchctl", ["load", PLIST]);
  }

  console.log(`Agendamento instalado: ${PLIST}`);
  console.log("Horario: todos os dias as 08:30");
  console.log(`Logs: ${LOG_DIR}`);
}

main();
