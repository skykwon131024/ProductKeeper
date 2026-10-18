import { useState } from "react";
import { recognizeProductImage, registerProduct } from "../api.js";

const INITIAL_FORM = { brand: "", productName: "", modelName: "" };

export default function ProductCapture({ onRegistered }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageFileName, setImageFileName] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [recognitionNote, setRecognitionNote] = useState("");
  const [confidence, setConfidence] = useState("");
  const [status, setStatus] = useState("idle"); // idle | analyzing | ready | saving | done
  const [errorMessage, setErrorMessage] = useState("");

  function handleFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setForm(INITIAL_FORM);
    setRecognitionNote("");
    setConfidence("");
    setImageFileName(null);
    setStatus("idle");
    setErrorMessage("");
  }

  async function handleAnalyze() {
    if (!file) return;
    setStatus("analyzing");
    setErrorMessage("");

    try {
      const { recognition, imageFileName: savedFileName } = await recognizeProductImage(file);
      setForm({
        brand: recognition.brand,
        productName: recognition.productName,
        modelName: recognition.modelName,
      });
      setConfidence(recognition.confidence);
      setRecognitionNote(recognition.rawNote);
      setImageFileName(savedFileName);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("idle");
    }
  }

  function handleFieldChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleRegister() {
    if (!form.productName.trim()) {
      setErrorMessage("제품명을 입력해 주세요.");
      return;
    }

    setStatus("saving");
    setErrorMessage("");

    try {
      await registerProduct({ ...form, imageFileName });
      setStatus("done");
      setFile(null);
      setPreviewUrl(null);
      setImageFileName(null);
      setForm(INITIAL_FORM);
      setRecognitionNote("");
      setConfidence("");
      onRegistered?.();
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("ready");
    }
  }

  return (
    <section className="card">
      <h2>1. 제품 사진으로 등록하기</h2>
      <p className="hint">
        제품 사진을 올리면 AI가 브랜드, 제품명, 모델명을 먼저 추측해 드려요.
        추측한 내용이 맞는지 확인하고, 틀린 부분은 고쳐서 등록해 주세요.
      </p>

      <label className="file-input">
        <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} />
        사진 선택하기
      </label>

      {previewUrl && (
        <div className="preview">
          <img src={previewUrl} alt="등록할 제품 미리보기" />
        </div>
      )}

      {file && status !== "done" && (
        <button type="button" onClick={handleAnalyze} disabled={status === "analyzing"}>
          {status === "analyzing" ? "AI가 분석하고 있어요..." : "AI로 제품 분석하기"}
        </button>
      )}

      {errorMessage && <p className="error">{errorMessage}</p>}

      {(status === "ready" || status === "saving") && (
        <div className="recognition-form">
          <p className="hint">
            AI 추측 정확도: <strong>{confidence}</strong>
            {recognitionNote && ` · ${recognitionNote}`}
          </p>

          <label>
            브랜드
            <input
              type="text"
              value={form.brand}
              onChange={(event) => handleFieldChange("brand", event.target.value)}
              placeholder="예: 삼성"
            />
          </label>

          <label>
            제품명
            <input
              type="text"
              value={form.productName}
              onChange={(event) => handleFieldChange("productName", event.target.value)}
              placeholder="예: 비스포크 세탁기"
            />
          </label>

          <label>
            모델명
            <input
              type="text"
              value={form.modelName}
              onChange={(event) => handleFieldChange("modelName", event.target.value)}
              placeholder="예: WF24DB7000BD"
            />
          </label>

          <button type="button" onClick={handleRegister} disabled={status === "saving"}>
            {status === "saving" ? "등록하고 있어요..." : "이 정보로 제품 등록하기"}
          </button>
        </div>
      )}

      {status === "done" && <p className="success">제품이 등록되었어요!</p>}
    </section>
  );
}
