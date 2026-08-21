/** 可选：Tavily 联网检索。未配置 TAVILY_API_KEY 时返回 null，由调用方决定是否跳过。 */

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export async function searchWeb(
  term: string
): Promise<SearchResult[] | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  const maxResults = Number(process.env.TAVILY_MAX_RESULTS || 5);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${term} 概念 详解`,
        search_depth: "basic",
        max_results: maxResults,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      console.error(`[search] Tavily error ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = (await res.json()) as {
      results?: Array<{ title?: unknown; url?: unknown; content?: unknown }>;
    };
    const results: SearchResult[] = Array.isArray(data.results)
      ? data.results
          .filter((r) => typeof r.url === "string")
          .map((r) => ({
            title: String(r.title || "").slice(0, 200),
            url: String(r.url || ""),
            content: String(r.content || "").slice(0, 300),
          }))
      : [];

    return results.length > 0 ? results : null;
  } catch (err) {
    console.error("[search] Tavily failed:", err);
    return null;
  }
}

/** 把检索结果格式化成 Markdown 区块（追加到流末尾） */
export function resultsToMarkdown(term: string, results: SearchResult[]): string {
  const lines: string[] = ["", "## 🔗 实时资料检索（联网）", ""];
  lines.push(`以下是与「${term}」相关的实时网络资料：`);
  results.forEach((r, i) => {
    const label = r.title ? `🔗 ${r.title}` : `🔗 ${r.url}`;
    lines.push(`${i + 1}. [${label}](${r.url})`);
    if (r.content) lines.push(`   ${r.content}`);
    lines.push("");
  });
  return lines.join("\n");
}
