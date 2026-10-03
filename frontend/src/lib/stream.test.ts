import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { markdownCodeComponents } from "@/components/codeRenderer";
import { parseSections, slugifyTitle, styleForTitle, extractSectionRaw, extractSectionText } from "./stream";

// CodeBlock.tsx 含 JSX，vitest 在 tsconfig jsx:preserve 下无法解析 .tsx（同 SectionCard.test.ts 的处理）。
// 这里只关心「流式半截 buffer 会不会被当成 mermaid 代码块交给 CodeBlock」，用替身记录入参即可。
const { codeBlockCalls } = vi.hoisted(() => ({
  codeBlockCalls: [] as { className?: string; text: string }[],
}));
vi.mock("@/components/CodeBlock", () => ({
  default: ({ children, className }: { children?: ReactNode; className?: string }) => {
    codeBlockCalls.push({ className, text: String(children ?? "") });
    return createElement("pre", null, createElement("code", { className }, children));
  },
}));

describe("parseSections", () => {
  it("解析标准 ## 分区", () => {
    const md = `## 第一节
内容A

## 第二节
内容B
`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("第一节");
    expect(sections[0].content.trim()).toBe("内容A");
    expect(sections[1].title).toBe("第二节");
    expect(sections[1].content.trim()).toBe("内容B");
  });

  it("## 之前的散落内容归入「引言」section", () => {
    const md = `前导文字

## 第一节
内容A
`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].id).toBe("sec-intro");
    expect(sections[0].title).toBe("引言");
    expect(sections[0].content.trim()).toBe("前导文字");
    expect(sections[1].title).toBe("第一节");
  });

  it("空 markdown 返回空数组", () => {
    expect(parseSections("")).toEqual([]);
  });

  it("## 后没有内容时 content 为空字符串", () => {
    const md = `## 只有标题`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("只有标题");
    expect(sections[0].content).toBe("");
  });

  it("保留嵌套 markdown 内容（含 ###, 列表, 引用块）", () => {
    const md = `## 拆解
### 子项1
- item1
- item2

> 引用

### 子项2
text
`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].content).toContain("### 子项1");
    expect(sections[0].content).toContain("- item1");
    expect(sections[0].content).toContain("> 引用");
  });

  it("不会把 ### 误判为 ##", () => {
    const md = `## 第一节
### 这是三级标题
- 列表项
`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].content).toContain("### 这是三级标题");
  });

  it("支持 8 个标准模块的标题", () => {
    const md = `## 🎯 一句话定义
def

## 📌 核心重点（最重要的事）
key

## ⚠️ 常见误区与易错点
warn

## 🧩 拆解分析
break

## 🧭 学习进阶路径
path

## 🌐 知识网络（相关 / 相似 / 相反 / 跨领域）
net

## 🔍 深入追问
ask

## 📚 推荐资料
ref
`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(8);
    expect(sections.map((s) => s.title)).toEqual([
      "🎯 一句话定义",
      "📌 核心重点（最重要的事）",
      "⚠️ 常见误区与易错点",
      "🧩 拆解分析",
      "🧭 学习进阶路径",
      "🌐 知识网络（相关 / 相似 / 相反 / 跨领域）",
      "🔍 深入追问",
      "📚 推荐资料",
    ]);
  });
});

describe("slugifyTitle", () => {
  it("为标题生成稳定的 id（sec- 前缀 + 清理后的字符）", () => {
    expect(slugifyTitle("一句话定义")).toBe("sec-一句话定义");
  });

  it("清理 emoji 字符", () => {
    expect(slugifyTitle("🎯 一句话定义")).toBe("sec-一句话定义");
  });

  it("清理中英文括号", () => {
    expect(slugifyTitle("核心重点（最重要的事）")).toBe("sec-核心重点最重要的事");
    expect(slugifyTitle("title (paren)")).toBe("sec-title-paren");
  });

  it("空格转 -", () => {
    expect(slugifyTitle("hello world")).toBe("sec-hello-world");
  });

  it("全 emoji 标题处理后仍以 sec- 开头", () => {
    const result = slugifyTitle("🎯📌⚠️");
    expect(result.startsWith("sec-")).toBe(true);
  });

  it("相同标题产生相同 id（流式期间 id 稳定）", () => {
    expect(slugifyTitle("一句话定义")).toBe(slugifyTitle("一句话定义"));
  });
});

describe("styleForTitle", () => {
  it("为每个模块返回稳定的配色", () => {
    expect(styleForTitle("🎯 一句话定义").accent).toBe("#2a4a72");
    expect(styleForTitle("📌 核心重点").accent).toBe("#9d7414");
    expect(styleForTitle("⚠️ 常见误区").accent).toBe("#b3401f");
    expect(styleForTitle("🧩 拆解分析").accent).toBe("#56564f");
    expect(styleForTitle("🧭 学习进阶路径").accent).toBe("#1a7f4b");
    expect(styleForTitle("🌐 知识网络").accent).toBe("#3e6ea4");
    expect(styleForTitle("🔍 深入追问").accent).toBe("#7c3aed");
    expect(styleForTitle("📚 推荐资料").accent).toBe("#1f6b6b");
  });

  it("未匹配的标题走默认配色（slate）", () => {
    expect(styleForTitle("随便什么").accent).toBe("#75756d");
  });

  it("模糊匹配：包含关键词即识别", () => {
    expect(styleForTitle("核心重点（最重要的事）").accent).toBe("#9d7414");
    expect(styleForTitle("拆解").accent).toBe("#56564f");
  });
});

