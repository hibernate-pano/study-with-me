/** 分享链接：把报告全文 lz-string 压缩进 URL hash，零后端成本。
 * 形如 /analyze/分布式锁#report=<compressed>
 */

import LZString from "lz-string";

export function encodeShare(fullText: string): string {
  return LZString.compressToEncodedURIComponent(fullText);
}

export function decodeShare(code: string): string {
  if (!code) return "";
  try {
    return LZString.decompressFromEncodedURIComponent(code) ?? "";
  } catch {
    return "";
  }
}

/** 构造可复制的分享 URL（客户端 location 才可用，必须在浏览器调用） */
export function buildShareUrl(term: string, fullText: string): string {
  const base = `${window.location.origin}/analyze/${encodeURIComponent(term)}`;
  return `${base}#report=${encodeShare(fullText)}`;
}

/** 从当前 location.hash 里解析 report 参数，无则返回空串 */
export function readShareHash(): string {
  return typeof window !== "undefined" ? decodeShare(readReportCode()) : "";
}

export function readReportCode(): string {
  if (typeof window === "undefined") return "";
  const m = window.location.hash.match(/report=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}