import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { TimelineEditorItem } from "../../core";
import type { TimelinePreviewTransportContext } from "./types";
import { useTimelineWorkbenchSynchronizedMediaElement } from "./use-synchronized-media";

type MediaClock = {
  seekGeneration: number;
  register: (clockId: string, priority?: number) => void;
  unregister: (clockId: string) => void;
  isOwner: (clockId: string) => boolean;
  reportTime: (clockId: string, timelineTimeMs: number) => void;
};

type MediaState = {
  currentTime: number;
  paused: boolean;
  playbackRate: number;
};

const item: TimelineEditorItem = {
  id: "clip",
  trackId: "video",
  label: "Clip",
  kind: "video",
  startMs: 0,
  durationMs: 5_000,
};

function MediaHarness({
  currentTimeMs,
  mediaClock,
}: {
  currentTimeMs: number;
  mediaClock: MediaClock;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transport = {
    status: "playing",
    playbackRate: 1,
    loop: false,
    currentTimeMs,
    durationMs: 5_000,
    isPlaying: true,
    getItemLocalTimeMs: () => currentTimeMs,
    isItemActive: () => true,
    mediaClock,
  } as TimelinePreviewTransportContext & { mediaClock: MediaClock };

  useTimelineWorkbenchSynchronizedMediaElement({
    elementRef: videoRef,
    item,
    transport,
    currentTimeMs,
  });

  return <video ref={videoRef} data-testid="video" />;
}

function installMockMediaElement() {
  const states = new WeakMap<HTMLMediaElement, MediaState>();
  const getState = (element: HTMLMediaElement) => {
    let state = states.get(element);

    if (!state) {
      state = { currentTime: 0, paused: true, playbackRate: 1 };
      states.set(element, state);
    }

    return state;
  };
  const descriptors = {
    currentTime: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime"),
    paused: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "paused"),
    playbackRate: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate"),
  };

  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get() {
      return getState(this).currentTime;
    },
    set(value: number) {
      getState(this).currentTime = value;
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get() {
      return getState(this).paused;
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, "playbackRate", {
    configurable: true,
    get() {
      return getState(this).playbackRate;
    },
    set(value: number) {
      getState(this).playbackRate = value;
    },
  });

  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockImplementation(function play(this: HTMLMediaElement) {
      getState(this).paused = false;
      return Promise.resolve();
    });
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(function pause(this: HTMLMediaElement) {
      getState(this).paused = true;
    });

  return {
    play,
    pause,
    restore() {
      play.mockRestore();
      pause.mockRestore();
      Object.entries(descriptors).forEach(([key, descriptor]) => {
        if (descriptor) {
          Object.defineProperty(HTMLMediaElement.prototype, key, descriptor);
        }
      });
    },
  };
}

function createMediaClock(options: { owner: boolean; seekGeneration?: number }) {
  return {
    seekGeneration: options.seekGeneration ?? 0,
    register: vi.fn(),
    unregister: vi.fn(),
    isOwner: vi.fn(() => options.owner),
    reportTime: vi.fn(),
  } satisfies MediaClock;
}

describe("timeline workbench media clock ownership", () => {
  let media: ReturnType<typeof installMockMediaElement>;

  beforeEach(() => {
    media = installMockMediaElement();
  });

  afterEach(() => {
    media.restore();
    vi.restoreAllMocks();
  });

  test("does not continuously seek the elected media clock", async () => {
    const mediaClock = createMediaClock({ owner: true });
    const rendered = render(<MediaHarness currentTimeMs={1_000} mediaClock={mediaClock} />);
    const video = rendered.getByTestId("video") as HTMLVideoElement;

    await act(async () => {
      await Promise.resolve();
    });
    expect(video.currentTime).toBe(1);
    expect(media.play).toHaveBeenCalledTimes(1);

    rendered.rerender(<MediaHarness currentTimeMs={2_000} mediaClock={mediaClock} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(video.currentTime).toBe(1);
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  test("corrects followers and still honors explicit seeks for the owner", async () => {
    const followerClock = createMediaClock({ owner: false });
    const rendered = render(<MediaHarness currentTimeMs={1_000} mediaClock={followerClock} />);
    const video = rendered.getByTestId("video") as HTMLVideoElement;

    await act(async () => {
      await Promise.resolve();
    });
    expect(video.currentTime).toBe(1);

    rendered.rerender(<MediaHarness currentTimeMs={2_000} mediaClock={followerClock} />);
    expect(video.currentTime).toBe(2);

    const ownerClock = createMediaClock({ owner: true, seekGeneration: 1 });
    rendered.rerender(<MediaHarness currentTimeMs={3_000} mediaClock={ownerClock} />);
    expect(video.currentTime).toBe(3);
  });
});
