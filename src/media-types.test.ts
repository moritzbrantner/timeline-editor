import { describe, expect, test, vi } from "vitest";

import {
  createTimelineMediaFileSource,
  createTimelineMediaSourceLibrary,
  createTimelineMediaSourceRegistry,
} from "./media-types";

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

  test("retains registered library sources until final release", () => {
    const library = createTimelineMediaSourceLibrary();
    const cleanup = vi.fn();

    library.register({ id: "camera", uri: "blob:camera" }, { cleanup });
    library.retain("camera");
    library.retain({ id: "camera" });
    library.release("camera");

    expect(cleanup).not.toHaveBeenCalled();
    expect(library.get("camera")?.refCount).toBe(2);

    library.release("camera");
    library.release("camera");
    library.release("camera");

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(library.get("camera")).toBeUndefined();
  });

  test("re-registering the same library key revokes the old lifecycle", () => {
    const library = createTimelineMediaSourceLibrary();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();

    const sourceA = library.register({ id: "source", uri: "blob:a" }, { cleanup: cleanupA });
    library.retain("source");
    library.register({ id: "source", uri: "blob:b" }, { cleanup: cleanupB });
    sourceA.cleanup?.();

    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(cleanupB).not.toHaveBeenCalled();

    library.release("source");

    expect(cleanupB).toHaveBeenCalledTimes(1);
  });

  test("disposing the library revokes remaining entries once", () => {
    const library = createTimelineMediaSourceLibrary();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();

    library.register({ id: "a", uri: "blob:a" }, { cleanup: cleanupA });
    library.register({ uri: "blob:b" }, { cleanup: cleanupB });
    library.dispose();
    library.dispose();

    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(cleanupB).toHaveBeenCalledTimes(1);
  });

  test("undefined and keyless library sources are safe no-ops", () => {
    const library = createTimelineMediaSourceLibrary();
    const cleanup = vi.fn();
    const source = library.register({}, { cleanup });

    library.retain(undefined);
    library.release(undefined);
    library.release({});

    expect(library.get(undefined)).toBeUndefined();
    expect(library.get({})).toBeUndefined();

    source.cleanup?.();
    source.revoke?.();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
