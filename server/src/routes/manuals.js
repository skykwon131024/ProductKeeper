import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuid } from "uuid";
import { getProduct } from "../services/productStore.js";
import { addManuals, listManualsByProduct, updateManual } from "../services/manualStore.js";
import { extractPagesFromDocument } from "../services/documentIntelligence.js";
import { answerManualQuestion } from "../services/manualQa.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.PRODUCTKEEPER_UPLOAD_DIR || (process.platform === "linux" ? "/tmp/productkeeper-uploads" : path.join(__dirname, "..", "..", "uploads"));
const MANUAL_UPLOAD_DIR = path.join(UPLOAD_DIR, "manuals");

fs.mkdirSync(MANUAL_UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);

function isAllowedFile(file) {
  return file.mimetype.startsWith("image/") || ALLOWED_MIME_TYPES.has(file.mimetype);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MANUAL_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 20 }, // 설명서 한 번에 최대 20장, 장당 20MB
  fileFilter: (_req, file, cb) => {
    if (!isAllowedFile(file)) {
      cb(new Error("설명서는 이미지 또는 PDF 파일만 올릴 수 있어요."));
      return;
    }
    cb(null, true);
  },
});

const router = Router({ mergeParams: true });

async function analyzeUploadedManual(manual, file) {
  try {
    const pages = await extractPagesFromDocument(file.path, file.mimetype);
    if (!pages.some((page) => page.text.trim())) {
      throw new Error("파일에서 읽을 수 있는 글자를 찾지 못했습니다.");
    }
    await updateManual(manual.id, {
      analysisStatus: "completed",
      pages,
      analysisError: "",
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`설명서 분석 실패 (${manual.id}):`, error.message);
    await updateManual(manual.id, {
      analysisStatus: "failed",
      analysisError: error.message,
    });
  }
}

// 제품 하나에 설명서를 한 장 또는 여러 장 한 번에 등록한다. (사진 촬영, PDF, 이미지 모두 지원)
router.post("/", upload.array("files", 20), async (req, res) => {
  const { productId } = req.params;

  const product = await getProduct(productId);
  if (!product) {
    return res.status(404).json({ message: "설명서를 연결할 제품을 찾을 수 없어요." });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "등록할 설명서 파일을 선택해 주세요." });
  }

  const existingManuals = await listManualsByProduct(productId);
  let nextPageOrder = existingManuals.length;

  const newManuals = req.files.map((file) => ({
    id: uuid(),
    productId,
    fileName: file.filename,
    originalName: file.originalname,
    fileType: file.mimetype.startsWith("image/") ? "image" : "pdf",
    pageOrder: nextPageOrder++,
    uploadedAt: new Date().toISOString(),
    analysisStatus: "pending",
    analysisError: "",
    pages: [],
  }));

  const saved = await addManuals(newManuals);
  saved.forEach((manual, index) => {
    void analyzeUploadedManual(manual, req.files[index]);
  });
  res.status(202).json(saved.map(({ pages, ...manual }) => manual));
});

router.post("/ask", async (req, res) => {
  const { productId } = req.params;
  const question = typeof req.body.question === "string" ? req.body.question.trim() : "";

  if (!question || question.length > 1000) {
    return res.status(400).json({ message: "질문은 1자 이상 1,000자 이하로 입력해 주세요." });
  }

  const product = await getProduct(productId);
  if (!product) {
    return res.status(404).json({ message: "제품을 찾을 수 없어요." });
  }

  const manuals = await listManualsByProduct(productId);
  const readyManuals = manuals.filter(
    (manual) => manual.analysisStatus === "completed" && manual.pages?.length
  );
  if (readyManuals.length === 0) {
    const isProcessing = manuals.some((manual) => manual.analysisStatus === "pending");
    return res.status(isProcessing ? 409 : 422).json({
      message: isProcessing
        ? "설명서를 읽고 있어요. 잠시 후 다시 질문해 주세요."
        : "읽을 수 있는 설명서가 없습니다. 파일을 다시 등록하거나 더 선명한 파일을 올려주세요.",
    });
  }

  try {
    const result = await answerManualQuestion(product, readyManuals, question);
    res.json(result);
  } catch (error) {
    console.error("설명서 질문 처리 실패:", error.message);
    res.status(502).json({ message: "답변을 만들지 못했어요. AI 연결 설정을 확인해 주세요." });
  }
});

// 제품 하나에 연결된 설명서 목록을 등록 순서대로 가져온다.
router.get("/", async (req, res) => {
  const { productId } = req.params;

  const product = await getProduct(productId);
  if (!product) {
    return res.status(404).json({ message: "해당 제품을 찾을 수 없어요." });
  }

  const manuals = await listManualsByProduct(productId);
  res.json(manuals.map(({ pages, ...manual }) => manual));
});

export default router;
