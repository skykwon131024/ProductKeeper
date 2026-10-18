import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import productsRouter from "./routes/products.js";
import manualsRouter from "./routes/manuals.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/api/products", productsRouter);
app.use("/api/products/:productId/manuals", manualsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`ProductKeeper 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
