import { describe, expect, test } from "vitest";

import { parseTimelineCaptions } from "./index";

describe("@timeline-editor/captions", () => {
  test("parses captions through the fallback parser", async () => {
    const result = await parseTimelineCaptions("1\n00:00:01,000 --> 00:00:02,000\nHello timeline", {
      format: "srt",
    });

    expect(result.format).toBe("srt");
    expect(result.cues[0]?.text).toBe("Hello timeline");
  });
});
