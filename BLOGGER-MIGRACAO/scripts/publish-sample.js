const { publishPost } = require("../src/blogger-client");

async function main() {
  const status = process.env.BLOGGER_POST_STATUS || "DRAFT";
  const result = await publishPost({
    status,
    title: "Teste do site hibrido no Blogger",
    labels: ["Teste", "Site Hibrido"],
    content: [
      "<p>Este e um teste tecnico de publicacao futura do site hibrido no Blogger.</p>",
      "<p>Se este post aparecer como rascunho, a autenticacao OAuth e a Blogger API estao funcionando.</p>",
    ].join("\n"),
  });

  console.log(`Post criado como ${status}.`);
  console.log(`ID: ${result.id}`);
  console.log(`URL: ${result.url || "(rascunho sem URL publica)"}`);
}

main().catch((error) => {
  console.error(error.errors || error.message || error);
  process.exit(1);
});
