import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 两个 vitest project 并存（include 后缀互斥，每个文件只跑一次）：
 *
 * 1. `node`：全部 *.test.ts（lib 纯逻辑、API route 契约、AST 结构契约）。
 *    environment: "node" 一行都不动——把几百个用例一次性拖进 jsdom 会引入一整轮
 *    与本任务无关的红。
 * 2. `dom`：全部 *.test.tsx 的组件行为测试。jsdom + @testing-library/react 让
 *    useEffect / cleanup / 原生事件监听真正跑起来——这一层盯的是 AnalyzeView 的定时器守卫、
 *    Mermaid 的 error 复位、MapView 的非 passive wheel 监听，全是 effect/cleanup 时序，
 *    node 项目照不到，坏回修复前的样子也不会让任何用例变红。
 *    新建组件行为测试时把文件后缀写成 .tsx，就会自动落进这个 project，不用再改配置。
 */
const alias = { "@": path.resolve(import.meta.dirname, "./src") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          include: ["src/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        resolve: { alias },
        // 根因：tsconfig.json 是给 Next 用的（"jsx": "preserve"，转译由 Next/SWC 负责）。
        // vite 的 TS/JSX 转换器会读同一份 tsconfig，于是把 JSX 原样留在产物里，
        // 下一个模块的 import analysis 阶段解析不了 → "Failed to parse source for import analysis"。
        // 这里只在测试项目里覆盖成 automatic runtime（importSource 默认 react），
        // 不动 tsconfig.json，免得影响 next build。
        oxc: { jsx: "automatic" },
        test: {
          name: "dom",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.dom.ts"],
        },
      },
    ],
  },
});
