import fs from "node:fs/promises";

/**
 * 제품 사진을 Azure OpenAI(비전 지원 모델)에 보내서
 * 브랜드, 제품명, 모델명을 인식한다.
 * @param {string} imagePath - 업로드된 이미지 파일의 경로
 * @returns {Promise<{brand: string, productName: string, modelName: string, confidence: string, rawNote: string}>}
 */
export async function recognizeProductFromImage(imagePath) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

  if (!endpoint || !apiKey || !deployment) {
    throw new Error(
      "Azure OpenAI 설정이 비어 있습니다. server/.env 파일에 AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT를 채워주세요."
    );
  }

  const imageBuffer = await fs.readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = guessMimeType(imagePath);

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const systemPrompt =
    "너는 설명서가 있는 제품의 이미지 판독 전문가다. " +
    "가전제품, 주방가전, 생활가전, 청소기, 정수기, 공기청정기, 전자제품, 사무기기, 소형가전, 공구, 의료기기, 보안기기, 가구, 조명, 케이스/액세서리 등 설명서가 있는 모든 소비재 제품을 다룰 수 있어야 한다. " +
    "사진에서 로고, 브랜드명, 라벨, 화면 문구, 버튼, 모델명 표기, 제품 형태, 제품군 패턴을 우선 확인해 브랜드, 제품 종류, 모델명을 추정한다. " +
    "가장 중요하게는: (1) 실제로 보이는 텍스트를 우선적으로 읽기, (2) 제조사 로고나 로고 배치 확인, (3) 제품의 일반적인 분류(예: 공기청정기, 세탁기, 청소기, 전기레인지, 의류건조기, 젖병소독기, 스탠드, 블렌더, 로봇청소기, 프린터, 모니터 등) 파악, (4) 모델명이 보이지 않으면 빈 문자열로 남기기. " +
    "잘 보이는 제품명/모델명이 있다면 그 값만 가장 정확히 사용하고, 추측으로 비슷한 이름을 만들어내지 마라. " +
    "보이지 않는 정보는 빈 문자열로 두고, 정확도가 낮아도 과장하지 말아라. " +
    "반드시 아래 형식의 JSON 객체 하나만 반환한다. 다른 설명은 붙이지 마.\n" +
    '{"brand": "브랜드명 또는 빈 문자열", "productName": "제품명 또는 빈 문자열", ' +
    '"modelName": "모델명 또는 빈 문자열", "confidence": "높음|보통|낮음", ' +
    '"rawNote": "판별 근거와 참고할 점을 한국어로 한 문장"}';

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "이 이미지는 설명서가 있는 제품의 사진이다. 제품의 브랜드, 제품명, 모델명을 추정해줘. " +
                "이 제품이 가전제품인지 생활용품인지 사무기기인지 상관없이, 로고, 라벨, 화면 표기, 버튼, 모델명, 제품 형태를 먼저 살펴봐. " +
                "실제로 보이는 텍스트를 우선 활용하고, 보이지 않으면 빈 값으로 두어라. " +
                "비슷한 이름을 떠올려 임의로 채우지 말고, 확인 가능한 근거만 사용해라.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_completion_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI 호출에 실패했습니다 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? "";

  return parseRecognitionResult(content);
}

function guessMimeType(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function parseRecognitionResult(content) {
  const cleaned = String(content ?? "").replace(/```json|```/gi, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : cleaned;

  try {
    const parsed = JSON.parse(jsonText);
    const brand = typeof parsed.brand === "string" ? parsed.brand.trim() : "";
    const productName = typeof parsed.productName === "string" ? parsed.productName.trim() : "";
    const modelName = typeof parsed.modelName === "string" ? parsed.modelName.trim() : "";
    const filledFields = [brand, productName, modelName].filter(Boolean).length;
    const inferredConfidence =
      parsed.confidence === "높음" || filledFields >= 2
        ? "높음"
        : parsed.confidence === "보통" || filledFields === 1
          ? "보통"
          : "낮음";

    return {
      brand,
      productName,
      modelName,
      confidence: inferredConfidence,
      rawNote: typeof parsed.rawNote === "string" && parsed.rawNote.trim() ? parsed.rawNote.trim() : "제품 로고와 라벨 정보를 기준으로 추정했습니다.",
    };
  } catch {
    return {
      brand: "",
      productName: "",
      modelName: "",
      confidence: "낮음",
      rawNote: "AI 응답을 해석하지 못했습니다. 직접 입력해 주세요.",
    };
  }
}
