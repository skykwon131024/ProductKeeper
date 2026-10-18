const API_BASE = "/api/products";

export async function recognizeProductImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_BASE}/recognize`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "제품 사진 분석에 실패했어요.");
  }
  return data;
}

export async function registerProduct(product) {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "제품 등록에 실패했어요.");
  }
  return data;
}

export async function fetchProducts() {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    throw new Error("제품 목록을 가져오지 못했어요.");
  }
  return response.json();
}

export async function uploadManuals(productId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch(`${API_BASE}/${productId}/manuals`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "설명서 등록에 실패했어요.");
  }
  return data;
}

export async function fetchManuals(productId) {
  const response = await fetch(`${API_BASE}/${productId}/manuals`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "설명서 목록을 가져오지 못했어요.");
  }
  return data;
}

export async function askManualQuestion(productId, question) {
  const response = await fetch(`${API_BASE}/${productId}/manuals/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "질문에 답하지 못했어요.");
  }
  return data;
}