describe("extractSectionRaw", () => {
  it("抽出一个模块的原始 markdown（含 ### 与列表符号）", () => {
    const md = `## 🎯 一句话定义\ndef\n\n## 🌐 知识网络（相关 / 相似 / 相反 / 跨领域）\n### 前置知识\n- **A** — 先懂 A\n### 兄弟概念\n- **B** — 类似 B\n\n## 🔍 深入追问\nask\n`;
    const raw = extractSectionRaw(md, "知识网络");
    expect(raw).toContain("### 前置知识");
    expect(raw).toContain("- **A** — 先懂 A");
    expect(raw).not.toContain("## 🔍");
  });

  it("没命中时返回空串", () => {
    expect(extractSectionRaw("## 任意标题\ntext", "不存在的词")).toBe("");
  });
});

describe("extractSectionText", () => {
  it("抽纯文本摘要并去掉 markdown 装饰", () => {
    const md = "## 🎯 一句话定义\n**核心要点**是 `code` 和 *斜体*。\n\n## 📌 核心重点\nother\n";
    const text = extractSectionText(md, "定义");
    expect(text).toContain("核心要点");
    expect(text).not.toContain("**");
    expect(text).not.toContain("`");
  });

  it("超过 maxLen 截断", () => {
    const md = `## 定义\n${'字'.repeat(100)}`;
    expect(extractSectionText(md, "定义", 30).length).toBeLessThanOrEqual(30);
  });

  it("没命中返回空串", () => {
    expect(extractSectionText("## x\n内容", "yyy")).toBe("");
  });
});

/**
 * 流式半截 mermaid 围栏 —— Mermaid 失败态的**输入侧**。
 *
 * 这组不测组件（node 环境无 DOM，.tsx 也无法被 vitest 解析，见 Mermaid.contract.test.ts 顶部说明），
 * 而是把「Mermaid 为什么会先失败一次」这条链路用真实代码跑通：流式期间前端每 120ms 用当前
 * buffer 重跑一次 parseSections，未闭合的 ``` 围栏在 CommonMark 里合法，照样产出代码节点。
 * 它守的是 Mermaid 必须扛住半截输入这个前提——前提没了，组件里的 setError(null) 就白写了。
 */
describe("流式半截 mermaid 围栏（喂给 Mermaid 的输入侧）", () => {
  const ARCH = "架构模块";
  // 一段真实会产出 mermaid 的深挖输出，截成流式过程中的若干帧
  const STREAM_FRAMES = [
    `## ${ARCH}\n\n\`\`\`mermaid\n`,
    `## ${ARCH}\n\n\`\`\`mermaid\ng`,
    `## ${ARCH}\n\n\`\`\`mermaid\ngraph T`,
    `## ${ARCH}\n\n\`\`\`mermaid\ngraph TD\n A[深挖] -->`,
    `## ${ARCH}\n\n\`\`\`mermaid\ngraph TD\n A[深挖] --> B[复习卡]\n\`\`\``,
  ];

  const renderFrame = (frame: string): void => {
    codeBlockCalls.length = 0;
    const arch = parseSections(frame).find((s) => s.title === ARCH);
    expect(arch, `帧没解析出「${ARCH}」section：${JSON.stringify(frame)}`).toBeTruthy();
    renderToStaticMarkup(createElement(ReactMarkdown, { components: markdownCodeComponents }, arch!.content));
  };

  it("半截围栏原样进 section content，parseSections 不得缓冲或丢弃", () => {
    for (const frame of STREAM_FRAMES) {
      const arch = parseSections(frame).find((s) => s.title === ARCH);
      expect(arch, "帧没解析出「架构模块」section").toBeTruthy();
      expect(arch!.content, "半截围栏必须原样保留，否则流式过程中这段代码会整段闪没").toContain("```mermaid");
    }
  });

  it("围栏未闭合时照样被渲染成 language-mermaid 代码块（Mermaid 每帧都会被喂一次半截输入）", () => {
    for (const frame of STREAM_FRAMES.slice(0, -1)) {
      renderFrame(frame);
      const mermaid = codeBlockCalls.find((c) => (c.className ?? "").includes("language-mermaid"));
      expect(mermaid, `半截围栏没被识别成 mermaid 代码块：${JSON.stringify(frame)}`).toBeTruthy();
    }
  });

  it("只有最后一帧才是完整可渲染的图（半截帧的 text 都是残缺的）", () => {
    for (const frame of STREAM_FRAMES.slice(0, -1)) {
      renderFrame(frame);
      const mermaid = codeBlockCalls.find((c) => (c.className ?? "").includes("language-mermaid"))!;
      expect(mermaid.text, `这一帧的 mermaid 应当是半截的：${JSON.stringify(mermaid.text)}`).not.toContain("B[复习卡]");
    }
    renderFrame(STREAM_FRAMES[STREAM_FRAMES.length - 1]);
    const complete = codeBlockCalls.find((c) => (c.className ?? "").includes("language-mermaid"))!;
    expect(complete.text).toContain("graph TD");
    expect(complete.text).toContain("A[深挖] --> B[复习卡]");
    expect(complete.text.trimEnd().endsWith("```"), "闭合后不应把围栏本身带进代码").toBe(false);
  });
});
