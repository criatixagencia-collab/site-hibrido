const fs = require("fs");
const http = require("http");
const { URL } = require("url");
const { google } = require("googleapis");

const CREDENTIALS_PATH = "credentials.json";
const ENV_PATH = ".env";
const PORT = Number(process.env.BLOGGER_AUTH_PORT || 8080);
const SCOPES = ["https://www.googleapis.com/auth/blogger"];

function loadCredentials() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const app = credentials.installed || credentials.web;
  if (!app || !app.client_id || !app.client_secret) {
    throw new Error("credentials.json invalido: esperava credenciais OAuth em installed ou web.");
  }
  return app;
}

function mergeEnv(updates) {
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const lines = existing.split(/\r?\n/).filter(Boolean);
  const env = new Map();

  for (const line of lines) {
    const index = line.indexOf("=");
    if (index > 0) env.set(line.slice(0, index), line.slice(index + 1));
  }

  for (const [key, value] of Object.entries(updates)) {
    env.set(key, value || "");
  }

  const content = Array.from(env.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n";

  fs.writeFileSync(ENV_PATH, content);
}

async function tryOpen(authUrl) {
  try {
    const open = await import("open");
    await open.default(authUrl);
  } catch {
    // O link ja foi impresso no terminal. Abrir manualmente e suficiente.
  }
}

async function main() {
  const credentials = loadCredentials();
  const redirectUri = `http://localhost:${PORT}`;
  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    redirectUri,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, redirectUri);
      const code = requestUrl.searchParams.get("code");
      const error = requestUrl.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end(`Autorizacao negada: ${error}`);
        server.close();
        return;
      }

      if (!code) {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        res.end("Aguardando retorno OAuth do Google.");
        return;
      }

      const { tokens } = await oauth2Client.getToken(code);
      if (!tokens.refresh_token) {
        throw new Error("Google nao retornou refresh_token. Rode de novo mantendo prompt=consent ou remova o acesso antigo do app na conta Google.");
      }

      mergeEnv({
        GOOGLE_CLIENT_ID: credentials.client_id,
        GOOGLE_CLIENT_SECRET: credentials.client_secret,
        GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
      });

      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<h1>Autenticacao concluida.</h1><p>Pode fechar esta aba e voltar ao terminal.</p>");

      console.log("\nOAuth concluido.");
      console.log("Arquivo .env atualizado com GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN.");
      console.log("Refresh token salvo localmente. Nao envie .env para GitHub.\n");
      server.close();
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(error.message || String(error));
      console.error(error.message || error);
      server.close();
    }
  });

  server.listen(PORT, () => {
    console.log("Abra este link no navegador para autorizar o acesso ao Blogger:\n");
    console.log(authUrl);
    console.log(`\nServidor local aguardando retorno em ${redirectUri}`);
    console.log(`Scope usado: ${SCOPES.join(", ")}`);
    tryOpen(authUrl);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
