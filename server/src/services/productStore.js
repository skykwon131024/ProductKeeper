import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PRODUCTKEEPER_DATA_DIR || (process.platform === "linux" ? "/tmp/productkeeper-data" : path.join(__dirname, "..", "data"));
const DATA_FILE = path.join(DATA_DIR, "products.json");

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

async function writeAll(products) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(products, null, 2), "utf-8");
}

export async function listProducts() {
  return readAll();
}

export async function getProduct(id) {
  const products = await readAll();
  return products.find((product) => product.id === id) ?? null;
}

export async function addProduct(product) {
  const products = await readAll();
  products.push(product);
  await writeAll(products);
  return product;
}

export async function updateProduct(id, updates) {
  const products = await readAll();
  const index = products.findIndex((product) => product.id === id);
  if (index === -1) return null;

  const updated = {
    ...products[index],
    ...updates,
  };

  products[index] = updated;
  await writeAll(products);
  return updated;
}
