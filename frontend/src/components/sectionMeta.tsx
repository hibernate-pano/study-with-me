import type { ReactNode } from "react";
import {
  IconBook,
  IconClipboard,
  IconLayers,
  IconNetwork,
  IconSpark,
  IconTarget,
  IconTrends,
  IconWarn,
} from "./icons";

/**
 * 报告模块的展示元数据。
 *
 * 模型输出的 `## ` 标题带 emoji（协议的一部分，解析器依赖），但 emoji 直接当
 * 界面图标在不同系统上渲染不一致、也破坏精密感。这里做两件事：
 * 1. cleanSectionTitle：剥掉标题里的 emoji 与多余空白，只留文字；
 * 2. SectionIcon：按模块语义返回一枚 SVG 线性图标。
 *
 * 只影响"显示"，不影响解析协议——`section.title` 原样保留。
 */

/** 匹配 emoji、变体选择符、零宽连接符、包围键，以及标题前的空白 */
const LEADING_EMOJI =
  /^[\s\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]+/u;

export function cleanSectionTitle(title: string): string {
  const cleaned = title.replace(LEADING_EMOJI, "").trim();
  return cleaned || title.trim();
}

type Meta = { icon: ReactNode; label: string };

export function sectionMeta(title: string, size = 15): Meta {
  const t = cleanSectionTitle(title);
  const icon = (node: ReactNode) => node;

  if (t.includes("定义") || t.includes("辨析"))
    return { icon: icon(<IconTarget size={size} />), label: t };
  if (t.includes("核心重点") || t.includes("重点"))
    return { icon: icon(<IconSpark size={size} />), label: t };
  if (t.includes("误区") || t.includes("易错"))
    return { icon: icon(<IconWarn size={size} />), label: t };
  if (t.includes("拆解"))
    return { icon: icon(<IconLayers size={size} />), label: t };
  if (t.includes("进阶") || t.includes("路径"))
    return { icon: icon(<IconTrends size={size} />), label: t };
  if (t.includes("知识网络") || t.includes("知识图谱"))
    return { icon: icon(<IconNetwork size={size} />), label: t };
  if (t.includes("追问") || t.includes("自测"))
    return { icon: icon(<IconClipboard size={size} />), label: t };
  if (t.includes("资料") || t.includes("检索"))
    return { icon: icon(<IconBook size={size} />), label: t };
  return { icon: icon(<IconLayers size={size} />), label: t };
}
