/**
 * reescreve-artigos.js — Re-escreve artigos do review-queue com DeepSeek-style via Node
 * Lê data/review-queue.json, reescreve artigos, salva data/artigos-prontos.json
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");

const GATEWAY = "http://127.0.0.1:5080";
const TIMEOUT_MS = 120000;

async function callCaique(prompt) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const resp = await fetch(`${GATEWAY}/api/sessions/agent:caique:main/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: prompt, timeoutSeconds: 120 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return (data.text || data.message || data.response || "").trim();
  } catch {
    return "";
  }
}

async function main() {
  const raw = readFileSync(join(DATA, "review-queue.json"), "utf-8");
  const queue = JSON.parse(raw);
  const items = queue.items || [];

  // Seleciona 8 mais recentes
  const sorted = [...items].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")).reverse();
  const selected = sorted.slice(0, 8);

  const results = [];

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const title = item.title || "";
    const claims = (item.evidenceClaims || []).slice(0, 5).join("\n");
    const sources = (item.evidenceSources || []).slice(0, 5).join(", ");
    const cat = item.category || "Famosos";
    const oldBody = (item.body || []).join(" ");

    process.stdout.write(`  ${i + 1}/8 "${title.slice(0, 50)}..." `);

    const prompt = `Você é o BuzzPop, portal de entretenimento brasileiro.

Escreva uma mini-matéria no estilo BuzzPop sobre esta notícia.

REGRAS OBRIGATÓRIAS:
- LIDE DIRETO: primeira frase responde o que aconteceu, com quem, onde e quando.
- TOM FACTUAL: sem "incrível", "revolucionário", "imperdível", "emocionante". Use nomes, idades, datas, números.
- PIRÂMIDE INVERTIDA: o mais importante primeiro, depois contexto.
- 🚫 NÃO cite a fonte da notícia no corpo do texto.
- Use dados concretos: nomes, idades, datas, valores, citações diretas.
- PARÁGRAFOS CURTOS: 2-4 linhas, uma ideia por parágrafo.
- ⚠️ CORPO MÍNIMO: o texto deve ter no mínimo 500 caracteres.
- Se a notícia for curta, adicione contexto, detalhes ou dados complementares SEM inventar.

Formato:
- Título: 45-90 chars, personagem principal no início
- Linha de apoio: 140-220 chars, explica o gancho
- Corpo: MÍNIMO 500 CARACTERES, 2-4 parágrafos

Notícia original:
Título: ${title}
Manchetes da cobertura:
${claims}
Cobertura: ${item.sourceCount || 1} fonte(s) (${sources})
Categoria: ${cat}

Responda apenas com:

TÍTULO: [seu título]
LINHA: [sua linha de apoio]
CORPO: [seu corpo com mínimo 500 caracteres]`;

    try {
      const resposta = await callCaique(prompt);
      
      // Parse resposta
      const tituloMatch = resposta.match(/TÍTULO:\s*(.+?)(?:\n|$)/);
      const linhaMatch = resposta.match(/LINHA:\s*(.+?)(?:\n|$)/);
      const corpoMatch = resposta.match(/CORPO:\s*([\s\S]+)$/);

      const buzzpopTitle = tituloMatch ? tituloMatch[1].trim().slice(0, 90) : "";
      const buzzpopLine = linhaMatch ? linhaMatch[1].trim().slice(0, 220) : "";
      let buzzpopBody = corpoMatch ? corpoMatch[1].trim() : "";

      if (!buzzpopTitle || !buzzpopBody || buzzpopBody.length < 500) {
        process.stdout.write(`⚠️ curto (${buzzpopBody?.length || 0}c)\n`);
        continue;
      }

      results.push({
        id: item.id || `caique-${i}`,
        title: item.title,
        category: item.category || "Famosos",
        sources: item.evidenceSources || [],
        sourceCount: item.sourceCount || 1,
        evidenceClaims: item.evidenceClaims || [],
        buzzpopTitle,
        buzzpopLine,
        buzzpopBody,
        originalSize: oldBody.length,
        newSize: buzzpopBody.length,
        image: "",
        imageOrigin: "pending",
      });

      process.stdout.write(`✅ ${buzzpopBody.length}c\n`);
    } catch {
      process.stdout.write(`❌ erro\n`);
    }

    if (i < selected.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // Salva
  const output = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    items: results,
  };

  writeFileSync(join(DATA, "artigos-prontos.json"), JSON.stringify(output, null, 2));
  console.log(`\n✅ ${results.length} artigos reescritos com 500+ caracteres`);

  for (const r of results) {
    console.log(`  ${r.buzzpopTitle.slice(0, 55)} — ${r.buzzpopBody.length}c (era ${r.originalSize}c)`);
  }
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
