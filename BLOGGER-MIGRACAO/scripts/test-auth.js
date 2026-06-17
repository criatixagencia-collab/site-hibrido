const { BLOGGER_SCOPE, getAccessTokenForTest } = require("../src/blogger-client");

async function main() {
  const token = await getAccessTokenForTest();
  if (!token) {
    throw new Error("Nao foi possivel gerar access token a partir do refresh token.");
  }

  console.log("OAuth OK.");
  console.log(`Scope necessario: ${BLOGGER_SCOPE}`);
  console.log(`Access token gerado: ${token.slice(0, 10)}...${token.slice(-6)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
