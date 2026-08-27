import { describe, expect, it } from "vitest";

import { getNextTimelineEditorPixelsPerSecond } from "./viewport";

describe("timeline editor viewport", () => {
  it("honors a consumer minimum below the default zoom floor", () => {
    expect(getNextTimelineEditorPixelsPerSecond(8, -1, 0.25)).toBe(0.25);
    expect(getNextTimelineEditorPixelsPerSecond(0.5, -1, 0.25)).toBe(0.25);
  });
});
