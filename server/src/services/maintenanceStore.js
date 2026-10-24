import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PRODUCTKEEPER_DATA_DIR || (process.platform === "linux" ? "/tmp/productkeeper-data" : path.join(__dirname, "..", "data"));
const DATA_FILE = path.join(DATA_DIR, "maintenance.json");

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

async function writeAll(items) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
}

export async function listMaintenanceByProduct(productId) {
  const items = await readAll();
  return items
    .filter((item) => item.productId === productId)
    .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
}

export async function addMaintenance(item) {
  const items = await readAll();
  items.push(item);
  await writeAll(items);
  return item;
}

export async function updateMaintenance(id, updates) {
  const items = await readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated = { ...items[index], ...updates };
  items[index] = updated;
  await writeAll(items);
  return updated;
}

export async function deleteMaintenance(id) {
  const items = await readAll();
  const filtered = items.filter((item) => item.id !== id);
  await writeAll(filtered);
  return filtered;
}
