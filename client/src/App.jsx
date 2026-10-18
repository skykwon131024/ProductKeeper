import { useState } from "react";
import ProductCapture from "./components/ProductCapture.jsx";
import ProductList from "./components/ProductList.jsx";
import ManualManager from "./components/ManualManager.jsx";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="app">
      <header>
        <h1>ProductKeeper</h1>
        <p className="hint">내가 산 제품을 사진으로 찍어서 쉽게 등록해 보세요.</p>
      </header>

      <ProductCapture onRegistered={() => setRefreshKey((key) => key + 1)} />
      <ProductList refreshKey={refreshKey} />
      <ManualManager refreshKey={refreshKey} />
    </main>
  );
}
