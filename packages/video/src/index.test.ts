import { describe, expect, test } from "vitest";

import { createTimelineJsFallbackBackend } from "@timeline-editor/compute";
import { createTimelineVideoFileAsset } from "./index";

describe("@timeline-editor/video", () => {
  test("uses backend metadata when creating file assets", async () => {
    const backend = createTimelineJsFallbackBackend({
      run: () => ({
        durationMs: 5_000,
        width: 1920,
        height: 1080,
        poster: "data:image/jpeg;base64,",
      }),
    });
    const file = new File([new Uint8Array([1, 2, 3])], "clip.webm", { type: "video/webm" });
    const result = await createTimelineVideoFileAsset(file, { backend });

    expect(result.asset.durationMs).toBe(5_000);
    expect(result.asset.data?.width).toBe(1920);
    expect(result.asset.data?.height).toBe(1080);
    expect(result.asset.data?.poster).toBe("data:image/jpeg;base64,");
  });
});
