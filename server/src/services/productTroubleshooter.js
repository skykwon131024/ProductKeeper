import { searchManualsForProduct } from "./manualSearch.js";

function ensureValidAzureOpenAiConfig(endpoint, apiKey, deployment) {
  const placeholderRegex = /<\s*your[-_ ]?[a-zA-Z0-9_-]*\s*>|\bexample\b|\bplaceholder\b/i;

  if (!endpoint || !apiKey || !deployment) {
    throw new Error("Azure OpenAI 설정이 없습니다. server/.env에서 AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT 값을 입력해 주세요.");
  }

  if (placeholderRegex.test(endpoint) || placeholderRegex.test(apiKey) || placeholderRegex.test(deployment)) {
    throw new Error("Azure OpenAI 예시값이 그대로 남아 있습니다. server/.env에서 실제 Azure OpenAI endpoint, API key, deployment 이름으로 바꿔 주세요.");
  }

  try {
    new URL(endpoint);
  } catch {
    throw new Error("AZURE_OPENAI_ENDPOINT 값이 올바른 URL 형식이 아닙니다. Azure Portal의 Keys and Endpoint 값을 그대로 넣어 주세요.");
  }
}

export async function diagnoseProductIssue(product, manuals, symptom) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

  ensureValidAzureOpenAiConfig(endpoint, apiKey, deployment);

  const pages = manuals
    .filter((manual) => manual.analysisStatus === "completed" && Array.isArray(manual.pages))
    .flatMap((manual) =>
      manual.pages.map((page) => ({
        manualId: manual.id,
        fileName: manual.originalName,
        pageNumber: page.pageNumber,
        text: page.text,
      }))
    );

  const manualLinks = await searchManualsForProduct(product).catch(() => []);
  const context = pages
    .map((page) => `[설명서: ${page.fileName}, ${page.pageNumber}페이지]\n${page.text}`)
    .join("\n\n")
    .slice(0, 90000);

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "너는 제품 문제 해결 도우미다. 제품 설명서와 일반적인 사용자 경험을 바탕으로 한국어로 안전하게 답한다. " +
            "설명서에 근거가 없으면 '확인할 수 없음'이라고 명확히 말하고 추측하지 않는다. " +
            "전기, 과열, 연기, 물기, 타는 냄새, 비정상적인 전원 문제는 사용을 중단하고 제조사 서비스센터 문의를 권한다. " +
            "아래 JSON 형식만 반환한다: " +
            '{"answer":"요약 답변","checklist":["점검 항목 1","점검 항목 2"],"nextAction":"다음 행동","risk":"안전|주의|위험","foundInManual":true}',
        },
        {
          role: "user",
          content: `제품 정보: ${product.brand} ${product.productName} ${product.modelName}\n문제 증상: ${symptom}\n\n설명서 내용:\n${context || "설명서 내용이 없습니다."}\n\n검색된 공식 매뉴얼 후보:\n${manualLinks.length > 0 ? manualLinks.map((item) => `${item.title}: ${item.url}`).join("\n") : "없음"}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 문제 해결 요청이 실패했습니다 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const result = JSON.parse(content);
    const checklist = Array.isArray(result.checklist)
      ? result.checklist.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [];

    return {
      answer: typeof result.answer === "string" ? result.answer : "문제 해결을 위한 점검을 정리해 볼게요.",
      checklist,
      nextAction:
        typeof result.nextAction === "string"
          ? result.nextAction
          : "먼저 기본 점검을 하고, 그래도 해결되지 않으면 제조사 공식 지원을 확인해 주세요.",
      risk: typeof result.risk === "string" ? result.risk : "주의",
      foundInManual: result.foundInManual === true,
    };
  } catch {
    return {
      answer: "문제 해결 가이드를 정리하는 중 문제가 발생했어요. 증상을 조금 더 구체적으로 적어 다시 시도해 주세요.",
      checklist: [
        "전원 상태와 연결 상태를 확인해 보세요.",
        "필터, 배터리, 케이블, 장착 상태를 점검해 보세요.",
        "안전한 상태가 아니라면 제조사 서비스센터에 문의해 주세요.",
      ],
      nextAction: "기본 점검 후에도 동일하게 문제가 지속되면 제품 설명서나 제조사 지원센터를 확인해 주세요.",
      risk: "주의",
      foundInManual: false,
    };
  }
}
