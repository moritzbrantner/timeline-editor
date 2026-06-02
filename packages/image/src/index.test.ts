import { afterEach, describe, expect, test, vi } from "vitest";

import { createTimelineJsFallbackBackend } from "@timeline-editor/compute";
import { createTimelineImageFileAsset } from "./index";
import { analyzeTimelineImageWorkerTask } from "./worker";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  test("worker returns dimensions from createImageBitmap", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 320, height: 180, close: vi.fn() })),
    );

    const result = await analyzeTimelineImageWorkerTask({
      domain: "image",
      operation: "analyze",
      source: { type: "bytes", bytes: new Uint8Array([1, 2, 3]).buffer, mimeType: "image/png" },
    });

    expect(result.width).toBe(320);
    expect(result.height).toBe(180);
  });

  test("worker returns a thumbnail when OffscreenCanvas is available", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 640, height: 360, close: vi.fn() })),
    );
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        width: number;
        height: number;

        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
        }

        getContext() {
          return { drawImage: vi.fn() };
        }

        async convertToBlob() {
          return new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
        }
      },
    );

    const result = await analyzeTimelineImageWorkerTask({
      domain: "image",
      operation: "analyze",
      source: { type: "bytes", bytes: new Uint8Array([1, 2, 3]).buffer, mimeType: "image/png" },
      options: { generateThumbnail: true, thumbnailWidth: 160, thumbnailHeight: 90 },
    });

    expect(result.width).toBe(640);
    expect(result.height).toBe(360);
    expect(result.thumbnail).toMatch(/^data:image\/png;base64,/);
  });
});
