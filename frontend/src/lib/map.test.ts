import { describe, it, expect } from "vitest";
import {
  buildConceptGraph,
  trimGraph,
  clipLabel,
  layout,
  type MapNode,
} from "./map";
import type { StoredReport } from "./storage";

function report(key: string, term: string, related: string[]): StoredReport {
  return {
    key,
    term,
    fullText: "",
    related: related.map((name, i) => ({
      name,
      description: `${name} 说明`,
      relationType: i % 2 === 0 ? "前置知识" : "兄弟概念",
      groupLabel: "",
      color: "",
    })),
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("buildConceptGraph", () => {
  it("主报告生成 mine 节点 + 到相关概念的边", () => {
    const g = buildConceptGraph([report("乐观锁", "乐观锁", ["版本号", "CAS"])]);
    expect(g.nodes).toHaveLength(3);
    const mine = g.nodes.find((n) => n.kind === "mine");
    expect(mine?.label).toBe("乐观锁");
    const edges = g.edges.map((e) => `${e.source}->${e.target}`);
    expect(edges).toEqual(expect.arrayContaining(["乐观锁->版本号", "乐观锁->CAS"]));
  });

  it("深挖概念也算 mine（我学过它）", () => {
    const g = buildConceptGraph([report("drill:锁::版本号", "版本号", ["时间戳"])]);
    expect(g.nodes.filter((n) => n.kind === "mine").map((n) => n.label)).toEqual([
      "版本号",
    ]);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].source).toBe("版本号");
  });

  it("对比报告不生成「A ⚖️ B」节点，但相关概念仍并入", () => {
    const g = buildConceptGraph([
      report("compare:乐观锁::悲观锁", "乐观锁 ⚖️ 悲观锁", ["锁表", "版本号"]),
    ]);
    expect(g.nodes.filter((n) => n.kind === "mine")).toHaveLength(0);
    expect(g.nodes.filter((n) => n.kind === "related").length).toBe(2);
    expect(g.edges).toHaveLength(0);
  });

  it("同一概念被多个报告提到 → weight 累加、节点合并", () => {
    const g = buildConceptGraph([
      report("乐观锁", "乐观锁", ["版本号"]),
      report("悲观锁", "悲观锁", ["版本号"]),
    ]);
    const shared = g.nodes.find((n) => n.label === "版本号");
    expect(shared?.weight).toBe(2);
    expect(g.nodes.filter((n) => n.label === "版本号")).toHaveLength(1);
  });

  it("边去重：两报告提到同一目标只保留一条", () => {
    const g = buildConceptGraph([
      report("乐观锁", "乐观锁", ["版本号"]),
      report("悲观锁", "悲观锁", ["版本号"]),
    ]);
    const toVersion = g.edges.filter((e) => e.target === "版本号");
    expect(toVersion).toHaveLength(2); // source 不同，各算一条
  });

  it("空输入返回空图", () => {
    const g = buildConceptGraph([]);
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
  });
});

describe("trimGraph", () => {
  const manyNodes: MapNode[] = Array.from({ length: 100 }, (_, i) => ({
    id: `n${i}`,
    label: `n${i}`,
    kind: i < 3 ? "mine" : "related",
    weight: 100 - i,
  }));

  it("超过上限时保留 mine 优先", () => {
    const g = trimGraph({ nodes: manyNodes, edges: [] }, 80);
    expect(g.nodes).toHaveLength(80);
    expect(g.nodes.filter((n) => n.kind === "mine").length).toBe(3);
  });

  it("未超上限时原样返回", () => {
    const g = trimGraph({ nodes: manyNodes.slice(0, 10), edges: [] }, 80);
    expect(g.nodes).toHaveLength(10);
  });
});

describe("clipLabel", () => {
  it("超长截断加省略号", () => {
    expect(clipLabel("一个非常非常非常长的概念名称啊啊啊", 10)).toBe(
      "一个非常非常非常长的…"
    );
  });
  it("短标签不动", () => {
    expect(clipLabel("乐观锁")).toBe("乐观锁");
  });
});

describe("layout", () => {
  it("输出带坐标的节点，且坐标在区域内", () => {
    const g = buildConceptGraph([
      report("乐观锁", "乐观锁", ["版本号", "CAS", "锁表", "时间戳", "ABA 问题", "重试"]),
    ]);
    const { nodes } = layout(trimGraph(g), 1000, 700, 60);
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      expect(n.x).toBeDefined();
      expect(n.y).toBeDefined();
      expect(n.x!).toBeGreaterThanOrEqual(0);
      expect(n.x!).toBeLessThanOrEqual(1000);
      expect(n.y!).toBeGreaterThanOrEqual(0);
      expect(n.y!).toBeLessThanOrEqual(700);
    }
  });

  it("空图不抛错", () => {
    expect(() => layout({ nodes: [], edges: [] })).not.toThrow();
  });
});