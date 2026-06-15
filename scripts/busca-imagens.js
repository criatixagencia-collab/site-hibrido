/**
 * busca-imagens.js — Quick image search via DuckDuckGo (Node.js)
 * Busca imagem para cada matéria e atualiza data/selecao-pronta.json
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");

async function duckduckgoImage(query) {
  try {
    // Step 1: get vqd token
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const htmlResp = await fetch(searchUrl, {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await htmlResp.text();
    const vqd = html.match(/vqd=["']?([^"'&]+)["']?/)?.[1];
    if (!vqd) return "";

    // Step 2: get images
    const imgUrl = `https://duckduckgo.com/i.js?l=br-pt&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;
    const imgResp = await fetch(imgUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        referer: searchUrl,
      },
      signal: AbortSignal.timeout(10000),
    });
    const data = await imgResp.json();
    const results = data.results || [];
    for (const r of results) {
      const url = r.image || r.thumbnail || "";
      if (url && url.length > 40 && !url.includes("gstatic.com")) {
        return url;
      }
    }
    return "";
  } catch {
    return "";
  }
}

async function main() {
  const raw = readFileSync(join(DATA, "selecao-pronta.json"), "utf-8");
  const data = JSON.parse(raw);
  const items = data.items || [];

  const queries = [
    "Steven Spielberg Dia D filme 2026",
    "Madonna cantora show palco",
    "Rush banda rock show",
    "Virginia Fonseca Ze Felipe",
    "Bruna Biancardi influencer Brasil",
    "Vovo Anesio idoso internet",
    "Gabz atriz Jaffar Bambirra",
    "gato teatro palco ator",
    "Oliver Tree cantor americano",
    "Virginia Fonseca repórter",
    "Luciano Huck programa",
    "Carol Peixinho Bento bebe",
  ];

  let ok = 0;
  for (let i = 0; i < items.length; i++) {
    const q = queries[i] || items[i].buzzpopTitle;
    process.stdout.write(`  ${i + 1}/${items.length} "${q.slice(0, 40)}..." `);
    const url = await duckduckgoImage(q);
    if (url) {
      items[i].image = url;
      items[i].imageOrigin = "duckduckgo";
      ok++;
      process.stdout.write("✅\n");
    } else {
      process.stdout.write("❌\n");
    }
    // Rate limit
    if (i < items.length - 1) await new Promise((r) => setTimeout(r, 600));
  }

  data.items = items;
  writeFileSync(join(DATA, "selecao-pronta.json"), JSON.stringify(data, null, 2));

  console.log(`\n✅ ${ok}/${items.length} imagens encontradas`);
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
