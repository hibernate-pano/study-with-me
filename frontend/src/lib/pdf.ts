/** PDF 文本提取：文件只在浏览器内处理，不上传到服务器。 */

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export interface ParsedPdf {
  fileName: string;
  pageCount: number;
  pages: string[];
  emptyPages: number[];
}

export function normalizePageRange(
  start: number,
  end: number,
  pageCount: number
): { start: number; end: number } {
  const safeCount = Math.max(0, Math.floor(pageCount));
  if (safeCount === 0) return { start: 0, end: 0 };
  const a = Math.max(1, Math.min(safeCount, Math.floor(start) || 1));
  const b = Math.max(1, Math.min(safeCount, Math.floor(end) || safeCount));
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

export function buildPageRangeText(
  pages: readonly string[],
  start: number,
  end: number
): string {
  const range = normalizePageRange(start, end, pages.length);
  const out: string[] = [];
  for (let page = range.start; page <= range.end; page++) {
    const text = (pages[page - 1] ?? "").trim();
    if (text) out.push(`[第 ${page} 页]\n${text}`);
  }
  return out.join("\n\n");
}

export async function extractPdfPages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ParsedPdf> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("PDF 超过 50MB，请先用阅读器拆分后再上传");
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await task.promise;
  const pages: string[] = [];
  const emptyPages: number[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
          .join(" ")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        pages.push(text);
        if (text.length < 20) emptyPages.push(pageNumber);
      } finally {
        page.cleanup();
      }
      onProgress?.(pageNumber, pdf.numPages);
    }
  } finally {
    await pdf.destroy();
  }

  const totalChars = pages.reduce((sum, text) => sum + text.length, 0);
  if (totalChars < 100) {
    throw new Error(
      "没有提取到可用文字。这个 PDF 可能是扫描版，V1 暂不支持 OCR，请先换可复制文字的 PDF。"
    );
  }

  return {
    fileName: file.name,
    pageCount: pages.length,
    pages,
    emptyPages,
  };
}
