import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuid } from "uuid";
import { recognizeProductFromImage } from "../services/aiRecognition.js";
import { addProduct, getProduct, listProducts } from "../services/productStore.js";

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
  const { brand, productName, modelName, imageFileName } = req.body;

  if (!productName || !productName.trim()) {
    return res.status(400).json({ message: "제품명을 입력해 주세요." });
  }

  const product = {
    id: uuid(),
    brand: brand?.trim() ?? "",
    productName: productName.trim(),
    modelName: modelName?.trim() ?? "",
    imageFileName: imageFileName ?? null,
    registeredAt: new Date().toISOString(),
  };

  const saved = await addProduct(product);
  res.status(201).json(saved);
});

// 등록된 제품 목록을 모두 가져온다.
router.get("/", async (_req, res) => {
  const products = await listProducts();
  res.json(products);
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
