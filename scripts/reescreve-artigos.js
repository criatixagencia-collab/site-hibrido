/**
 * reescreve-artigos.js — Re-escreve artigos do review-queue com DeepSeek-style via Node
 * Lê data/review-queue.json, reescreve artigos, salva data/artigos-prontos.json
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { execFile } from "node:child_process";
import { join, dirname } from "path";
import { promisify } from "node:util";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");
const execFileAsync = promisify(execFile);

const GATEWAY = process.env.CAIQUE_GATEWAY || process.env.OPENCLAW_GATEWAY || "http://127.0.0.1:5080";
const TIMEOUT_MS = 120000;
const CAIQUE_WHATSAPP_ROOT = process.env.CAIQUE_WHATSAPP_ROOT || "/Users/rafaeloliver/.openclaw/workspace/agente whats";
const TARGET_COUNT = Number(process.env.CAIQUE_READY_ARTICLES || 8);
const START_INDEX = Number(process.env.CAIQUE_READY_START || 0);
const MIN_READY_CHARACTERS = Number(process.env.MIN_READY_ARTICLE_CHARACTERS || 1400);
const MIN_READY_WORDS = Number(process.env.MIN_READY_ARTICLE_WORDS || 220);
const MIN_READY_PARAGRAPHS = Number(process.env.MIN_READY_ARTICLE_PARAGRAPHS || 4);
const MAX_REWRITE_ATTEMPTS = Number(process.env.MAX_READY_REWRITE_ATTEMPTS || 2);
const ARTIGOS_PRONTOS_PATH = join(DATA, "artigos-prontos.json");
const SELECAO_PRONTA_PATH = join(DATA, "selecao-pronta.json");

function bodyStats(text) {
  const normalized = String(text || "").trim();
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const words = normalized.split(/\s+/).filter(Boolean).length;
  return { characters: normalized.length, words, paragraphs: paragraphs.length };
}

function validationIssues(text) {
  const stats = bodyStats(text);
  const issues = [];
  if (stats.characters < MIN_READY_CHARACTERS) {
    issues.push(`${stats.characters}/${MIN_READY_CHARACTERS} caracteres`);
  }
  if (stats.words < MIN_READY_WORDS) {
    issues.push(`${stats.words}/${MIN_READY_WORDS} palavras`);
  }
  if (stats.paragraphs < MIN_READY_PARAGRAPHS) {
    issues.push(`${stats.paragraphs}/${MIN_READY_PARAGRAPHS} paragrafos`);
  }
  return { stats, issues };
}

function parseBuzzpopResponse(resposta) {
  const tituloMatch = resposta.match(/T[IÍ]TULO:\s*(.+?)(?:\n|$)/i);
  const linhaMatch = resposta.match(/LINHA:\s*(.+?)(?:\n|$)/i);
  const corpoMatch = resposta.match(/CORPO:\s*([\s\S]+)$/i);

  return {
    buzzpopTitle: tituloMatch ? tituloMatch[1].trim() : "",
    buzzpopLine: linhaMatch ? linhaMatch[1].trim() : "",
    buzzpopBody: corpoMatch ? corpoMatch[1].trim() : "",
  };
}

function truncateAtWord(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
}

function articleKey(item, index = 0) {
  return String(item.id || item.reviewId || item.slug || item.title || `caique-${index}`);
}

function readOutputItems(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, filePath);
}

function saveProgress(results, selected, generatedAt) {
  const order = new Map(selected.map((item, index) => [articleKey(item, START_INDEX + index), index]));
  const orderedResults = results.slice().sort((left, right) => {
    return (order.get(articleKey(left)) ?? 999999) - (order.get(articleKey(right)) ?? 999999);
  });
  const output = {
    generatedAt,
    updatedAt: new Date().toISOString(),
    total: orderedResults.length,
    targetTotal: selected.length,
    items: orderedResults,
  };

  atomicWriteJson(ARTIGOS_PRONTOS_PATH, output);
  atomicWriteJson(SELECAO_PRONTA_PATH, {
    ...output,
    mode: "caique-deepseek-ready-selection",
  });
}

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
    try {
      const { stdout } = await execFileAsync(
        process.execPath,
        ["src/scripts/dry-message.js", "--conversation=codex-reescreve-artigos@local", prompt],
        {
          cwd: CAIQUE_WHATSAPP_ROOT,
          timeout: TIMEOUT_MS,
          maxBuffer: 1024 * 1024,
          env: {
            ...process.env,
            BOT_NAME: "Caique",
            OPENCLAW_AGENT_ID: "caique",
          },
        },
      );
      return String(stdout || "").trim();
    } catch {
      return "";
    }
  }
}

async function main() {
  const raw = readFileSync(join(DATA, "review-queue.json"), "utf-8");
  const queue = JSON.parse(raw);
  const items = queue.items || [];

  // Seleciona as mais recentes para virarem materias completas da selecao interativa.
  const sorted = [...items].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")).reverse();
  const selected = sorted.slice(START_INDEX, START_INDEX + TARGET_COUNT);

  const selectedKeys = new Set(selected.map((item, index) => articleKey(item, START_INDEX + index)));
  const cachedItems = [
    ...readOutputItems(SELECAO_PRONTA_PATH),
    ...readOutputItems(ARTIGOS_PRONTOS_PATH),
  ];
  const resultByKey = new Map();

  for (const item of cachedItems) {
    const key = articleKey(item);
    if (selectedKeys.has(key) && !resultByKey.has(key)) {
      resultByKey.set(key, item);
    }
  }

  const generatedAt = new Date().toISOString();
  const results = selected
    .map((item, index) => resultByKey.get(articleKey(item, START_INDEX + index)))
    .filter(Boolean);

  if (results.length) {
    saveProgress(results, selected, generatedAt);
    console.log(`Retomando execucao: ${results.length}/${selected.length} artigo(s) ja estavam salvos em disco.`);
  }

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const title = item.title || "";
    const claims = (item.evidenceClaims || []).slice(0, 5).join("\n");
    const sources = (item.evidenceSources || []).slice(0, 5).join(", ");
    const cat = item.category || "Famosos";
    const oldBody = (item.body || []).join(" ");
    const key = articleKey(item, START_INDEX + i);

    if (resultByKey.has(key)) {
      process.stdout.write(`  ${i + 1}/${selected.length} "${title.slice(0, 50)}..." ⏭️ ja salvo\n`);
      continue;
    }

    process.stdout.write(`  ${i + 1}/${selected.length} "${title.slice(0, 50)}..." `);

    const promptBase = `Você é o BuzzPop, portal de entretenimento brasileiro.

Escreva uma matéria no estilo BuzzPop sobre esta notícia. Use o UOL Splash como referência direta de estrutura, ritmo e linguagem de portal de entretenimento: texto rápido, factual, popular, escaneável e feito para leitura no celular. Ela será exibida na página de seleção interativa já como texto pronto para aprovação humana.

REGRAS OBRIGATÓRIAS:
- REFERÊNCIA UOL SPLASH: siga de perto o modelo de chamada e corpo do Splash: personagem ou obra no início, verbo forte, fato central claro, parágrafos curtos e informação em ordem de importância.
- TÍTULO COM PEGADA DE PORTAL: pessoa + ação + consequência; obra + novidade + serviço; ou declaração curta quando houver fala. Não use título frio de relatório.
- LIDE DIRETO: primeira frase responde o que aconteceu, com quem, onde e quando.
- TOM FACTUAL: sem "incrível", "revolucionário", "imperdível", "emocionante". Use nomes, idades, datas, números.
- PIRÂMIDE INVERTIDA: o mais importante primeiro, depois contexto.
- 🚫 NÃO cite a fonte da notícia no corpo do texto.
- Use dados concretos: nomes, idades, datas, valores, citações diretas.
- PARÁGRAFOS CURTOS: 2-4 linhas, uma ideia por parágrafo.
- RITMO SPLASH: parágrafo 1 = fato principal; parágrafo 2 = contexto; parágrafo 3 = detalhe, fala, contraste ou repercussão; parágrafo final = consequência, serviço, próximo passo ou fechamento factual.
- VOZ: direta como portal, popular sem gritaria, curiosa sem inventar, factual antes de opinativa.
- ⚠️ CORPO MÍNIMO: no mínimo ${MIN_READY_CHARACTERS} caracteres, ${MIN_READY_WORDS} palavras e ${MIN_READY_PARAGRAPHS} parágrafos.
- Use inteligência editorial: se houver bastante lastro, escreva 5 ou 6 parágrafos; se a notícia for simples, entregue 4 parágrafos fortes.
- Não estique o texto com enchimento genérico. Prefira texto menor, factual e bem escrito a inventar contexto.
- Se a notícia for curta, adicione contexto, detalhes ou dados complementares SEM inventar.
- Antes de responder, revise concordância, fluidez e naturalidade. Evite palavra artificial ou pouco jornalística, como "publicizada".

Formato:
- Título: 45-95 chars, personagem principal no início, sem cortar palavras
- Linha de apoio: 140-240 chars, explica o gancho
- Corpo: MÍNIMO ${MIN_READY_CHARACTERS} CARACTERES, ${MIN_READY_WORDS} PALAVRAS, ${MIN_READY_PARAGRAPHS}+ PARÁGRAFOS. Normalmente 4 a 6 parágrafos.

Notícia original:
Título: ${title}
Resumo disponível:
${item.excerpt || oldBody || "(sem resumo)"}
Manchetes da cobertura:
${claims}
Cobertura: ${item.sourceCount || 1} fonte(s) (${sources})
Categoria: ${cat}

Responda apenas com:

TÍTULO: [seu título]
LINHA: [sua linha de apoio]
CORPO: [seu corpo completo, com o mínimo obrigatório]`;

    try {
      let parsed = null;
      let stats = null;
      let issues = [];

      for (let attempt = 1; attempt <= MAX_REWRITE_ATTEMPTS; attempt++) {
        const retryNote = attempt === 1
          ? ""
          : `\n\nATENÇÃO: a tentativa anterior ficou curta. Reescreva de novo e respeite obrigatoriamente ${MIN_READY_CHARACTERS}+ caracteres, ${MIN_READY_WORDS}+ palavras e ${MIN_READY_PARAGRAPHS}+ parágrafos.`;
        const resposta = await callCaique(promptBase + retryNote);
        parsed = parseBuzzpopResponse(resposta);
        const result = validationIssues(parsed.buzzpopBody);
        stats = result.stats;
        issues = result.issues;

        if (parsed.buzzpopTitle && parsed.buzzpopBody && !issues.length) {
          break;
        }
      }

      if (!parsed?.buzzpopTitle || !parsed?.buzzpopBody || issues.length) {
        process.stdout.write(`⚠️ reprovado (${issues.join(", ") || "sem titulo/corpo"})\n`);
        continue;
      }

      const readyItem = {
        id: item.id || `caique-${i}`,
        title: item.title,
        category: item.category || "Famosos",
        sources: item.evidenceSources || [],
        sourceCount: item.sourceCount || 1,
        evidenceClaims: item.evidenceClaims || [],
        buzzpopTitle: truncateAtWord(parsed.buzzpopTitle, 95),
        buzzpopLine: truncateAtWord(parsed.buzzpopLine, 240),
        buzzpopBody: parsed.buzzpopBody,
        originalSize: oldBody.length,
        newSize: stats.characters,
        wordCount: stats.words,
        paragraphCount: stats.paragraphs,
        image: "",
        imageOrigin: "pending",
      };

      resultByKey.set(key, readyItem);
      results.push(readyItem);
      saveProgress(results, selected, generatedAt);

      process.stdout.write(`✅ ${stats.characters}c/${stats.words}p/${stats.paragraphs}§\n`);
    } catch {
      process.stdout.write(`❌ erro\n`);
    }

    if (i < selected.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  if (!results.length) {
    throw new Error(
      `Nenhum artigo atingiu o minimo de ${MIN_READY_CHARACTERS} caracteres, ${MIN_READY_WORDS} palavras e ${MIN_READY_PARAGRAPHS} paragrafos. Arquivos existentes foram preservados.`,
    );
  }

  saveProgress(results, selected, generatedAt);
  console.log(
    `\n✅ ${results.length} artigos reescritos em data/artigos-prontos.json e data/selecao-pronta.json com ${MIN_READY_CHARACTERS}+ caracteres, ${MIN_READY_WORDS}+ palavras e ${MIN_READY_PARAGRAPHS}+ paragrafos`,
  );

  for (const r of results) {
    console.log(`  ${r.buzzpopTitle.slice(0, 55)} — ${r.newSize}c/${r.wordCount}p/${r.paragraphCount}§ (era ${r.originalSize}c)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error("Fatal:", e.message); process.exit(1); });
