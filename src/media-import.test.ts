import { afterEach, describe, expect, test, vi } from "vitest";

import { createTimelineMediaImportResolver } from "./media-import";
import { createTimelineMediaSourceLibrary } from "./media-types";

const originalImage = globalThis.Image;

afterEach(() => {
  vi.restoreAllMocks();
  setTimelineTestImage(originalImage);
});

describe("media import resolver", () => {
  test("dispatches mixed file imports to audio, video, and image helpers", async () => {
    setTimelineTestImage(undefined);
    const resolver = createTimelineMediaImportResolver({
      createObjectUrl: (file) => `blob:${file.name}`,
    });
    const results = await resolver([
      {
        type: "file",
        file: new File(["audio"], "voice.mp3", { type: "audio/mpeg" }),
        durationMs: 1_500,
      },
      {
        type: "file",
        file: new File(["video"], "scene.mp4", { type: "video/mp4" }),
        durationMs: 2_000,
        metadata: { width: 1_280, height: 720, poster: "data:image/jpeg;base64,poster" },
      },
      {
        type: "file",
        file: new File(["image"], "still.png", { type: "image/png" }),
        durationMs: 900,
      },
    ]);

    expect(results.map((result) => result.asset.mediaType)).toEqual(["audio", "video", "image"]);
    expect(results.map((result) => result.asset.kind)).toEqual(["audio", "video", "image"]);
    expect(results[0]?.asset.data).toEqual(
      expect.objectContaining({
        mediaType: "audio",
        source: expect.objectContaining({ uri: "blob:voice.mp3" }),
      }),
    );
    expect(results[1]?.asset.data).toEqual(
      expect.objectContaining({
        mediaType: "video",
        source: expect.objectContaining({ uri: "blob:scene.mp4" }),
        width: 1_280,
        height: 720,
        poster: "data:image/jpeg;base64,poster",
      }),
    );
    expect(results[2]?.asset.data).toEqual(
      expect.objectContaining({
        mediaType: "image",
        src: "blob:still.png",
        thumbnail: "blob:still.png",
      }),
    );
  });

  test("creates a displayable URL image asset without cleanup", async () => {
    const resolver = createTimelineMediaImportResolver({ defaultImageDurationMs: 3_000 });
    const [result] = await resolver([
      {
        type: "url",
        url: "https://cdn.example.com/images/hero.webp",
        metadata: { width: 1_024, height: 512, alt: "Hero" },
      },
    ]);

    expect(result).toEqual({
      asset: expect.objectContaining({
        id: "image-hero-webp",
        label: "hero.webp",
        kind: "image",
        mediaType: "image",
        durationMs: 3_000,
        data: expect.objectContaining({
          mediaType: "image",
          src: "https://cdn.example.com/images/hero.webp",
          thumbnail: "https://cdn.example.com/images/hero.webp",
          alt: "Hero",
          width: 1_024,
          height: 512,
        }),
      }),
    });
    expect(result?.cleanup).toBeUndefined();
    expect(result?.revoke).toBeUndefined();
  });

  test("creates a URL video asset with source metadata", async () => {
    const resolver = createTimelineMediaImportResolver();
    const [result] = await resolver([
      {
        type: "url",
        url: "https://cdn.example.com/video/trailer.mp4",
        durationMs: 4_500,
        metadata: {
          mimeType: "video/mp4",
          width: 1_920,
          height: 1_080,
          poster: "https://cdn.example.com/video/poster.jpg",
        },
      },
    ]);

    expect(result?.asset).toEqual(
      expect.objectContaining({
        id: "video-trailer-mp4",
        label: "trailer.mp4",
        kind: "video",
        mediaType: "video",
        durationMs: 4_500,
        data: expect.objectContaining({
          mediaType: "video",
          width: 1_920,
          height: 1_080,
          poster: "https://cdn.example.com/video/poster.jpg",
          source: {
            id: undefined,
            uri: "https://cdn.example.com/video/trailer.mp4",
            label: "trailer.mp4",
            mimeType: "video/mp4",
            metadata: {
              mimeType: "video/mp4",
              width: 1_920,
              height: 1_080,
              poster: "https://cdn.example.com/video/poster.jpg",
            },
          },
        }),
      }),
    );
  });

  test("throws a clear error for unsupported files", async () => {
    const resolver = createTimelineMediaImportResolver();

    await expect(
      resolver([{ type: "file", file: new File(["notes"], "notes.txt", { type: "text/plain" }) }]),
    ).rejects.toThrow("Unsupported file import source: notes.txt.");
  });

  test("lets explicit mediaType override ambiguous file metadata", async () => {
    setTimelineTestImage(undefined);
    const resolver = createTimelineMediaImportResolver({
      createObjectUrl: () => "blob:ambiguous",
    });
    const [result] = await resolver([
      {
        type: "file",
        mediaType: "image",
        file: new File(["image"], "asset.bin", { type: "application/octet-stream" }),
      },
    ]);

    expect(result?.asset.kind).toBe("image");
    expect(result?.asset.data).toEqual(
      expect.objectContaining({
        mediaType: "image",
        src: "blob:ambiguous",
      }),
    );
  });

  test("uses a shared source library for file imports", async () => {
    setTimelineTestImage(undefined);
    const sourceLibrary = createTimelineMediaSourceLibrary();
    const resolver = createTimelineMediaImportResolver({
      sourceLibrary,
      createObjectUrl: () => "blob:shared-image",
    });
    const [result] = await resolver([
      {
        type: "file",
        file: new File(["image"], "shared.jpg", { type: "image/jpeg" }),
        metadata: { sourceId: "shared-source" },
      },
    ]);

    expect(sourceLibrary.get("shared-source")?.refCount).toBe(1);

    result?.cleanup?.();

    expect(sourceLibrary.get("shared-source")).toBeUndefined();
  });
});

function setTimelineTestImage(image: typeof Image | undefined) {
  if (image) {
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: image,
    });

    return;
  }

  Reflect.deleteProperty(globalThis, "Image");
}
