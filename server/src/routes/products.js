import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { v4 as uuid } from "uuid";
import { recognizeProductFromImage } from "../services/aiRecognition.js";
import { addProduct, getProduct, listProducts, updateProduct } from "../services/productStore.js";
import { listManualsByProduct } from "../services/manualStore.js";
import { diagnoseProductIssue } from "../services/productTroubleshooter.js";
import { addMaintenance, deleteMaintenance, listMaintenanceByProduct, updateMaintenance } from "../services/maintenanceStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.PRODUCTKEEPER_UPLOAD_DIR || (process.platform === "linux" ? "/tmp/productkeeper-uploads" : path.join(__dirname, "..", "..", "uploads"));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("이미지 파일만 업로드할 수 있어요."));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

// 사진을 보내면 AI가 브랜드/제품명/모델명을 추정해서 돌려준다. (아직 저장하지 않음)
router.post("/recognize", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "제품 사진을 함께 보내주세요." });
  }

  try {
    const recognition = await recognizeProductFromImage(req.file.path);
    res.json({
      recognition,
      imageFileName: req.file.filename,
    });
  } catch (error) {
    res.status(502).json({ message: error.message });
  }
});

// 사용자가 확인(수정)한 내용으로 제품을 목록에 등록한다.
router.post("/", async (req, res) => {
  const {
    brand,
    productName,
    modelName,
    imageFileName,
    purchaseDate,
    purchasePrice,
    purchaseStore,
    warrantyMonths,
    warrantyEndDate,
  } = req.body;

  if (!productName || !productName.trim()) {
    return res.status(400).json({ message: "제품명을 입력해 주세요." });
  }

  const product = {
    id: uuid(),
    brand: brand?.trim() ?? "",
    productName: productName.trim(),
    modelName: modelName?.trim() ?? "",
    imageFileName: imageFileName ?? null,
    purchaseDate: purchaseDate || "",
    purchasePrice: purchasePrice || "",
    purchaseStore: purchaseStore?.trim() ?? "",
    warrantyMonths: Number(warrantyMonths) > 0 ? Number(warrantyMonths) : "",
    warrantyEndDate: warrantyEndDate || "",
    registeredAt: new Date().toISOString(),
  };

  const saved = await addProduct(product);
  res.status(201).json(saved);
});

router.patch("/:id", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "해당 제품을 찾을 수 없어요." });
  }

  const next = {
    ...product,
    ...req.body,
    purchaseStore: req.body.purchaseStore?.trim() ?? product.purchaseStore ?? "",
    purchasePrice: req.body.purchasePrice ?? product.purchasePrice ?? "",
    warrantyMonths: req.body.warrantyMonths === "" ? "" : Number(req.body.warrantyMonths) || product.warrantyMonths || "",
    purchaseDate: req.body.purchaseDate ?? product.purchaseDate ?? "",
    warrantyEndDate: req.body.warrantyEndDate ?? product.warrantyEndDate ?? "",
  };

  const updated = await updateProduct(req.params.id, next);
  res.json(updated);
});

// 등록된 제품 목록을 모두 가져온다.
router.get("/", async (_req, res) => {
  const products = await listProducts();
  res.json(products);
});

router.post("/:id/diagnose", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "해당 제품을 찾을 수 없어요." });
  }

  const symptom = typeof req.body.symptom === "string" ? req.body.symptom.trim() : "";
  if (!symptom || symptom.length > 2000) {
    return res.status(400).json({ message: "증상은 1자 이상 2,000자 이하로 입력해 주세요." });
  }

  try {
    const manuals = await listManualsByProduct(product.id);
    const result = await diagnoseProductIssue(product, manuals, symptom);
    res.json(result);
  } catch (error) {
    console.error("제품 문제 해결 실패:", error.message);
    res.status(502).json({ message: "AI 문제 해결을 준비하지 못했어요. Azure OpenAI 설정을 확인해 주세요." });
  }
});

router.get("/:id/maintenance", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "해당 제품을 찾을 수 없어요." });
  }

  const items = await listMaintenanceByProduct(product.id);
  res.json(items);
});

router.post("/:id/maintenance", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "해당 제품을 찾을 수 없어요." });
  }

  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const nextDueDate = typeof req.body.nextDueDate === "string" ? req.body.nextDueDate : "";
  const intervalMonths = Number(req.body.intervalMonths || 0);

  if (!title || !nextDueDate || intervalMonths <= 0) {
    return res.status(400).json({ message: "관리 항목명, 예정일, 주기(개월)를 모두 입력해 주세요." });
  }

  const record = {
    id: randomUUID(),
    productId: product.id,
    title,
    intervalMonths,
    nextDueDate,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  const saved = await addMaintenance(record);
  res.status(201).json(saved);
});

router.patch("/:id/maintenance/:maintenanceId", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "해당 제품을 찾을 수 없어요." });
  }

  const updated = await updateMaintenance(req.params.maintenanceId, req.body);
  if (!updated) {
    return res.status(404).json({ message: "관리 일정을 찾을 수 없어요." });
  }

  res.json(updated);
});

router.delete("/:id/maintenance/:maintenanceId", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "해당 제품을 찾을 수 없어요." });
  }

  await deleteMaintenance(req.params.maintenanceId);
  res.status(204).send();
});

// 등록된 제품 한 개의 상세 정보를 가져온다.
router.get("/:id", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "해당 제품을 찾을 수 없어요." });
  }
  res.json(product);
});

export default router;
