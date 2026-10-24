import { useEffect, useState } from "react";
import {
  addMaintenance,
  deleteMaintenance,
  diagnoseProductIssue,
  fetchMaintenance,
  fetchProducts,
  updateMaintenance,
  updateProduct,
} from "../api.js";

export default function ProductList({ refreshKey }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [symptom, setSymptom] = useState("");
  const [diagnosis, setDiagnosis] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    purchaseDate: "",
    purchasePrice: "",
    purchaseStore: "",
    warrantyMonths: "",
    warrantyEndDate: "",
  });
  const [savingPurchaseInfo, setSavingPurchaseInfo] = useState(false);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: "",
    intervalMonths: "",
    nextDueDate: "",
  });
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchProducts();
        if (active) setProducts(data);
      } catch (error) {
        if (active) setErrorMessage(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (loading) return <p className="hint">제품 목록을 불러오는 중이에요...</p>;
  if (errorMessage) return <p className="error">{errorMessage}</p>;
  if (products.length === 0) {
    return <p className="hint">아직 등록된 제품이 없어요. 위에서 첫 제품을 등록해 보세요.</p>;
  }

  useEffect(() => {
    setSymptom("");
    setDiagnosis(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = products.find((product) => product.id === selectedId);
    if (!selected) return;

    setPurchaseForm({
      purchaseDate: selected.purchaseDate ?? "",
      purchasePrice: selected.purchasePrice ?? "",
      purchaseStore: selected.purchaseStore ?? "",
      warrantyMonths: selected.warrantyMonths ?? "",
      warrantyEndDate: selected.warrantyEndDate ?? "",
    });
    setMaintenanceForm({
      title: "",
      intervalMonths: "",
      nextDueDate: "",
    });
  }, [selectedId, products]);

  useEffect(() => {
    if (!selectedId) return;

    async function loadMaintenance() {
      try {
        const data = await fetchMaintenance(selectedId);
        setMaintenanceItems(data);
      } catch {
        setMaintenanceItems([]);
      }
    }

    loadMaintenance();
  }, [selectedId]);

  const selected = products.find((product) => product.id === selectedId);

  async function handlePurchaseInfoSave(event) {
    event.preventDefault();
    if (!selected) return;

    setSavingPurchaseInfo(true);
    try {
      await updateProduct(selected.id, purchaseForm);
      const refreshed = await fetchProducts();
      setProducts(refreshed);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSavingPurchaseInfo(false);
    }
  }

  async function handleAddMaintenance(event) {
    event.preventDefault();
    if (!selected || !maintenanceForm.title.trim() || !maintenanceForm.nextDueDate || !maintenanceForm.intervalMonths) return;

    setMaintenanceSaving(true);
    try {
      const saved = await addMaintenance(selected.id, {
        title: maintenanceForm.title.trim(),
        intervalMonths: Number(maintenanceForm.intervalMonths),
        nextDueDate: maintenanceForm.nextDueDate,
      });
      setMaintenanceItems((prev) => [...prev, saved]);
      setMaintenanceForm({ title: "", intervalMonths: "", nextDueDate: "" });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setMaintenanceSaving(false);
    }
  }

  async function toggleMaintenanceComplete(item) {
    try {
      const updated = await updateMaintenance(selected.id, item.id, { completed: !item.completed });
      setMaintenanceItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function removeMaintenance(item) {
    try {
      await deleteMaintenance(selected.id, item.id);
      setMaintenanceItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleDiagnose(event) {
    event.preventDefault();
    if (!selected || !symptom.trim()) return;

    setDiagnosing(true);
    setDiagnosis(null);

    try {
      const result = await diagnoseProductIssue(selected.id, symptom.trim());
      setDiagnosis(result);
    } catch (error) {
      setDiagnosis({
        answer: error.message,
        checklist: [],
        nextAction: "잠시 후 다시 시도해 주세요.",
        risk: "주의",
        foundInManual: false,
      });
    } finally {
      setDiagnosing(false);
    }
  }

  return (
    <section className="card">
      <h2>2. 내가 등록한 제품</h2>
      <ul className="product-grid">
        {products.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              className={`product-tile ${selectedId === product.id ? "selected" : ""}`}
              onClick={() => setSelectedId(product.id === selectedId ? null : product.id)}
            >
              {product.imageFileName && (
                <img src={`/uploads/${product.imageFileName}`} alt={product.productName} />
              )}
              <strong>{product.productName}</strong>
              <span>{product.brand}</span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="product-detail">
          <h3>{selected.productName}</h3>
          <p>브랜드: {selected.brand || "미입력"}</p>
          <p>모델명: {selected.modelName || "미입력"}</p>
          <p>등록일: {new Date(selected.registeredAt).toLocaleString("ko-KR")}</p>

          <form className="purchase-form" onSubmit={handlePurchaseInfoSave}>
            <h3>6. 구매 정보 및 보증 기간</h3>
            <label>
              구매일
              <input
                type="date"
                value={purchaseForm.purchaseDate}
                onChange={(event) => setPurchaseForm((prev) => ({ ...prev, purchaseDate: event.target.value }))}
              />
            </label>
            <label>
              구매 가격
              <input
                type="number"
                min="0"
                value={purchaseForm.purchasePrice}
                onChange={(event) => setPurchaseForm((prev) => ({ ...prev, purchasePrice: event.target.value }))}
              />
            </label>
            <label>
              구매처
              <input
                type="text"
                value={purchaseForm.purchaseStore}
                onChange={(event) => setPurchaseForm((prev) => ({ ...prev, purchaseStore: event.target.value }))}
                placeholder="예: 온라인 쇼핑몰"
              />
            </label>
            <label>
              보증 기간(개월)
              <input
                type="number"
                min="0"
                value={purchaseForm.warrantyMonths}
                onChange={(event) => setPurchaseForm((prev) => ({ ...prev, warrantyMonths: event.target.value }))}
              />
            </label>
            <label>
              보증 종료일
              <input
                type="date"
                value={purchaseForm.warrantyEndDate}
                onChange={(event) => setPurchaseForm((prev) => ({ ...prev, warrantyEndDate: event.target.value }))}
              />
            </label>
            <button type="submit" disabled={savingPurchaseInfo}>
              {savingPurchaseInfo ? "저장 중..." : "구매 정보 저장"}
            </button>
          </form>

          {selected.purchaseDate || selected.purchaseStore || selected.warrantyEndDate || selected.warrantyMonths ? (
            <div className="purchase-summary">
              {selected.purchaseDate && <p>구매일: {new Date(selected.purchaseDate).toLocaleDateString("ko-KR")}</p>}
              {selected.purchasePrice && <p>구매 가격: {Number(selected.purchasePrice).toLocaleString("ko-KR")}원</p>}
              {selected.purchaseStore && <p>구매처: {selected.purchaseStore}</p>}
              {selected.warrantyMonths && <p>보증 기간: {selected.warrantyMonths}개월</p>}
              {selected.warrantyEndDate && <p>보증 종료일: {new Date(selected.warrantyEndDate).toLocaleDateString("ko-KR")}</p>}
            </div>
          ) : (
            <p className="hint">구매 정보와 보증 기간이 아직 없어요. 위에서 입력해 주세요.</p>
          )}

          <form className="maintenance-form" onSubmit={handleAddMaintenance}>
            <h3>7. 제품 관리 알림</h3>
            <label>
              관리 항목
              <input
                type="text"
                value={maintenanceForm.title}
                onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="예: 필터 교체"
              />
            </label>
            <label>
              주기(개월)
              <input
                type="number"
                min="1"
                value={maintenanceForm.intervalMonths}
                onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, intervalMonths: event.target.value }))}
                placeholder="예: 6"
              />
            </label>
            <label>
              다음 예정일
              <input
                type="date"
                value={maintenanceForm.nextDueDate}
                onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, nextDueDate: event.target.value }))}
              />
            </label>
            <button type="submit" disabled={maintenanceSaving || !maintenanceForm.title.trim() || !maintenanceForm.nextDueDate || !maintenanceForm.intervalMonths}>
              {maintenanceSaving ? "저장 중..." : "관리 일정 추가"}
            </button>
          </form>

          {maintenanceItems.length > 0 && (
            <div className="maintenance-list">
              {maintenanceItems.map((item) => (
                <div key={item.id} className={`maintenance-item ${item.completed ? "done" : "pending"}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>다음 예정일: {new Date(item.nextDueDate).toLocaleDateString("ko-KR")}</p>
                    <p>주기: {item.intervalMonths}개월</p>
                  </div>
                  <div className="maintenance-actions">
                    <button type="button" onClick={() => toggleMaintenanceComplete(item)}>
                      {item.completed ? "완료 취소" : "완료 처리"}
                    </button>
                    <button type="button" className="danger" onClick={() => removeMaintenance(item)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form className="troubleshoot-form" onSubmit={handleDiagnose}>
            <h3>5. AI 제품 문제 해결</h3>
            <label htmlFor="trouble-symptom">어떤 증상이 있나요?</label>
            <textarea
              id="trouble-symptom"
              value={symptom}
              onChange={(event) => setSymptom(event.target.value)}
              rows={4}
              placeholder="예: 청소기가 갑자기 켜지지 않아요. 전원은 들어오는데 작동이 멈췄어요."
            />
            <button type="submit" disabled={diagnosing || !symptom.trim()}>
              {diagnosing ? "점검 가이드를 만들고 있어요..." : "문제 해결 가이드 받기"}
            </button>
          </form>

          {diagnosis && (
            <div className="troubleshoot-result" aria-live="polite">
              <p className="risk-badge">위험도: {diagnosis.risk || "주의"}</p>
              <p>{diagnosis.answer}</p>
              {diagnosis.checklist?.length > 0 && (
                <ul>
                  {diagnosis.checklist.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              )}
              {diagnosis.nextAction && <p className="next-action">다음 행동: {diagnosis.nextAction}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
