import { describe, expect, test } from "vitest";

import { createTimelineJsFallbackBackend } from "@timeline-editor/compute";
import { createTimelineImageFileAsset } from "./index";

describe("@timeline-editor/image", () => {
  test("creates image assets with backend dimensions", async () => {
    const backend = createTimelineJsFallbackBackend({
      run: () => ({ width: 640, height: 360, thumbnail: "data:image/png;base64," }),
    });
    const file = new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" });
    const result = await createTimelineImageFileAsset(file, { backend });

    expect(result.asset.kind).toBe("image");
    expect(result.asset.data?.width).toBe(640);
    expect(result.asset.data?.height).toBe(360);
  });
});
