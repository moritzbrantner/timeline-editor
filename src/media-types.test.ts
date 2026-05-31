import { describe, expect, test, vi } from "vitest";

import { createTimelineMediaFileSource, createTimelineMediaSourceRegistry } from "./media-types";

describe("media source lifecycle", () => {
  test("registers sources and disposes object URL cleanup once", () => {
    const registry = createTimelineMediaSourceRegistry();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();
    const sourceA = registry.register(
      { id: "camera", uri: "blob:camera-a" },
      { cleanup: cleanupA },
    );

    registry.register({ id: "camera", uri: "blob:camera-b" }, { cleanup: cleanupB });

    expect(cleanupA).toHaveBeenCalledTimes(1);

    sourceA.cleanup?.();

    expect(cleanupB).not.toHaveBeenCalled();

    registry.dispose();
    registry.dispose();

    expect(cleanupB).toHaveBeenCalledTimes(1);
  });

  test("creates file sources with object URL cleanup", () => {
    const file = new File(["audio"], "voice.wav", {
      type: "audio/wav",
      lastModified: 123,
    });
    const createObjectUrl = vi.fn(() => "blob:voice");
    const revokeObjectUrl = vi.fn();

    const result = createTimelineMediaFileSource(file, {
      id: "voice-source",
      createObjectUrl,
      revokeObjectUrl,
      metadata: { track: "voice" },
    });

    expect(createObjectUrl).toHaveBeenCalledWith(file);
    expect(result.objectUrl).toBe("blob:voice");
    expect(result.source).toEqual({
      id: "voice-source",
      uri: "blob:voice",
      label: "voice.wav",
      mimeType: "audio/wav",
      metadata: {
        fileName: "voice.wav",
        lastModified: 123,
        size: 5,
        track: "voice",
      },
    });

    result.cleanup?.();
    result.revoke?.();

    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:voice");
  });
});
