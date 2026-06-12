#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const QUEUE_FILE = path.join(ROOT, "data", "review-queue.json");
const REPORT_FILE = path.join(ROOT, "data", "editorial-run-report.json");
const TELEGRAM_RAFAEL = "8447763556";
const WHATSAPP_GROUP = "120363427477009794@g.us";

function readQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    throw new Error("Fila editorial ausente. Rode npm run hybrid:refresh.");
  }
  return JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
}

function readReport() {
  if (!fs.existsSync(REPORT_FILE)) return null;
  return JSON.parse(fs.readFileSync(REPORT_FILE, "utf8"));
}

function pendingItems(queue) {
  return (queue.items || []).filter((item) => item.reviewStatus === "pending-human");
}

function buildMessage(queue, report) {
  const items = pendingItems(queue);
  const lines = [
    "*BuzzPop — avaliação humana*",
    "",
    `${items.length} rascunho(s) passaram pela revisão factual automática.`,
    "Nenhum deles está publicado na página principal.",
    "",
  ];
  if (report) {
    lines.push(
      `Última rodada: ${report.candidatesAvailable} candidatos encontrados, ${report.candidatesAttempted} analisados, ${report.approved} aprovados, ${report.rejected} rejeitados e ${report.errors} erros.`,
      "",
    );
  }

  items.forEach((item, index) => {
    const id = item.reviewId || item.id;
    const confidence = Math.round(
      Number(item.editorialMeta?.automatedReview?.confidence || 0) * 100,
    );
    const image =
      item.imageReview?.status === "approved"
        ? `foto aprovada (${Math.round(Number(item.imageReview?.confidence || 0) * 100)}%)`
        : "foto precisa de revisão";
    lines.push(`${index + 1}. *${item.title}*`);
    lines.push(`ID: ${id} | texto ${confidence}% | ${image}`);
    lines.push("");
  });

  lines.push("Responda no grupo com:");
  lines.push("- APROVAR: IDs separados por vírgula");
  lines.push("- REJEITAR: IDs separados por vírgula + motivo");
  lines.push("- FOTO: ID + número da candidata quando houver");
  return lines.join("\n");
}

function buildReport(report) {
  if (!report) return "Relatorio da ultima rodada ainda nao existe.";
  const lines = [
    "=== RELATORIO DA ULTIMA RODADA ===",
    `Status: ${report.status}`,
    `Candidatos: ${report.candidatesAvailable}`,
    `Analisados: ${report.candidatesAttempted}`,
    `Aprovados: ${report.approved}`,
    `Rejeitados: ${report.rejected}`,
    `Erros: ${report.errors}`,
    "",
  ];
  for (const outcome of report.outcomes || []) {
    lines.push(
      `[${outcome.status}] ${outcome.title}`,
      `Etapa: ${outcome.stage}${outcome.categoryHint ? ` | Editoria: ${outcome.categoryHint}` : ""}`,
    );
    for (const reason of outcome.reasons || []) lines.push(`- ${reason}`);
    lines.push("");
  }
  return lines.join("\n");
}

function printInstructions(action, message) {
  if (action === "--send-test") {
    console.log("=== MENSAGEM PARA RAFAEL (Telegram) ===");
    console.log(message);
    console.log(`\nSession key: agent:main:telegram:direct:${TELEGRAM_RAFAEL}`);
    return;
  }
  if (action === "--send-group") {
    console.log("=== MENSAGEM PARA GRUPO BUZZ POP (WhatsApp) ===");
    console.log(message);
    console.log(`\nGroup ID: ${WHATSAPP_GROUP}`);
    return;
  }
  console.log(message);
}

function buildDetail(queue, id) {
  const item = (queue.items || []).find((entry) => (entry.reviewId || entry.id) === id);
  if (!item) throw new Error(`Item nao encontrado: ${id}`);
  const lines = [
    `*${item.title}*`,
    "",
    item.excerpt,
    "",
    ...(item.body || []).flatMap((paragraph) => [paragraph, ""]),
    `Editoria: ${item.category}`,
    `ID: ${item.reviewId || item.id}`,
    `Foto: ${item.imageReview?.status === "approved" ? item.imagePostUrl || item.image : "pendente"}`,
    `Fontes consideradas: ${(item.evidenceSources || []).join(", ")}`,
  ];
  if (item.imageCandidates?.length) {
    lines.push("", "Candidatas de foto:");
    item.imageCandidates.forEach((candidate, index) => {
      lines.push(`${index}: ${candidate.pageUrl || candidate.imageUrl}`);
    });
  }
  return lines.join("\n");
}

try {
  const queue = readQueue();
  const report = readReport();
  if (process.argv[2] === "--report") {
    console.log(buildReport(report));
  } else if (process.argv[2] === "--detail") {
    console.log(buildDetail(queue, process.argv[3]));
  } else {
    printInstructions(process.argv[2], buildMessage(queue, report));
  }
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
