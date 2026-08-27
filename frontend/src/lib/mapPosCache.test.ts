import { describe, expect, it } from "vitest";
import { loadPosCache, savePosCache, type PosMap } from "./mapPosCache";

describe("mapPosCache", () => {
  it("returns empty when storage is empty", () => {
    expect(loadPosCache()).toEqual({});
  });

  it("round-trips positions", () => {
    const data: PosMap = {
      "分布式锁": { x: 100, y: 200 },
      "Raft": { x: 300, y: 400 },
    };
    savePosCache(data);
    expect(loadPosCache()).toEqual(data);
  });

  it("filters out malformed entries", () => {
    // 直接污染 localStorage 来测防御性
    localStorage.setItem(
      "concept-digger:map-pos:v1",
      JSON.stringify({
        ok: { x: 1, y: 2 },
        bad1: { x: "1", y: 2 },
        bad2: { x: 1 },
        bad3: null,
        bad4: "string",
      })
    );
    const out = loadPosCache();
    expect(out).toEqual({ ok: { x: 1, y: 2 } });
  });

  it("returns empty on corrupted JSON", () => {
    localStorage.setItem("concept-digger:map-pos:v1", "{not json");
    expect(loadPosCache()).toEqual({});
  });
});