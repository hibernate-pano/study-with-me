# 设计语言 v4「精密仪器」（Design System）

> 本文件是 UI 的唯一真源（source of truth）。改视觉前先读它；改完若规则变了，回来同步。
> 令牌落在 `src/app/globals.css`，图标落在 `src/components/icons.tsx`。

## 1. 设计哲学（所有取舍都回到这三条）

1. **画布与器件** —— 灰画布是「台面」，白卡是「器件」。层级来自**表面反差的档位**
   （画布 < 凹陷 < 卡片 < 浮层）与发丝描边，不靠阴影堆砌、不用渐变。
2. **一个轴，一条节奏** —— 每页只有一条对齐轴；间距来自 4px 基数；字号来自固定模块化
   刻度，不写随手值。
3. **墨为动作，彩为状态** —— 黑/近黑只给动作、选中、品牌块；彩色只做**小面积语义色洗**
   （红=失败 / 琥珀=待办 / 绿=通过 / 蓝=信息），不做大面积色块。
   数据语义色（知识网络 5 类关系色）是唯一允许多彩之处。

## 2. 色彩

### 中性阶（唯一灰源，暖灰）
`--color-ink-50..950`（`#f6f6f4 → #141412`）。所有「灰」都从这一条取，保证同色温。

### 表面档位（唯一分层手段）
| 令牌 | 用途 |
|---|---|
| `--bg` `#ecebe8` | 画布（台面） |
| `--bg-soft` `#e7e6e2` | 浅凹陷 / hover 洗 |
| `--card` `#ffffff` | 卡片（器件） |
| `--card-sunken` `#f6f6f4` | 卡内凹陷块（答案/说明） |
| `--overlay` | 浮层磨砂 |

### 文本阶（对比度都 ≥ 4.5:1）
`--ink`（主）`#1d1d1a` · `--ink-deep`（标题）`#141412` ·
`--ink-soft`（次级）`#56564f` · `--ink-faint`（辅助/元信息）`#75756d`

### 动作色
`--brand` = `--ink`（墨黑）。黑填充 = 动作 / 选中；hover 更深，绝不用黑表达「悬停」。

### 状态语义色（只做小面积 chip）
| 语义 | 令牌 | 用途 |
|---|---|---|
| 失败 / 危险 | `--st-err*` 红 | 报错、误区、删除、忘了 |
| 待办 / 进行中 | `--st-warn*` 琥珀 | 到期复习、生成中、停止、模糊 |
| 通过 / 完成 | `--st-ok*` 绿 | 完成、记住、正确 |
| 信息 / 数据 | `--st-info*` 蓝 | 缓存来源、统计、对照 |
| 图表数据标记 | `--data` | 条形/趋势数据 |

### 关系色（知识网络，数据语义，唯一保留的「五彩」）
`--r-prereq` 青 · `--r-sibling` 紫 · `--r-successor` 绿 · `--r-opposite` 红 · `--r-analogy` 橙

> **兼容层**：`@theme` 里把 Tailwind 默认 `slate/amber/red/emerald/sky/teal` 各阶重映射到
> 上面这套色，所以存量类名（`text-slate-500` 等）自动落到品牌色。新代码请优先用语义令牌
> （`bg-[var(--st-warn-bg)]` / `text-ink-soft`），不要再引入默认调色板之外的色。

## 3. 排版（模块化刻度，全部写在 globals.css）

| 类 | 字号 | 用途 |
|---|---|---|
| `.t-micro` | 11px | 脚注 / 计数 |
| `.t-meta` | 12px | 元信息 / 标签 |
| `.t-small` | 13px | 次要正文 |
| `.t-body` | 15px | 正文（body 默认） |
| `.t-lead` | 17px | 引导段 |
| `.t-h3` | 18px | 小标题 |
| `.t-h2` | 22px | 中标题 |
| `.t-h1` | 28px | 页标题 |
| `.label` | 11px | 分区小标签（大写 + 0.14em 字距 + 灰） |
| `.mono` / `.nums` | — | 等宽 / 数字对齐（计数、时间、百分比） |
| `.font-disp` | — | 展示级标题（重 sans + 收紧字距） |
| `.kbd` | — | 键盘按键 |

拉丁用 Inter，中文走系统 PingFang/雅黑。**不要再用 `text-[15px]` 这类随手值**，改从刻度取。

## 4. 圆角与形状语法
矩形（`--r-xs..xl`）=「可以按 / 能装东西的东西」；胶囊（`--r-pill`）=「贴上去的纸」
（标签、筛选、概念 chip）。卡片 `--r-lg`，按钮 `--r-md`，内部块 `--r-sm`。

## 5. 组件词汇表（globals.css）
- `.card` / `.card-sunken` / `.surface`
- `.btn-primary`（墨黑）/ `.btn-ghost`（白底描边）/ `.btn-quiet`（文本）/ `.btn-icon`
- `.chip`（胶囊标签）/ `.state-chip` + `.state-ok|warn|err|info`（状态色洗）
- `.lift`（悬浮抬升）/ `.topbar` / `.skip-link` / `.kbd` / `.label` / `.mono` / `.nums`

## 6. 交互与无障碍约定
- **图标**：一律 `components/icons.tsx` 的 24×24 线性 SVG，`currentColor`。
  **禁止 emoji 当 UI 图标**（系统渲染不一致）。
- **可点元素**：`cursor-pointer` + hover 有视觉反馈 + `transition-colors duration-150~200ms`。
  hover 不引发布局位移（用颜色/边框/位移 ≤2px，不用 scale 撑开布局）。
- **焦点**：`:focus-visible` 全局 2px 墨色环（`@layer base`）。
- **触屏**：可点元素 ≥ 40px 命中区；`touch-action: manipulation`。
- **错误**：`role="alert"`；错误信息含明确恢复路径（重试按钮）。
- **键盘**：Skip link 直达 `#main`；复习页 Space 翻面、1/2/3 评分。
- **动效**：时长 140/200/320ms，缓动 `--ease-quiet`；动画只留给「状态真正变化」的元素
  （生成中 / 翻面 / 完成），不做装饰性全站浮动；`prefers-reduced-motion` 全局收敛。

## 7. z 轴刻度
`--z-sticky:20`（顶栏）· `--z-drawer:40`（抽屉/侧预览）· `--z-overlay:100`（命令面板）。
不要再写 `z-30 / z-50` 这类魔法数。
