const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 80;

export async function extractPagesFromDocument(filePath, contentType) {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  const apiVersion = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION || "2024-11-30";

  if (!endpoint || !apiKey) {
    throw new Error("Azure 문서 읽기 설정이 없습니다. server/.env에 문서 읽기 주소와 키를 설정해 주세요.");
  }

  const document = await (await import("node:fs/promises")).readFile(filePath);
  const analyzeUrl = new URL(
    `${endpoint.replace(/\/$/, "")}/documentintelligence/documentModels/prebuilt-read:analyze`
  );
  analyzeUrl.searchParams.set("api-version", apiVersion);

  const response = await fetch(analyzeUrl, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": contentType,
    },
    body: document,
  });

  if (!response.ok) {
    throw new Error(`문서 읽기 요청이 실패했습니다 (${response.status}).`);
  }

  const operationUrl = response.headers.get("operation-location");
  if (!operationUrl) {
    throw new Error("문서 읽기 작업 주소를 받지 못했습니다.");
  }

  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const pollResponse = await fetch(operationUrl, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
    });

    if (!pollResponse.ok) {
      throw new Error(`문서 읽기 결과를 가져오지 못했습니다 (${pollResponse.status}).`);
    }

    const result = await pollResponse.json();
    if (result.status === "succeeded") {
      return (result.analyzeResult?.pages ?? []).map((page) => ({
        pageNumber: page.pageNumber,
        text: (page.lines ?? []).map((line) => line.content).join("\n"),
      }));
    }
    if (result.status === "failed") {
      throw new Error("문서에서 글자를 읽지 못했습니다. 파일이 선명한지 확인해 주세요.");
    }
  }

  throw new Error("문서 읽는 시간이 너무 오래 걸렸습니다. 잠시 후 다시 시도해 주세요.");
}
