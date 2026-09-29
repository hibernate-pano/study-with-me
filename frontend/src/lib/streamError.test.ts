import { describe, expect, it } from "vitest";
import { hasStreamError, STREAM_ERROR_MARKER } from "./stream";

describe("stream error marker", () => {
  it("识别服务端中断标记", () => {
    expect(hasStreamError(`正文\n${STREAM_ERROR_MARKER}`)).toBe(true);
  });

  it("完整报告不会被误判为中断", () => {
    expect(hasStreamError("正文\n<!-- DONE -->")).toBe(false);
  });
});
