export async function answerManualQuestion(product, manuals, question) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

  if (!endpoint || !apiKey || !deployment) {
    throw new Error("Azure OpenAI 설정이 없습니다. server/.env 값을 확인해 주세요.");
  }

  const pages = manuals.flatMap((manual) =>
    (manual.pages ?? []).map((page) => ({
      manualId: manual.id,
      fileName: manual.originalName,
      pageNumber: page.pageNumber,
      text: page.text,
    }))
  );
  const context = pages
    .map((page) => `[설명서: ${page.fileName}, ${page.pageNumber}페이지]\n${page.text}`)
    .join("\n\n")
    .slice(0, 90000);

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "너는 제품 설명서 안내 도우미다. 제공된 설명서 내용만 근거로 한국어로 답한다. " +
            "설명서에 근거가 없거나 내용이 불충분하면 추측하지 말고 확인할 수 없다고 답한다. " +
            "위험한 수리 방법을 안내하지 말고, 필요하면 제조사 서비스센터에 문의하라고 한다. " +
            "짧고 쉬운 말로 답하고 아래 JSON 형식만 반환한다: " +
            '{"answer":"답변", "citations":[{"fileName":"파일명", "pageNumber":1, "quote":"근거 문장"}], "foundInManual":true}',
        },
        {
          role: "user",
          content: `제품: ${product.brand} ${product.productName} ${product.modelName}\n질문: ${question}\n\n설명서 내용:\n${context}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI 답변 요청이 실패했습니다 (${response.status}).`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    const result = JSON.parse(content);
    const citations = Array.isArray(result.citations)
      ? result.citations.filter((citation) => {
          const page = pages.find(
            (item) =>
              item.fileName === citation.fileName &&
              item.pageNumber === Number(citation.pageNumber)
          );
          const quote = typeof citation.quote === "string" ? citation.quote.trim() : "";
          return Boolean(page && quote && page.text.includes(quote));
        })
      : [];

    if (citations.length === 0) {
      return {
        answer: "등록된 설명서에서 이 질문의 근거를 찾지 못했어요. 설명서를 직접 확인하거나 제조사에 문의해 주세요.",
        citations: [],
        foundInManual: false,
      };
    }

    return {
      answer: typeof result.answer === "string" ? result.answer : "설명서에서 답을 확인하지 못했어요.",
      citations,
      foundInManual: result.foundInManual === true,
    };
  } catch {
    return {
      answer: "답변을 정리하는 중 문제가 생겼어요. 질문을 조금 바꿔 다시 시도해 주세요.",
      citations: [],
      foundInManual: false,
    };
  }
}
