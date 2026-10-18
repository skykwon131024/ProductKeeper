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
    "너는 제품 사진을 보고 브랜드, 제품명, 모델명을 추정하는 도우미야. " +
    "반드시 아래 형식의 JSON 객체 하나만 answer로 돌려줘. 다른 설명은 붙이지 마.\n" +
    '{"brand": "브랜드명 또는 빈 문자열", "productName": "제품명 또는 빈 문자열", ' +
    '"modelName": "모델명 또는 빈 문자열", "confidence": "높음|보통|낮음", ' +
    '"rawNote": "판별이 어려운 이유나 참고할 점을 한국어로 한 문장"}';

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
              text: "이 제품 사진을 보고 브랜드, 제품명, 모델명을 추정해줘.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 400,
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
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : content;

  try {
    const parsed = JSON.parse(jsonText);
    return {
      brand: parsed.brand ?? "",
      productName: parsed.productName ?? "",
      modelName: parsed.modelName ?? "",
      confidence: parsed.confidence ?? "보통",
      rawNote: parsed.rawNote ?? "",
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
