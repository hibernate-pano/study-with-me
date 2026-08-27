import { describe, it, expect } from "vitest";
import { talkshowChallengeUrl } from "./talkshow";

describe("talkshowChallengeUrl", () => {
  it("builds challenge url with topic param and deep-dive-done signal", () => {
    expect(talkshowChallengeUrl("分布式锁")).toBe(
      "https://topic-talkshow.panbo.space/?topic=" +
        encodeURIComponent("分布式锁") +
        "&dd=1",
    );
  });
});
