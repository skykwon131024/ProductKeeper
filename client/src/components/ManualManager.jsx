import { useEffect, useState } from "react";
import {
  askManualQuestion,
  fetchManuals,
  fetchProducts,
  searchManualsForProduct,
  uploadManuals,
} from "../api.js";

export default function ManualManager({ refreshKey }) {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [manuals, setManuals] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | uploading
  const [errorMessage, setErrorMessage] = useState("");
  const [manualsRefreshKey, setManualsRefreshKey] = useState(0);
  const [manualSearchResults, setManualSearchResults] = useState([]);
  const [searchingManuals, setSearchingManuals] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const data = await fetchProducts();
        if (!active) return;
        setProducts(data);
        if (data.length > 0 && !selectedProductId) {
          setSelectedProductId(data[0].id);
        }
      } catch (error) {
        if (active) setErrorMessage(error.message);
      }
    }

    loadProducts();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedProductId) {
      setManuals([]);
      return;
    }

    let active = true;

    async function loadManuals() {
      try {
        const data = await fetchManuals(selectedProductId);
        if (active) setManuals(data);
      } catch (error) {
        if (active) setErrorMessage(error.message);
      }
    }

    loadManuals();
    return () => {
      active = false;
    };
  }, [selectedProductId, manualsRefreshKey]);

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0 || !selectedProductId) return;

    setStatus("uploading");
    setErrorMessage("");

    try {
      await uploadManuals(selectedProductId, files);
      setManualsRefreshKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setStatus("idle");
      event.target.value = "";
    }
  }

  async function handleSearchManuals() {
    if (!selectedProductId) return;

    setSearchingManuals(true);
    setErrorMessage("");
    setManualSearchResults([]);

    try {
      const data = await searchManualsForProduct(selectedProductId);
      setManualSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        setErrorMessage("자동 검색 결과가 없어요. 제품명과 모델명을 다시 확인해 주세요.");
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSearchingManuals(false);
    }
  }

  async function handleAsk(event) {
    event.preventDefault();
    if (!question.trim() || !selectedProductId) return;

    setAsking(true);
    setErrorMessage("");
    setAnswer(null);
    try {
      setAnswer(await askManualQuestion(selectedProductId, question.trim()));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setAsking(false);
    }
  }

  if (products.length === 0) {
    return (
      <section className="card">
        <h2>3. 설명서 등록하기</h2>
        <p className="hint">설명서를 연결하려면 먼저 제품을 하나 등록해 주세요.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>3. 설명서 등록하기</h2>
      <p className="hint">
        제품을 구매했을 때 받은 설명서를 사진이나 PDF로 등록해 두면, 나중에 쉽게 다시 볼 수 있어요.
        여러 장을 한 번에 선택해도 괜찮아요.
      </p>

      <label>
        어떤 제품의 설명서인가요?
        <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.productName}
              {product.brand ? ` (${product.brand})` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="file-input">
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleFilesSelected}
          disabled={status === "uploading"}
        />
        {status === "uploading" ? "등록하고 있어요..." : "설명서 사진/PDF 선택하기"}
      </label>

      {errorMessage && <p className="error">{errorMessage}</p>}

      {manuals.length === 0 ? (
        <div className="manual-search-box">
          <p className="hint">아직 등록된 설명서가 없어요. 제품명으로 공식 설명서를 자동으로 찾아볼 수 있어요.</p>
          <button type="button" onClick={handleSearchManuals} disabled={searchingManuals}>
            {searchingManuals ? "설명서를 찾는 중이에요..." : "설명서 자동 검색하기"}
          </button>

          {manualSearchResults.length > 0 && (
            <ul className="manual-search-results">
              {manualSearchResults.map((result) => (
                <li key={result.url}>
                  <a href={result.url} target="_blank" rel="noreferrer">
                    {result.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ul className="manual-list">
          {manuals.map((manual, index) => (
            <li key={manual.id}>
              <div>
                <strong>{manual.originalName || `${index + 1}번째 설명서`}</strong>
                <span className="manual-status">
                  {manual.analysisStatus === "completed" && "내용 읽기 완료"}
                  {manual.analysisStatus === "pending" && "내용 읽는 중"}
                  {manual.analysisStatus === "failed" && `읽기 실패: ${manual.analysisError || "다시 등록해 주세요."}`}
                </span>
              </div>
              <a href={`/uploads/manuals/${manual.fileName}`} target="_blank" rel="noreferrer">
                열기
              </a>
            </li>
          ))}
        </ul>
      )}

      {manuals.some((manual) => manual.analysisStatus === "completed") && (
        <form className="manual-question" onSubmit={handleAsk}>
          <h3>설명서에 물어보기</h3>
          <label htmlFor="manual-question">제품 사용법이나 관리 방법을 질문해 보세요.</label>
          <textarea
            id="manual-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={1000}
            placeholder="예: 필터는 어떻게 청소해?"
            rows={3}
          />
          <button type="submit" disabled={asking || !question.trim()}>
            {asking ? "설명서를 확인하고 있어요..." : "질문하기"}
          </button>
        </form>
      )}

      {answer && (
        <div className="manual-answer" aria-live="polite">
          <h3>답변</h3>
          <p>{answer.answer}</p>
          {answer.citations?.length > 0 && (
            <div className="citations">
              <strong>설명서 근거</strong>
              {answer.citations.map((citation, index) => (
                <p key={`${citation.fileName}-${citation.pageNumber}-${index}`}>
                  {citation.fileName}, {citation.pageNumber}페이지: “{citation.quote}”
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
