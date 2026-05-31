import { afterEach, describe, expect, test, vi } from "vitest";

import { createTimelineVideoFileAsset } from "./video";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("video file assets", () => {
  test("creates a video asset with supplied media metadata and object URL cleanup", async () => {
    const objectUrl = "blob:timeline-video";
    const createObjectUrl = vi.fn(() => objectUrl);
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const file = new File(["video"], "Camera Clip.mp4", {
      type: "video/mp4",
      lastModified: 123,
    });

    const result = await createTimelineVideoFileAsset(file, {
      createObjectUrl,
      durationMs: 2_500,
      width: 1_920,
      height: 1_080,
      poster: "data:image/jpeg;base64,poster",
      thumbnails: ["data:image/jpeg;base64,thumb"],
      color: "#92400e",
      fit: "cover",
      muted: true,
      volume: 0.5,
      sourceId: "camera-a",
      metadata: { camera: "A" },
    });

    expect(createObjectUrl).toHaveBeenCalledWith(file);
    expect(result.objectUrl).toBe(objectUrl);
    expect(result.asset).toEqual(
      expect.objectContaining({
        id: "video-camera-clip-mp4",
        label: "Camera Clip.mp4",
        kind: "video",
        mediaType: "video",
        durationMs: 2_500,
        color: "#92400e",
        description: "video/mp4",
        data: expect.objectContaining({
          mediaType: "video",
          width: 1_920,
          height: 1_080,
          poster: "data:image/jpeg;base64,poster",
          thumbnails: ["data:image/jpeg;base64,thumb"],
          fit: "cover",
          muted: true,
          volume: 0.5,
          source: {
            id: "camera-a",
            uri: objectUrl,
            label: "Camera Clip.mp4",
            mimeType: "video/mp4",
            metadata: {
              fileName: "Camera Clip.mp4",
              lastModified: 123,
              size: 5,
              durationMs: 2_500,
              width: 1_920,
              height: 1_080,
              camera: "A",
            },
          },
        }),
      }),
    );

    result.revoke?.();

    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  test("probes video duration, dimensions, poster, and requested thumbnails", async () => {
    const restoreMediaElements = mockTimelineVideoElements();
    const file = new File(["video"], "probe.mov", { type: "video/quicktime" });

    const result = await createTimelineVideoFileAsset(file, {
      createObjectUrl: () => "blob:probe-video",
      thumbnailCount: 2,
    });

    restoreMediaElements();

    expect(result.asset.durationMs).toBe(3_200);
    expect(result.asset.data).toEqual(
      expect.objectContaining({
        mediaType: "video",
        width: 640,
        height: 360,
        poster: "data:image/jpeg;frame=1",
        thumbnails: ["data:image/jpeg;frame=2", "data:image/jpeg;frame=3"],
      }),
    );
    expect(result.asset.data?.source?.metadata).toEqual(
      expect.objectContaining({
        durationMs: 3_200,
        width: 640,
        height: 360,
      }),
    );
  });
});

function mockTimelineVideoElements() {
  const originalCreateElement = document.createElement.bind(document);
  const listeners = new Map<string, Array<() => void>>();
  let currentTime = 0;
  let frame = 0;
  const video = {
    duration: 3.2,
    videoWidth: 640,
    videoHeight: 360,
    readyState: 2,
    onloadedmetadata: null as null | (() => void),
    onerror: null as null | (() => void),
    preload: "",
    muted: false,
    playsInline: false,
    src: "",
    get currentTime() {
      return currentTime;
    },
    set currentTime(value: number) {
      currentTime = value;
      queueMicrotask(() => {
        for (const listener of listeners.get("seeked") ?? []) {
          listener();
        }
      });
    },
    addEventListener(event: string, listener: () => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    removeEventListener(event: string, listener: () => void) {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((candidate) => candidate !== listener),
      );
    },
    load() {
      queueMicrotask(() => video.onloadedmetadata?.());
    },
    removeAttribute(attribute: string) {
      if (attribute === "src") {
        video.src = "";
      }
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
    toDataURL: vi.fn(() => {
      frame += 1;

      return `data:image/jpeg;frame=${frame}`;
    }),
  };
  const createElement = vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    if (tagName === "video") {
      return video as unknown as HTMLVideoElement;
    }

    if (tagName === "canvas") {
      return canvas as unknown as HTMLCanvasElement;
    }

    return originalCreateElement(tagName);
  });

  return () => createElement.mockRestore();
}
