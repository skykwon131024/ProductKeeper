import { useEffect, useState } from "react";
import { fetchProducts } from "../api.js";

export default function ProductList({ refreshKey }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedId, setSelectedId] = useState(null);

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

  const selected = products.find((product) => product.id === selectedId);

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
        </div>
      )}
    </section>
  );
}
