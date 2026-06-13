import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function codexBin() {
  return process.env.CODEX_BIN || "/Users/rafaeloliver/.npm-global/bin/codex";
}

function codexEnv() {
  return {
    ...process.env,
    CODEX_HOME: process.env.CODEX_HOME || "/Users/rafaeloliver/.codex",
  };
}

function codexModel() {
  return process.env.CODEX_MODEL || "gpt-5.5";
}

function codexReasoningEffort() {
  return process.env.CODEX_REASONING_EFFORT || "high";
}

function sanitizeCodexError(value = "") {
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***");
}

function buildPromptMessage(messages) {
  const last = messages.at(-1);
  if (last?.role === "user") return last.content;
  return JSON.stringify({
    instruction:
      "Responda somente com um objeto JSON valido que siga exatamente o schema informado. Nao escreva markdown.",
    messages,
  });
}

export async function requestCodexJson({ messages, schema, timeoutMs }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "buzzpop-codex-"));
  const schemaFile = path.join(directory, "schema.json");
  const outputFile = path.join(directory, "result.json");

  try {
    await writeFile(schemaFile, JSON.stringify(schema, null, 2));
    const prompt = buildPromptMessage(messages);

    const result = await new Promise((resolve, reject) => {
      const child = spawn(
        codexBin(),
        [
          "exec",
          "--ephemeral",
          "--skip-git-repo-check",
          "--sandbox",
          "read-only",
          "-m",
          codexModel(),
          "-c",
          `model_reasoning_effort="${codexReasoningEffort()}"`,
          "--output-schema",
          schemaFile,
          "--output-last-message",
          outputFile,
          "-C",
          directory,
        ],
        {
          cwd: directory,
          env: codexEnv(),
          timeout: Number(timeoutMs || process.env.CODEX_POSTS_TIMEOUT_MS || 180000),
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (exitCode) => {
        resolve({ exitCode, stdout, stderr });
      });

      child.on("error", (error) => {
        reject(error);
      });

      // Passa o prompt pelo stdin e fecha o pipe
      child.stdin.write(prompt);
      child.stdin.end();
    });

    const { exitCode, stderr } = result;

    if (exitCode !== 0) {
      const detail = sanitizeCodexError(stderr);
      throw new Error(`Codex CLI saiu com codigo ${exitCode}: ${detail}`);
    }

    try {
      return JSON.parse(await readFile(outputFile, "utf8"));
    } catch (error) {
      const detail = sanitizeCodexError(stderr);
      throw new Error(`Codex CLI nao gerou JSON valido: ${detail}`);
    }

  } catch (error) {
    const detail = sanitizeCodexError(error.stderr || error.stdout || error.message || error);
    throw new Error(`Codex CLI indisponivel: ${detail}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
