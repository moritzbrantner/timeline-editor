import { afterEach, describe, expect, test, vi } from "vitest";

import { createTimelineImageFileAsset } from "./image";
import { createTimelineMediaSourceLibrary, createTimelineMediaSourceRegistry } from "./media-types";

const originalImage = globalThis.Image;

afterEach(() => {
  vi.restoreAllMocks();
  setTimelineTestImage(originalImage);
});

describe("image file assets", () => {
  test("creates an image asset with object URL, metadata, source, and cleanup", async () => {
    mockTimelineImageDimensions(800, 450);
    const objectUrl = "blob:timeline-image";
    const createObjectUrl = vi.fn(() => objectUrl);
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const file = new File(["image"], "Hero Shot.png", {
      type: "image/png",
      lastModified: 123,
    });

    const result = await createTimelineImageFileAsset(file, {
      createObjectUrl,
      color: "#2563eb",
    });

    expect(createObjectUrl).toHaveBeenCalledWith(file);
    expect(result.objectUrl).toBe(objectUrl);
    expect(result.asset).toEqual(
      expect.objectContaining({
        id: "image-hero-shot-png",
        label: "Hero Shot.png",
        kind: "image",
        mediaType: "image",
        durationMs: 1_000,
        color: "#2563eb",
        description: "image/png",
        data: expect.objectContaining({
          mediaType: "image",
          src: objectUrl,
          thumbnail: objectUrl,
          alt: "Hero Shot.png",
          width: 800,
          height: 450,
          source: {
            id: undefined,
            uri: objectUrl,
            label: "Hero Shot.png",
            mimeType: "image/png",
            metadata: {
              fileName: "Hero Shot.png",
              lastModified: 123,
              size: 5,
              width: 800,
              height: 450,
            },
          },
        }),
      }),
    );

    result.cleanup?.();
    result.revoke?.();

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  test("falls back when Image is unavailable", async () => {
    setTimelineTestImage(undefined);
    const result = await createTimelineImageFileAsset(
      new File(["image"], "flat.webp", { type: "image/webp" }),
      { createObjectUrl: () => "blob:flat" },
    );

    expect(result.asset.data).toEqual(
      expect.objectContaining({
        mediaType: "image",
        width: undefined,
        height: undefined,
        src: "blob:flat",
      }),
    );
  });

  test("uses supplied duration, fit, alt, source id, and metadata", async () => {
    mockTimelineImageDimensions(320, 240);
    const result = await createTimelineImageFileAsset(
      new File(["image"], "diagram.svg", {
        type: "image/svg+xml",
        lastModified: 456,
      }),
      {
        createObjectUrl: () => "blob:diagram",
        durationMs: 2_500,
        fit: "contain",
        alt: "Process diagram",
        sourceId: "diagram-source",
        metadata: { collection: "docs", width: 640 },
      },
    );

    expect(result.asset.durationMs).toBe(2_500);
    expect(result.asset.data).toEqual(
      expect.objectContaining({
        fit: "contain",
        alt: "Process diagram",
        width: 320,
        height: 240,
        source: expect.objectContaining({
          id: "diagram-source",
          metadata: expect.objectContaining({
            collection: "docs",
            width: 640,
            height: 240,
          }),
        }),
      }),
    );
  });

  test("registers sources through a library and uses the returned cleanup", async () => {
    setTimelineTestImage(undefined);
    const library = createTimelineMediaSourceLibrary();
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const result = await createTimelineImageFileAsset(new File(["image"], "scene.jpg"), {
      createObjectUrl: () => "blob:scene",
      sourceId: "scene-source",
      sourceLibrary: library,
    });

    expect(library.get("scene-source")?.refCount).toBe(1);

    result.cleanup?.();
    result.revoke?.();

    expect(library.get("scene-source")).toBeUndefined();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:scene");
  });

  test("registers sources through the compatibility registry", async () => {
    setTimelineTestImage(undefined);
    const registry = createTimelineMediaSourceRegistry();
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const result = await createTimelineImageFileAsset(new File(["image"], "legacy.gif"), {
      createObjectUrl: () => "blob:legacy",
      sourceId: "legacy-source",
      sourceRegistry: registry,
    });

    result.cleanup?.();
    result.revoke?.();

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:legacy");
  });
});

function mockTimelineImageDimensions(width: number, height: number) {
  class MockImage {
    naturalWidth = width;
    naturalHeight = height;
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  setTimelineTestImage(MockImage as unknown as typeof Image);
}

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
