import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PRODUCTKEEPER_DATA_DIR || (process.platform === "linux" ? "/tmp/productkeeper-data" : path.join(__dirname, "..", "data"));
const DATA_FILE = path.join(DATA_DIR, "manuals.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

async function readAll() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(manuals) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(manuals, null, 2), "utf-8");
}

export async function listManualsByProduct(productId) {
  const manuals = await readAll();
  return manuals
    .filter((manual) => manual.productId === productId)
    .sort((a, b) => a.pageOrder - b.pageOrder);
}

export async function addManuals(newManuals) {
  const manuals = await readAll();
  manuals.push(...newManuals);
  await writeAll(manuals);
  return newManuals;
}

export async function getManual(id) {
  const manuals = await readAll();
  return manuals.find((manual) => manual.id === id) ?? null;
}

export async function updateManual(id, updates) {
  const manuals = await readAll();
  const index = manuals.findIndex((manual) => manual.id === id);
  if (index === -1) return null;

  manuals[index] = { ...manuals[index], ...updates };
  await writeAll(manuals);
  return manuals[index];
}
