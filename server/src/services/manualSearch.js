function normalizeText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

function resolveDuckDuckGoUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl, "https://duckduckgo.com");
    const direct = parsed.searchParams.get("uddg");
    if (direct) {
      const resolved = new URL(direct);
      if (["http:", "https:"].includes(resolved.protocol)) {
        return resolved.href;
      }
    }
    if (["http:", "https:"].includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch {
    // 무시하고 빈값으로 반환한다.
  }

  return "";
}

function extractSearchResults(html) {
  const seen = new Set();
  const results = [];
  const regex = /<a[^>]*class="[^"]*(?:result__a|result-link)[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    const rawHref = match[1];
    const resolved = resolveDuckDuckGoUrl(rawHref);
    if (!resolved) continue;

    const title = stripHtml(match[2]);
    if (!title || seen.has(resolved)) continue;

    seen.add(resolved);
    results.push({
      title: title || resolved,
      url: resolved,
    });
  }

  return results;
}

export async function searchManualsForProduct(product) {
  const productName = normalizeText(product?.productName || "");
  const brand = normalizeText(product?.brand || "");
  const modelName = normalizeText(product?.modelName || "");

  const queries = [
    [brand, modelName, productName, "manual"].filter(Boolean).join(" "),
    [brand, modelName, "사용 설명서 pdf"].filter(Boolean).join(" "),
    [productName, "manual pdf"].filter(Boolean).join(" "),
  ].filter(Boolean);

  for (const query of queries) {
    const url = `https://duckduckgo.com/html/?${new URLSearchParams({ q: query, kl: "ko-kr" })}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 ProductKeeper",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    const results = extractSearchResults(html);
    if (results.length > 0) {
      return results.slice(0, 5);
    }
  }

  return [];
}
