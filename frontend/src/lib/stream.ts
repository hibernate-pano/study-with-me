/** 报告解析：把流式累积的 Markdown 按 "## " 切分成区块 */

export interface Section {
  id: string;
  title: string;
  content: string;
}

/** 标题 -> 卡片配色/图标映射 */
export interface SectionStyle {
  accent: string; // 左边条颜色
  badge: string; // 徽标底色
}

export const STREAM_ERROR_MARKER = "<!-- STREAM_ERROR -->";
/** 上游因 max_tokens 截断时下发：内容残缺，不得当作完成报告入库。 */
export const STREAM_TRUNCATED_MARKER = "<!-- TRUNCATED -->";
/** 正常收尾标记：缺失即代表连接提前结束（截断/中断），前端必须拒绝入库。 */
export const STREAM_DONE_MARKER = "<!-- DONE -->";

/** 服务端流式中断标记：存在时前端不得把残缺内容当作完成报告入库。 */
export function hasStreamError(text: string): boolean {
  return text.includes(STREAM_ERROR_MARKER);
}

const ALL_STREAM_MARKERS = [STREAM_DONE_MARKER, STREAM_TRUNCATED_MARKER, STREAM_ERROR_MARKER];

/**
 * 剥掉流式协议标记（DONE / TRUNCATED / STREAM_ERROR）。
 * 这些是传输层信号，不属于报告正文：入库、复制、导出前统一走这里，
 * 避免存档里混入 `<!-- DONE -->`。
 */
export function stripStreamMarkers(text: string): string {
  let out = text;
  for (const m of ALL_STREAM_MARKERS) {
    out = out.split(m).join("");
  }
  return out.trimEnd();
}

export function styleForTitle(title: string): SectionStyle {
  // —— 对比报告专用标题（放在通用关键词之前，避免误匹配） ——
  if (title.includes("一句话辨析") || title.includes("辨析"))
    return { accent: "#8b5cf6", badge: "#f5f3ff" };
  if (title.includes("关键差异")) return { accent: "#6366f1", badge: "#eef2ff" };
  if (title.includes("架构"))
    return { accent: "#4f46e5", badge: "#eef2ff" }; // 仓库报告：架构/数据流
  if (title.includes("亮点"))
    return { accent: "#d97706", badge: "#fffbeb" }; // 仓库报告：为什么牛
  if (title.includes("场景")) return { accent: "#10b981", badge: "#ecfdf5" };
  if (title.includes("混淆")) return { accent: "#ef4444", badge: "#fef2f2" };
  if (title.includes("协同") || title.includes("组合"))
    return { accent: "#0d9488", badge: "#f0fdfa" };

  if (title.includes("定义")) return { accent: "#6366f1", badge: "#eef2ff" };
  if (title.includes("核心重点")) return { accent: "#f59e0b", badge: "#fffbeb" };
  if (title.includes("误区") || title.includes("易错"))
    return { accent: "#ef4444", badge: "#fef2f2" };
  if (title.includes("拆解")) return { accent: "#8b5cf6", badge: "#f5f3ff" };
  if (title.includes("进阶") || title.includes("路径"))
    return { accent: "#10b981", badge: "#ecfdf5" };
  if (title.includes("知识网络") || title.includes("知识图谱"))
    return { accent: "#06b6d4", badge: "#ecfeff" };
  if (title.includes("追问") || title.includes("自测"))
    return { accent: "#ec4899", badge: "#fdf2f8" };
  if (title.includes("资料") || title.includes("检索"))
    return { accent: "#0ea5e9", badge: "#f0f9ff" };
  return { accent: "#64748b", badge: "#f1f5f9" };
}

/** 标题去掉 emoji 和括号，用作锚点 id */
export function slugifyTitle(title: string): string {
  const cleaned = title.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").trim();
  return (
    "sec-" +
    cleaned
      .replace(/[（）()]/g, "")
      .replace(/\s+/g, "-")
  );
}

/**
 * 从全文抽出某个模块的原始 markdown（含 ### / 列表符号），供 parseNetworkMarkdown 二次解析。
 */
export function extractSectionRaw(md: string, titleIncludes: string): string {
  const lines = md.split("\n");
  let capture = false;
  const buf: string[] = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (capture) break; // 下一个 ## 区块结束
      if (m[1].includes(titleIncludes)) {
        capture = true;
        continue;
      }
      continue;
    }
    if (capture) buf.push(line);
  }
  return buf.join("\n");
}

/**
 * 从全文抽出某个模块的纯文本摘要（去掉 markdown 符号），用于卡片预览。
 * 命中标题含 titleIncludes 的 ## 区块，截取前 maxLen 字符。
 */
export function extractSectionText(md: string, titleIncludes: string, maxLen = 160): string {
  const lines = md.split("\n");
  let capture = false;
  const buf: string[] = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (capture) break; // 下一个 ## 区块结束
      if (m[1].includes(titleIncludes)) {
        capture = true;
        continue;
      }
      continue;
    }
    if (capture) buf.push(line);
  }
  let text = buf.join(" ").replace(/[\s\n]+/g, " ").trim();
  // 去掉残留的 md 装饰符号
  text = text.replace(/\*\*|\*|`|#{1,6}\s?|[-*]\s/g, "").trim();
  return text.slice(0, maxLen);
}

/**
 * 把累积的 markdown 文本解析成区块列表。
 * 流式场景下每帧全量重解析，内容量小，性能可接受。
 */
export function parseSections(md: string): Section[] {
  const lines = md.split("\n");
  const sections: Section[] = [];
  const used = new Set<string>();
  let current: Section | null = null;

  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      const title = m[1].trim();
      // 同名标题会产生同一个 slug：撞名时加序号后缀，避免折叠状态联动 + 目录锚点重复
      const base = slugifyTitle(title);
      let id = base;
      for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
      used.add(id);
      current = { id, title, content: "" };
      sections.push(current);
    } else if (current) {
      current.content += line + "\n";
    } else if (line.trim()) {
      // 第一个区块之前的散落内容，归入"引言"
      current = { id: "sec-intro", title: "引言", content: line + "\n" };
      sections.push(current);
    }
  }

  return sections;
}
