const fs = require("node:fs");
const path = require("node:path");

const QUEUE_FILE = path.resolve(__dirname, "..", "data", "review-queue.json");
const MIN_WORDS = 45;
const MAX_WORDS = 260;
const MIN_CHARACTERS = 300;
const MIN_PARAGRAPHS = 2;
const MAX_PARAGRAPHS = 5;

function wordCount(body) {
  return body.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

function characterCount(body) {
  return body.join(" ").replace(/\s+/g, " ").trim().length;
}

function validate() {
  if (!fs.existsSync(QUEUE_FILE)) throw new Error("data/review-queue.json nao encontrado.");
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
  if (queue.workflowVersion !== 2 || !Array.isArray(queue.items)) {
    throw new Error("Fila editorial invalida ou antiga.");
  }

  const pending = queue.items.filter((item) => item.reviewStatus === "pending-human");
  if (!pending.length) throw new Error("Fila editorial sem rascunhos pendentes.");

  const issues = [];
  let imagesPending = 0;
  for (const item of pending) {
    const id = item.reviewId || item.id || item.slug;
    const body = Array.isArray(item.body) ? item.body : [];
    const words = wordCount(body);
    const characters = characterCount(body);
    const review = item.editorialMeta?.automatedReview;

    if (review?.status !== "approved" || Number(review.confidence || 0) < 0.72) {
      issues.push(`${id}: revisao factual automatica ausente ou fraca`);
    }
    if (body.length < MIN_PARAGRAPHS || body.length > MAX_PARAGRAPHS) {
      issues.push(`${id}: ${body.length} paragrafos`);
    }
    if (words < MIN_WORDS || words > MAX_WORDS) {
      issues.push(`${id}: ${words} palavras`);
    }
    if (characters < MIN_CHARACTERS) {
      issues.push(`${id}: ${characters}/${MIN_CHARACTERS} caracteres`);
    }
    if (!Array.isArray(item.evidenceClaims) || item.evidenceClaims.length < 2) {
      issues.push(`${id}: evidencias insuficientes`);
    }
    if (item.imageReview?.status !== "approved") imagesPending += 1;
  }

  if (issues.length) {
    console.error("Fila editorial reprovada:");
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exit(1);
  }

  console.log(
    `OK: ${pending.length} rascunho(s) factual(is) aguardando avaliacao humana; ${imagesPending} imagem(ns) ainda exigem escolha humana.`,
  );
}

validate();
