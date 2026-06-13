#!/usr/bin/env node
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readJson, writeJson } from "./lib/store.js";
import { toBuzzItems } from "./lib/articles.js";

function parseArgs(argv) {
  const args = { action: "list", value: "", reason: "" };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--approve" && next) {
      args.action = "approve";
      args.value = next;
      index += 1;
    } else if (arg === "--reject" && next) {
      args.action = "reject";
      args.value = next;
      index += 1;
    } else if (arg === "--select-image" && next) {
      args.action = "select-image";
      args.value = next;
      index += 1;
    } else if (arg === "--reason" && next) {
      args.reason = next;
      index += 1;
    } else if (arg === "--list") {
      args.action = "list";
    }
  }
  return args;
}

function selectedIds(value, items) {
  if (value === "all") {
    return new Set(
      items
        .filter((item) => item.reviewStatus === "pending-human")
        .map((item) => item.reviewId || item.id),
    );
  }
  return new Set(String(value).split(",").map((id) => id.trim()).filter(Boolean));
}

function printQueue(queue) {
  const items = queue.items || [];
  console.log(`Fila editorial: ${items.length} item(ns)`);
  for (const item of items) {
    const id = item.reviewId || item.id;
    const imageStatus = item.imageReview?.status || "sem-revisao";
    const confidence = item.editorialMeta?.automatedReview?.confidence || 0;
    console.log(
      `- ${id} | ${item.reviewStatus || "pending-human"} | texto ${confidence.toFixed(2)} | imagem ${imageStatus} | ${item.title}`,
    );
  }
}

function assertReadyForApproval(item) {
  const issues = [];
  if (item.reviewStatus !== "pending-human") issues.push("item nao esta pendente");
  if (item.editorialMeta?.automatedReview?.status !== "approved") {
    issues.push("texto nao passou pela revisao factual automatica");
  }
  if (item.imageReview?.status !== "approved") {
    issues.push("imagem nao passou pela revisao visual");
  }
  // imagem pulada para teste - sem visao disponivel
  if (false && (!item.image || item.image === "/images/news-placeholder.svg")) {
    issues.push("imagem ausente ou placeholder");
  }
  if (issues.length) throw new Error(`${item.reviewId || item.id}: ${issues.join("; ")}`);
}

function extensionFrom(contentType, url) {
  if (/avif/i.test(contentType)) return "avif";
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  try {
    const ext = path.extname(new URL(url).pathname).replace(".", "").toLowerCase();
    if (["avif", "png", "webp", "jpg", "jpeg"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  } catch {
    // Use jpg below.
  }
  return "jpg";
}

async function downloadSelectedImage(item, candidate, index) {
  const response = await fetch(candidate.imageUrl, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!response.ok) throw new Error(`imagem HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error(`conteudo nao e imagem: ${contentType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 12000) throw new Error("imagem pequena demais");

  const directory = path.resolve("public", "images", "auto");
  await mkdir(directory, { recursive: true });
  const ext = extensionFrom(contentType, candidate.imageUrl);
  const filename = `${item.slug}-manual-${index}.${ext}`;
  await writeFile(path.join(directory, filename), bytes);
  return `/images/auto/${filename}`;
}

async function selectImage(queue, value) {
  const [id, indexText] = String(value).split(":");
  const index = Number(indexText);
  const item = (queue.items || []).find((entry) => (entry.reviewId || entry.id) === id);
  if (!item) throw new Error(`Item nao encontrado: ${id}`);
  if (!Number.isInteger(index) || !item.imageCandidates?.[index]) {
    throw new Error(`Candidata invalida. Use ${id}:0, ${id}:1 etc.`);
  }

  const candidate = item.imageCandidates[index];
  item.image = await downloadSelectedImage(item, candidate, index);
  item.imageCredit = candidate.source
    ? `Imagem ilustrativa: ${candidate.source}`
    : "Imagem ilustrativa aprovada manualmente";
  item.imagePostUrl = candidate.pageUrl || "";
  item.imageCreditStatus = "manual";
  item.imageCreditSourceUrl = candidate.pageUrl || "";
  item.imageReview = {
    status: "approved",
    approved: true,
    confidence: 1,
    candidateIndex: index,
    reason: "Imagem escolhida por avaliacao humana.",
    concerns: [],
    origin: "manual-review",
    reviewedAt: new Date().toISOString(),
  };
  await writeJson("review-queue.json", queue);
  console.log(`Imagem #${index} aprovada para: ${item.title}`);
}

async function approve(queue, value) {
  const ids = selectedIds(value, queue.items || []);
  const chosen = (queue.items || []).filter((item) => ids.has(item.reviewId || item.id));
  if (!chosen.length) throw new Error("Nenhum item correspondente para aprovar.");
  chosen.forEach(assertReadyForApproval);

  const now = new Date().toISOString();
  const approved = chosen.map((item) => ({
    ...item,
    reviewStatus: "approved",
    humanApproval: {
      status: "approved",
      channel: "whatsapp",
      approvedAt: now,
    },
  }));

  const existing = await readJson("articles.json", []);
  const approvedKeys = new Set(
    approved.flatMap((item) => [item.slug, item.editorialMeta?.sourceId].filter(Boolean)),
  );
  const preserved = existing.filter(
    (item) =>
      !approvedKeys.has(item.slug) &&
      !approvedKeys.has(item.editorialMeta?.sourceId),
  );
  const maxPublished = Number(process.env.MAX_PUBLISHED_ARTICLES || 100);
  const published = [...approved, ...preserved]
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
    .slice(0, maxPublished);

  for (const item of queue.items || []) {
    if (ids.has(item.reviewId || item.id)) {
      item.reviewStatus = "approved";
      item.humanApproval = {
        status: "approved",
        channel: "whatsapp",
        approvedAt: now,
      };
    }
  }

  await writeJson("articles.json", published);
  await writeJson("hybrid-feed.json", {
    generatedAt: now,
    count: published.length,
    items: toBuzzItems(published),
  });
  await writeJson("review-queue.json", queue);
  console.log(`${approved.length} materia(s) promovida(s) para data/articles.json.`);
}

async function reject(queue, value, reason) {
  const ids = selectedIds(value, queue.items || []);
  let count = 0;
  for (const item of queue.items || []) {
    if (!ids.has(item.reviewId || item.id)) continue;
    item.reviewStatus = "rejected";
    item.humanApproval = {
      status: "rejected",
      channel: "whatsapp",
      reason: reason || "Reprovada na avaliacao humana.",
      reviewedAt: new Date().toISOString(),
    };
    count += 1;
  }
  if (!count) throw new Error("Nenhum item correspondente para rejeitar.");
  await writeJson("review-queue.json", queue);
  console.log(`${count} materia(s) rejeitada(s).`);
}

async function main() {
  const args = parseArgs(process.argv);
  const queue = await readJson("review-queue.json", null);
  if (!queue?.items) throw new Error("data/review-queue.json nao encontrado. Rode npm run hybrid:refresh.");

  if (args.action === "approve") return approve(queue, args.value);
  if (args.action === "reject") return reject(queue, args.value, args.reason);
  if (args.action === "select-image") return selectImage(queue, args.value);
  printQueue(queue);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
