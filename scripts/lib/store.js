import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("data");

export async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

export async function readJson(file, fallback) {
  try {
    const content = await readFile(path.join(dataDir, file), "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

export async function writeJson(file, value) {
  await ensureDataDir();
  await writeFile(path.join(dataDir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
