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

export function styleForTitle(title: string): SectionStyle {
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
 * 把累积的 markdown 文本解析成区块列表。
 * 流式场景下每帧全量重解析，内容量小，性能可接受。
 */
export function parseSections(md: string): Section[] {
  const lines = md.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      const title = m[1].trim();
      current = { id: slugifyTitle(title), title, content: "" };
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
