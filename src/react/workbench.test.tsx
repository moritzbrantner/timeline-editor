import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  TimelineWorkbench,
  createTimelineEditorHistory,
  normalizeTimelineEditorTracks,
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
  TimelineEditor,
  TimelineEditorContent,
  TimelineEditorProvider,
  TimelineEditorRoot,
  TimelineEditorRuler,
  TimelineEditorTracks,
  useTimelineEditor,
  type TimelineEditorDocument,
  type TimelineEditorExtension,
  type TimelineEditorTrack,
} from "@moritzbrantner/timeline-editor";
import {
  createTimelineAudioExtension,
  createTimelineAudioFileAsset,
  type TimelineAudioItemData,
} from "@moritzbrantner/timeline-editor/audio";
import {
  createTimelineNumericDataExtension,
  type TimelineNumericDataItemData,
} from "@moritzbrantner/timeline-editor/data";
import {
  createTimelineImageExtension,
  type TimelineImageItemData,
} from "@moritzbrantner/timeline-editor/image";
import {
  createTimelineTextExtension,
  type TimelineTextItemData,
} from "@moritzbrantner/timeline-editor/text";
import {
  createTimelineVideoExtension,
  type TimelineVideoItemData,
} from "@moritzbrantner/timeline-editor/video";

const tracks: TimelineEditorTrack[] = normalizeTimelineEditorTracks([
  {
    id: "planning",
    label: "Planning",
    acceptsItemKinds: ["task", "review"],
    items: [
      {
        id: "brief",
        trackId: "planning",
        label: "Brief",
        kind: "task",
        startMs: 1_000,
        durationMs: 2_000,
        color: "#2563eb",
      },
    ],
  },
  {
    id: "review",
    label: "Review",
    acceptsItemKinds: ["review"],
    items: [],
  },
]);

function firePointerEvent(element: Element, type: string, clientX: number, clientY = 0) {
  fireEvent(element, new MouseEvent(type, { bubbles: true, clientX, clientY }));
}

function mockTimelineEditorScrollSize(options: { clientWidth: number; scrollWidth: number }) {
  const clientWidth = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockImplementation(function getClientWidth(this: HTMLElement) {
      return this.dataset["slot"] === "timeline-editor" ? options.clientWidth : 0;
    });
  const scrollWidth = vi
    .spyOn(HTMLElement.prototype, "scrollWidth", "get")
    .mockImplementation(function getScrollWidth(this: HTMLElement) {
      return this.dataset["slot"] === "timeline-editor" ? options.scrollWidth : 0;
    });

  return () => {
    clientWidth.mockRestore();
    scrollWidth.mockRestore();
  };
}

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function installMockMediaElement() {
  type MediaState = {
    currentTime: number;
    muted: boolean;
    paused: boolean;
    playbackRate: number;
    volume: number;
  };
  const states = new WeakMap<HTMLMediaElement, MediaState>();
  const getState = (element: HTMLMediaElement) => {
    let state = states.get(element);

    if (!state) {
      state = { currentTime: 0, muted: false, paused: true, playbackRate: 1, volume: 1 };
      states.set(element, state);
    }

    return state;
  };
  const descriptors = {
    currentTime: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime"),
    muted: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "muted"),
    paused: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "paused"),
    playbackRate: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate"),
    volume: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume"),
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
  Object.defineProperty(HTMLMediaElement.prototype, "muted", {
    configurable: true,
    get() {
      return getState(this).muted;
    },
    set(value: boolean) {
      getState(this).muted = value;
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
  Object.defineProperty(HTMLMediaElement.prototype, "volume", {
    configurable: true,
    get() {
      return getState(this).volume;
    },
    set(value: number) {
      getState(this).volume = value;
    },
  });

  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockImplementation(function play(this: HTMLMediaElement) {
      getState(this).paused = false;
      this.dataset["playState"] = "playing";
      this.dataset["playCount"] = String(Number(this.dataset["playCount"] ?? "0") + 1);
      return Promise.resolve();
    });
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(function pause(this: HTMLMediaElement) {
      const wasPaused = getState(this).paused && this.dataset["playState"] !== "playing";

      getState(this).paused = true;
      this.dataset["playState"] = "paused";
      if (!wasPaused) {
        this.dataset["pauseCount"] = String(Number(this.dataset["pauseCount"] ?? "0") + 1);
      }
    });

  return {
    play,
    pause,
    restore: () => {
      play.mockRestore();
      pause.mockRestore();
      Object.entries(descriptors).forEach(([key, descriptor]) => {
        if (descriptor) {
          Object.defineProperty(HTMLMediaElement.prototype, key, descriptor);
        } else {
          delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>)[key];
        }
      });
    },
  };
}

describe("@moritzbrantner/timeline-editor React workbench", () => {
  test("renders the timeline editor from public composable components", () => {
    const document: TimelineEditorDocument = {
      tracks,
      durationMs: 8_000,
      currentTimeMs: 1_000,
    };

    render(
      <TimelineEditorProvider document={document} selection={{ itemIds: [] }}>
        <TimelineEditorRoot>
          <TimelineEditorContent>
            <TimelineEditorRuler />
            <TimelineEditorTracks />
          </TimelineEditorContent>
        </TimelineEditorRoot>
      </TimelineEditorProvider>,
    );

    expect(screen.getByText("Planning")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Brief" })).toBeTruthy();
  });

  test("renders timeline tracks and ruler independently inside the provider shell", () => {
    const document: TimelineEditorDocument = {
      tracks,
      durationMs: 8_000,
      currentTimeMs: 1_000,
    };
    const { rerender } = render(
      <TimelineEditorProvider document={document} selection={{ itemIds: [] }}>
        <TimelineEditorRoot>
          <TimelineEditorContent>
            <TimelineEditorTracks />
          </TimelineEditorContent>
        </TimelineEditorRoot>
      </TimelineEditorProvider>,
    );

    expect(screen.getByText("Planning")).toBeTruthy();
    expect(screen.queryByText("0:00.0")).toBeNull();

    rerender(
      <TimelineEditorProvider document={document} selection={{ itemIds: [] }}>
        <TimelineEditorRoot>
          <TimelineEditorContent>
            <TimelineEditorRuler />
          </TimelineEditorContent>
        </TimelineEditorRoot>
      </TimelineEditorProvider>,
    );

    expect(screen.queryByText("Planning")).toBeNull();
    expect(screen.getByText("0:00.0")).toBeTruthy();
  });

  test("throws a clear error when the timeline editor hook is used outside the provider", () => {
    function HookConsumer() {
      useTimelineEditor();
      return null;
    }

    expect(() => render(<HookConsumer />)).toThrow(
      "useTimelineEditor must be used within a TimelineEditorProvider.",
    );
  });

  test("supports replacing track headers and clips through public slots", () => {
    const document: TimelineEditorDocument = {
      tracks,
      durationMs: 8_000,
      currentTimeMs: 1_000,
    };

    render(
      <TimelineEditorProvider document={document} selection={{ itemIds: ["brief"] }}>
        <TimelineEditorRoot>
          <TimelineEditorContent>
            <TimelineEditorTracks
              components={{
                TrackHeader({ entry }) {
                  return (
                    <div data-slot="timeline-editor-track-header">
                      Custom header: {entry.track.label}
                    </div>
                  );
                },
                Clip({ item, onMovePointerDown }) {
                  return (
                    <div
                      data-slot="timeline-editor-clip"
                      role="button"
                      tabIndex={0}
                      onPointerDown={onMovePointerDown}
                    >
                      Custom clip: {item.label}
                    </div>
                  );
                },
              }}
            />
          </TimelineEditorContent>
        </TimelineEditorRoot>
      </TimelineEditorProvider>,
    );

    expect(screen.getByText("Custom header: Planning")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Custom clip: Brief" })).toBeTruthy();
  });

  test("commits drag edits once and undo returns to the pre-drag document", () => {
    const document: TimelineEditorDocument = {
      tracks,
      durationMs: 8_000,
      currentTimeMs: 1_000,
    };
    let currentDocument = document;

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      currentDocument = stateDocument;

      return (
        <TimelineWorkbench
          document={stateDocument}
          selectedItemId="brief"
          onDocumentChange={(nextDocument) => {
            currentDocument = nextDocument;
            setStateDocument(nextDocument);
          }}
        />
      );
    }

    const { container } = render(<StatefulWorkbench />);
    const editor = container.querySelector("[data-slot='timeline-editor']")!;
    const item = screen.getAllByRole("button", { name: "Brief" })[0]!;

    firePointerEvent(item, "pointerdown", 0);
    firePointerEvent(editor, "pointermove", 80);
    expect(currentDocument.tracks[0]?.items[0]?.startMs).toBe(1_000);

    firePointerEvent(editor, "pointerup", 80);
    expect(currentDocument.tracks[0]?.items[0]?.startMs).toBe(2_000);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(currentDocument.tracks[0]?.items[0]?.startMs).toBe(1_000);
  });

  test("supports controlled workbench history state", () => {
    const document: TimelineEditorDocument = {
      tracks,
      durationMs: 8_000,
      currentTimeMs: 1_000,
    };
    const handleHistoryChange = vi.fn();
    let currentDocument = document;

    function ControlledHistoryWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      const [history, setHistory] = useState(() => createTimelineEditorHistory());
      currentDocument = stateDocument;

      return (
        <TimelineWorkbench
          document={stateDocument}
          selectedItemId="brief"
          history={history}
          onHistoryChange={(nextHistory) => {
            handleHistoryChange(nextHistory);
            setHistory(nextHistory);
          }}
          onDocumentChange={(nextDocument) => {
            currentDocument = nextDocument;
            setStateDocument(nextDocument);
          }}
        />
      );
    }

    render(<ControlledHistoryWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    expect(handleHistoryChange).toHaveBeenCalledWith(
      expect.objectContaining({ undoStack: expect.arrayContaining([expect.anything()]) }),
    );
    expect(currentDocument.tracks[0]?.items).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(handleHistoryChange).toHaveBeenCalledTimes(2);
    expect(currentDocument.tracks[0]?.items).toHaveLength(1);
  });

  test("moves multi-selection items during a single drag commit", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 500 },
            { id: "draft", trackId: "planning", label: "Draft", startMs: 2_000, durationMs: 500 },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief", "draft"], anchorItemId: "brief" }}
        viewport={{ pixelsPerSecond: 80 }}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    firePointerEvent(screen.getByRole("button", { name: "Brief" }), "pointerdown", 0);
    firePointerEvent(editor, "pointermove", 80);
    expect(handleDocumentChange).not.toHaveBeenCalled();

    firePointerEvent(editor, "pointerup", 80);
    expect(handleDocumentChange).toHaveBeenCalledTimes(1);
    expect(handleDocumentChange.mock.calls[0]?.[0].tracks[0]?.items).toEqual([
      expect.objectContaining({ id: "brief", startMs: 2_000 }),
      expect.objectContaining({ id: "draft", startMs: 3_000 }),
    ]);
  });

  test("moves timeline items across compatible tracks during drag", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 500 },
          ],
        },
        {
          id: "review",
          label: "Review",
          items: [],
        },
      ],
    };
    const handleDocumentChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={{ pixelsPerSecond: 80 }}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    firePointerEvent(screen.getByRole("button", { name: "Brief" }), "pointerdown", 0, 50);
    firePointerEvent(editor, "pointermove", 0, 106);
    firePointerEvent(editor, "pointerup", 0, 106);

    expect(handleDocumentChange).toHaveBeenCalledTimes(1);
    expect(handleDocumentChange.mock.calls[0]?.[0].tracks).toEqual([
      expect.objectContaining({ id: "planning", items: [] }),
      expect.objectContaining({
        id: "review",
        items: [expect.objectContaining({ id: "brief", trackId: "review", startMs: 1_000 })],
      }),
    ]);
  });

  test("applies edit policy to pointer drag commits", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 2_000 },
            { id: "draft", trackId: "planning", label: "Draft", startMs: 3_500, durationMs: 1_000 },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        editPolicy={{ overlap: "prevent", ripple: false }}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={{ pixelsPerSecond: 80 }}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    firePointerEvent(screen.getByRole("button", { name: "Brief" }), "pointerdown", 0);
    firePointerEvent(editor, "pointermove", 160);
    firePointerEvent(editor, "pointerup", 160);

    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("nudges timeline items by frame duration when a framerate is set", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={{ pixelsPerSecond: 80 }}
        frameRate={25}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    fireEvent.keyDown(editor, { key: "ArrowRight" });

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            items: [expect.objectContaining({ id: "brief", startMs: 1_040 })],
          }),
          expect.anything(),
        ],
      }),
    );
  });

  test("steps the playhead by frame duration when no timeline item is selected", () => {
    const document: TimelineEditorDocument = {
      currentTimeMs: 1_000,
      durationMs: 8_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();
    const handleCurrentTimeChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: [] }}
        viewport={{ pixelsPerSecond: 80 }}
        frameRate={25}
        onCurrentTimeChange={handleCurrentTimeChange}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    fireEvent.keyDown(editor, { key: "ArrowRight" });

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({ currentTimeMs: 1_040 }),
    );
    expect(handleCurrentTimeChange).toHaveBeenCalledWith(1_040);
  });

  test("renders frame ticks through timeline tracks", () => {
    const document: TimelineEditorDocument = {
      durationMs: 2_000,
      tracks,
    };
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: [] }}
        viewport={{ pixelsPerSecond: 80 }}
        frameRate={25}
      />,
    );

    expect(
      container.querySelectorAll("[data-slot='timeline-editor-track-tick']").length,
    ).toBeGreaterThan(0);
  });

  test("filters offscreen timeline items in a large document", () => {
    const largeDocument: TimelineEditorDocument = {
      durationMs: 600_000,
      tracks: Array.from({ length: 50 }, (_, trackIndex) => ({
        id: `track-${trackIndex}`,
        label: `Track ${trackIndex}`,
        items: Array.from({ length: 100 }, (_, itemIndex) => ({
          id: `item-${trackIndex}-${itemIndex}`,
          trackId: `track-${trackIndex}`,
          label: `Item ${trackIndex}-${itemIndex}`,
          startMs: itemIndex * 6_000,
          durationMs: 1_000,
        })),
      })),
    };

    render(
      <TimelineEditor
        document={largeDocument}
        selection={{ itemIds: ["item-49-99"], anchorItemId: "item-49-99" }}
        viewport={{ pixelsPerSecond: 80, visibleStartMs: 0, visibleEndMs: 10_000 }}
      />,
    );

    expect(screen.getByRole("button", { name: "Item 49-99" })).toBeTruthy();
    expect(screen.queryAllByRole("button").length).toBeLessThan(250);
    expect(screen.queryByRole("button", { name: "Item 0-50" })).toBeNull();
  });

  test("renders, selects, scrubs, moves items, and respects read-only mode", () => {
    const document: TimelineEditorDocument = {
      tracks,
      durationMs: 8_000,
      currentTimeMs: 1_000,
      markers: [{ id: "handoff", timeMs: 4_000, label: "Handoff" }],
    };
    const handleDocumentChange = vi.fn();
    const handleCurrentTimeChange = vi.fn();
    const handleSelectedItemChange = vi.fn();
    const { container, rerender } = render(
      <TimelineWorkbench
        document={document}
        selectedItemId="brief"
        assets={[{ id: "asset", label: "Review note", kind: "review", durationMs: 1_000 }]}
        onDocumentChange={handleDocumentChange}
        onCurrentTimeChange={handleCurrentTimeChange}
        onSelectedItemChange={handleSelectedItemChange}
      />,
    );

    const item = screen.getAllByRole("button", { name: "Brief" })[0]!;
    firePointerEvent(item, "pointerdown", 0);
    expect(handleSelectedItemChange).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: "brief" }),
    );

    fireEvent.pointerDown(container.querySelector("[data-slot='timeline-editor-ruler-lane']")!, {
      clientX: 240,
    });
    expect(handleCurrentTimeChange).toHaveBeenCalled();

    handleDocumentChange.mockClear();
    firePointerEvent(container.querySelector("[data-slot='timeline-editor']")!, "pointermove", 80);
    expect(handleDocumentChange).not.toHaveBeenCalled();

    firePointerEvent(container.querySelector("[data-slot='timeline-editor']")!, "pointerup", 80);
    expect(handleDocumentChange).toHaveBeenCalled();

    handleDocumentChange.mockClear();
    rerender(
      <TimelineWorkbench
        document={document}
        selectedItemId="brief"
        readOnly
        onDocumentChange={handleDocumentChange}
      />,
    );
    firePointerEvent(screen.getAllByRole("button", { name: "Brief" })[0]!, "pointerdown", 0);
    firePointerEvent(container.querySelector("[data-slot='timeline-editor']")!, "pointermove", 80);
    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("places assets on compatible tracks when the selected track rejects the media kind", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [],
        },
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voice",
              kind: "audio",
              startMs: 1_000,
              durationMs: 1_000,
            },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        selectedItemId="voice"
        assets={[{ id: "clip", label: "Camera", kind: "video", durationMs: 1_000 }]}
        renderAsset={(asset) => asset.label}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Camera" })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            id: "video",
            items: [expect.objectContaining({ label: "Camera", kind: "video", trackId: "video" })],
          }),
          expect.objectContaining({ id: "audio" }),
        ],
      }),
    );
  });

  test("lets custom asset actions handle clicks without inserting the asset", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleAssetDelete = vi.fn();
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        assets={[{ id: "asset", label: "Review note", kind: "review", durationMs: 1_000 }]}
        renderAsset={(asset) => (
          <div>
            <span>{asset.label}</span>
            <button
              type="button"
              aria-label="Delete asset"
              onClick={() => handleAssetDelete(asset.id)}
            >
              Delete
            </button>
          </div>
        )}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete asset" }));

    expect(handleAssetDelete).toHaveBeenCalledWith("asset");
    expect(handleDocumentChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Review note" }));

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: expect.arrayContaining([
          expect.objectContaining({
            items: expect.arrayContaining([expect.objectContaining({ label: "Review note" })]),
          }),
        ]),
      }),
    );
  });

  test("ignores asset row click-through from portal menu actions", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();
    const portalAction = globalThis.document.createElement("button");
    portalAction.setAttribute("role", "menuitem");
    portalAction.textContent = "Delete asset";
    globalThis.document.body.append(portalAction);

    try {
      render(
        <TimelineWorkbench
          document={document}
          assets={[{ id: "asset", label: "Review note", kind: "review", durationMs: 1_000 }]}
          renderAsset={(asset) => asset.label}
          onDocumentChange={handleDocumentChange}
        />,
      );

      fireEvent.pointerDown(portalAction);
      fireEvent.click(screen.getByRole("button", { name: "Review note" }));

      expect(handleDocumentChange).not.toHaveBeenCalled();
    } finally {
      portalAction.remove();
    }
  });

  test("adds typed tracks from the workbench add track menu", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        assets={[{ id: "asset", label: "Review note", kind: "review", durationMs: 1_000 }]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Add Track" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Review Track" }));

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            id: "review-track-3",
            label: "Review Track 3",
            kind: "review",
            acceptsItemKinds: ["review"],
          }),
        ],
      }),
    );
  });

  test("edits shared multi-selection inspector fields in one document commit", () => {
    type ItemData = { status?: string; owner?: string };
    const document: TimelineEditorDocument<Record<string, unknown>, ItemData> = {
      durationMs: 8_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            {
              id: "brief",
              trackId: "planning",
              label: "Brief",
              startMs: 1_000,
              durationMs: 1_000,
              data: { status: "todo", owner: "A" },
            },
            {
              id: "draft",
              trackId: "planning",
              label: "Draft",
              startMs: 3_000,
              durationMs: 1_000,
              data: { status: "doing", owner: "B" },
            },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: ["brief", "draft"], anchorItemId: "brief" }}
        inspectorSchema={{
          itemFields: [{ id: "status", label: "Status", type: "text", dataKey: "status" }],
        }}
        onDocumentChange={handleDocumentChange}
      />,
    );

    expect(screen.getByText("2 timeline items")).toBeTruthy();
    expect(screen.getByLabelText("Label").getAttribute("placeholder")).toBe("Mixed values");
    expect(screen.getByLabelText("Status").getAttribute("placeholder")).toBe("Mixed values");

    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Selected" } });
    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "1500" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ready" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(handleDocumentChange).toHaveBeenCalledTimes(1);
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            items: [
              expect.objectContaining({
                id: "brief",
                label: "Selected",
                durationMs: 1_500,
                data: { status: "ready", owner: "A" },
              }),
              expect.objectContaining({
                id: "draft",
                label: "Selected",
                durationMs: 1_500,
                data: { status: "ready", owner: "B" },
              }),
            ],
          }),
        ],
      }),
    );
  });

  test("edits selected item transform keyframes from the default inspector", () => {
    let document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_500,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 2_000 },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn((nextDocument: TimelineEditorDocument) => {
      document = nextDocument;
    });
    const renderWorkbench = () => (
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        inspectorSchema={{
          transformFields: [
            { id: "x", label: "X", step: 1, defaultValue: 0 },
            { id: "opacity", label: "Opacity", min: 0, max: 1, step: 0.1, defaultValue: 1 },
          ],
        }}
        onDocumentChange={handleDocumentChange}
      />
    );
    const { rerender } = render(renderWorkbench());

    fireEvent.click(screen.getByRole("button", { name: "Add Keyframe" }));
    expect(document.tracks[0]?.items[0]?.transform?.points).toEqual([
      { offsetMs: 500, values: { x: 0, opacity: 1 }, easing: "linear" },
    ]);

    rerender(renderWorkbench());
    fireEvent.change(screen.getByLabelText("X"), { target: { value: "42" } });
    expect(document.tracks[0]?.items[0]?.transform?.points[0]).toEqual({
      offsetMs: 500,
      values: { x: 42, opacity: 1 },
      easing: "linear",
    });

    rerender(renderWorkbench());
    fireEvent.change(screen.getByLabelText("Easing"), { target: { value: "hold" } });
    expect(document.tracks[0]?.items[0]?.transform?.points[0]?.easing).toBe("hold");

    rerender(renderWorkbench());
    fireEvent.click(screen.getByRole("button", { name: "Remove Keyframe" }));
    expect(document.tracks[0]?.items[0]?.transform).toBeUndefined();
  });

  test("manages track groups from the workbench group menu without deleting tracks", () => {
    let document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleDocumentChange = vi.fn((nextDocument: TimelineEditorDocument) => {
      document = nextDocument;
    });
    const renderWorkbench = () => (
      <TimelineWorkbench document={document} onDocumentChange={handleDocumentChange} />
    );
    const { rerender } = render(renderWorkbench());

    fireEvent.keyDown(screen.getByRole("button", { name: "Track Groups" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Create Group From All Tracks" }));

    expect(document.groups).toEqual([
      expect.objectContaining({ label: "Group 1", trackIds: ["planning", "review"] }),
    ]);

    rerender(renderWorkbench());
    fireEvent.keyDown(screen.getByRole("button", { name: "Track Groups" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Collapse Group 1" }));
    expect(document.groups?.[0]).toEqual(expect.objectContaining({ collapsed: true }));

    rerender(renderWorkbench());
    fireEvent.keyDown(screen.getByRole("button", { name: "Track Groups" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Lock Group 1" }));
    expect(document.groups?.[0]).toEqual(expect.objectContaining({ locked: true }));

    rerender(renderWorkbench());
    fireEvent.keyDown(screen.getByRole("button", { name: "Track Groups" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove Group 1" }));
    expect(document.groups ?? []).toEqual([]);
    expect(document.tracks.map((track) => track.id)).toEqual(["planning", "review"]);
  });

  test("adjusts workbench hotkeys from the toolbar menu", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();
    const handleHotkeysChange = vi.fn();
    const { container } = render(
      <TimelineWorkbench
        document={document}
        selectedItemId="brief"
        onDocumentChange={handleDocumentChange}
        onHotkeysChange={handleHotkeysChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hotkeys" }));
    fireEvent.keyDown(screen.getByLabelText("Duplicate hotkey"), {
      key: "K",
      ctrlKey: true,
    });

    expect(handleHotkeysChange).toHaveBeenCalledWith(
      expect.objectContaining({ duplicate: "Mod+K" }),
    );
    expect(handleDocumentChange).not.toHaveBeenCalled();

    fireEvent.keyDown(container.querySelector("[data-slot='timeline-workbench']")!, {
      key: "K",
      ctrlKey: true,
    });

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            items: expect.arrayContaining([expect.objectContaining({ id: "brief-copy" })]),
          }),
          expect.anything(),
        ],
      }),
    );
  });

  test("applies workbench edit policy to asset insertion", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_500,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 2_000 },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        editPolicy={{ overlap: "prevent", ripple: false }}
        assets={[{ id: "asset", label: "Review note", durationMs: 1_000 }]}
        renderAsset={(asset) => asset.label}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Review note" })[0]!);

    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("supports controlled workbench viewport changes", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleViewportChange = vi.fn();
    const { container, rerender } = render(
      <TimelineWorkbench
        document={document}
        viewport={{ pixelsPerSecond: 80 }}
        onViewportChange={handleViewportChange}
      />,
    );
    const getEditorContentWidth = () =>
      container.querySelector<HTMLElement>("[data-slot='timeline-editor'] > div")?.style.width;

    expect(getEditorContentWidth()).toBe("784px");

    rerender(
      <TimelineWorkbench
        document={document}
        viewport={{ pixelsPerSecond: 160 }}
        onViewportChange={handleViewportChange}
      />,
    );

    expect(getEditorContentWidth()).toBe("1424px");

    fireEvent.wheel(container.querySelector("[data-slot='timeline-editor']")!, {
      clientX: 100,
      ctrlKey: true,
      deltaY: -120,
    });
    expect(handleViewportChange).toHaveBeenCalledWith(
      expect.objectContaining({ pixelsPerSecond: 176 }),
    );
  });

  test("applies controlled timeline scrollLeftMs to the scroller", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const restoreScrollSize = mockTimelineEditorScrollSize({ clientWidth: 320, scrollWidth: 784 });

    try {
      const { container, rerender } = render(
        <TimelineEditor
          document={document}
          viewport={{ pixelsPerSecond: 80, scrollLeftMs: 2_000 }}
        />,
      );
      const editor = container.querySelector<HTMLElement>("[data-slot='timeline-editor']")!;

      expect(editor.scrollLeft).toBe(304);

      rerender(
        <TimelineEditor
          document={document}
          viewport={{ pixelsPerSecond: 80, scrollLeftMs: 3_000 }}
        />,
      );

      expect(editor.scrollLeft).toBe(384);
    } finally {
      restoreScrollSize();
    }
  });

  test("reports timeline scrollLeftMs when the scroller moves", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleViewportChange = vi.fn();
    const restoreScrollSize = mockTimelineEditorScrollSize({ clientWidth: 320, scrollWidth: 784 });

    try {
      const { container } = render(
        <TimelineEditor
          document={document}
          viewport={{ pixelsPerSecond: 80 }}
          onViewportChange={handleViewportChange}
        />,
      );
      const editor = container.querySelector<HTMLElement>("[data-slot='timeline-editor']")!;

      editor.scrollLeft = 304;
      fireEvent.scroll(editor);

      expect(handleViewportChange).toHaveBeenCalledWith(
        expect.objectContaining({ pixelsPerSecond: 80, scrollLeftMs: 2_000 }),
      );
    } finally {
      restoreScrollSize();
    }
  });

  test("keeps followed current time visible without centering continuously", () => {
    const baseDocument: TimelineEditorDocument = {
      durationMs: 20_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const handleViewportChange = vi.fn();
    const restoreScrollSize = mockTimelineEditorScrollSize({
      clientWidth: 320,
      scrollWidth: 1_744,
    });

    try {
      const { container, rerender } = render(
        <TimelineEditor
          document={baseDocument}
          viewport={{ pixelsPerSecond: 80 }}
          followCurrentTime="keep-visible"
          onViewportChange={handleViewportChange}
        />,
      );
      const editor = container.querySelector<HTMLElement>("[data-slot='timeline-editor']")!;

      expect(editor.scrollLeft).toBe(0);
      expect(handleViewportChange).not.toHaveBeenCalled();

      rerender(
        <TimelineEditor
          document={{ ...baseDocument, currentTimeMs: 6_000 }}
          viewport={{ pixelsPerSecond: 80 }}
          followCurrentTime="keep-visible"
          onViewportChange={handleViewportChange}
        />,
      );

      expect(editor.scrollLeft).toBe(368);
      expect(handleViewportChange).toHaveBeenCalledWith(
        expect.objectContaining({ pixelsPerSecond: 80, scrollLeftMs: 2_800 }),
      );
    } finally {
      restoreScrollSize();
    }
  });

  test("prevents ctrl-wheel browser default and reports zoom changes", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleViewportChange = vi.fn();
    const restoreScrollSize = mockTimelineEditorScrollSize({ clientWidth: 320, scrollWidth: 784 });

    try {
      const { container } = render(
        <TimelineEditor
          document={document}
          viewport={{ pixelsPerSecond: 80 }}
          onViewportChange={handleViewportChange}
        />,
      );
      const editor = container.querySelector<HTMLElement>("[data-slot='timeline-editor']")!;
      const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        ctrlKey: true,
        deltaY: -120,
      });

      expect(editor.dispatchEvent(event)).toBe(false);
      expect(event.defaultPrevented).toBe(true);
      expect(handleViewportChange).toHaveBeenCalledWith(
        expect.objectContaining({ pixelsPerSecond: 96 }),
      );
    } finally {
      restoreScrollSize();
    }
  });

  test("uses deterministic workbench item and marker ids when provided", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        assets={[{ id: "asset", label: "Review note", kind: "review", durationMs: 1_000 }]}
        createItemId={() => "review-note-fixed"}
        createMarkerId={() => "marker-fixed"}
        renderAsset={(asset) => asset.label}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Review note" })[0]!);
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            items: expect.arrayContaining([expect.objectContaining({ id: "review-note-fixed" })]),
          }),
          expect.anything(),
        ],
      }),
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "More" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Add Marker" }));
    expect(handleDocumentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        markers: [expect.objectContaining({ id: "marker-fixed", timeMs: 1_000 })],
      }),
    );
  });

  test("renders display-only media extensions and preserves media data", () => {
    type MediaItemData =
      | TimelineAudioItemData
      | TimelineVideoItemData
      | TimelineImageItemData
      | TimelineTextItemData
      | TimelineNumericDataItemData;

    const document: TimelineEditorDocument<Record<string, unknown>, MediaItemData> = {
      durationMs: 8_000,
      currentTimeMs: 2_500,
      tracks: [
        {
          id: "text",
          label: "Text",
          acceptsItemKinds: ["text", "caption", "subtitle"],
          items: [
            {
              id: "subtitle",
              trackId: "text",
              label: "Subtitle",
              kind: "subtitle",
              startMs: 1_000,
              durationMs: 3_000,
              data: {
                mediaType: "text",
                format: "ass-like",
                language: "en",
                cues: [
                  { startMs: 0, endMs: 1_000, text: "Intro line", styleName: "Default" },
                  { startMs: 1_001, endMs: 2_200, text: "Middle line", styleName: "Default" },
                ],
              },
            },
          ],
        },
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voiceover",
              kind: "audio",
              startMs: 0,
              durationMs: 4_000,
              data: {
                mediaType: "audio",
                muted: true,
                source: { label: "voice.wav" },
                waveform: [0.1, 0.5, 0.9, 0.3],
              },
            },
          ],
        },
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [
            {
              id: "scene",
              trackId: "video",
              label: "Scene",
              kind: "video",
              startMs: 0,
              durationMs: 4_000,
              data: {
                mediaType: "video",
                source: { label: "scene.mp4" },
                thumbnails: ["thumb-1.png", "thumb-2.png"],
              },
            },
          ],
        },
        {
          id: "image",
          label: "Image",
          acceptsItemKinds: ["image"],
          items: [
            {
              id: "poster",
              trackId: "image",
              label: "Poster",
              kind: "image",
              startMs: 1_000,
              durationMs: 2_000,
              data: {
                mediaType: "image",
                thumbnail: "poster-thumb.png",
                width: 1920,
                height: 1080,
              },
            },
          ],
        },
        {
          id: "data",
          label: "Data",
          acceptsItemKinds: ["data", "numeric-data"],
          items: [
            {
              id: "telemetry",
              trackId: "data",
              label: "Telemetry",
              kind: "numeric-data",
              startMs: 0,
              durationMs: 4_000,
              data: {
                mediaType: "numeric-data",
                series: [
                  {
                    label: "Speed",
                    unit: "km/h",
                    points: [
                      { timeMs: 0, value: 0 },
                      { timeMs: 1_000, value: 25 },
                      { timeMs: 2_000, value: 10 },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();
    const extensions = [
      createTimelineTextExtension(),
      createTimelineAudioExtension(),
      createTimelineVideoExtension(),
      createTimelineImageExtension(),
      createTimelineNumericDataExtension(),
    ] as Array<TimelineEditorExtension<MediaItemData>>;

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: ["subtitle"], anchorItemId: "subtitle" }}
        assets={[
          {
            id: "music",
            label: "Music",
            kind: "audio",
            mediaType: "audio",
            durationMs: 2_000,
            data: {
              mediaType: "audio",
              source: { label: "music.wav" },
              waveform: [0.2, 0.8],
            } satisfies TimelineAudioItemData,
          },
        ]}
        extensions={extensions}
        onDocumentChange={handleDocumentChange}
      />,
    );

    expect(screen.getByText("Middle line")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-media-audio-waveform']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-media-video-thumbnails']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-media-image-thumbnail']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-media-numeric-sparkline']")).toBeTruthy();

    const parsed = parseTimelineEditorDocument(serializeTimelineEditorDocument(document));
    expect(parsed.tracks[0]?.items[0]?.data).toEqual(document.tracks[0]?.items[0]?.data);
    expect(parsed.tracks[4]?.items[0]?.data).toEqual(document.tracks[4]?.items[0]?.data);

    fireEvent.click(screen.getAllByRole("button", { name: /Music/ })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: expect.arrayContaining([
          expect.objectContaining({
            id: "audio",
            items: expect.arrayContaining([
              expect.objectContaining({
                kind: "audio",
                data: expect.objectContaining({
                  mediaType: "audio",
                  source: { label: "music.wav" },
                }),
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  test("defaults preview mode to active scene items", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            {
              id: "active",
              trackId: "planning",
              label: "Active item",
              startMs: 500,
              durationMs: 1_000,
            },
            {
              id: "selected",
              trackId: "planning",
              label: "Selected item",
              startMs: 5_000,
              durationMs: 1_000,
            },
          ],
        },
      ],
    };
    const { container } = render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: ["selected"], anchorItemId: "selected" }}
      />,
    );
    const preview = within(container.querySelector("[data-slot='timeline-workbench-preview']")!);

    expect(preview.getByText("Active item")).toBeTruthy();
    expect(preview.queryByText("Selected item")).toBeNull();
  });

  test("renders active subtitle cues in the scene preview", () => {
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineTextItemData> = {
      durationMs: 6_000,
      currentTimeMs: 1_500,
      tracks: [
        {
          id: "subtitles",
          label: "Subtitles",
          acceptsItemKinds: ["subtitle"],
          items: [
            {
              id: "subtitle",
              trackId: "subtitles",
              label: "Subtitle",
              kind: "subtitle",
              startMs: 1_000,
              durationMs: 4_000,
              data: {
                mediaType: "text",
                format: "srt",
                cues: [
                  { startMs: 0, endMs: 1_000, text: "First cue" },
                  { startMs: 1_001, endMs: 3_000, text: "Second cue" },
                ],
              },
            },
          ],
        },
      ],
    };
    const { container, rerender } = render(<TimelineWorkbench document={document} />);

    expect(
      container.querySelector("[data-slot='timeline-workbench-scene-subtitles']"),
    ).toBeTruthy();
    expect(screen.getByText("First cue")).toBeTruthy();

    rerender(
      <TimelineWorkbench
        document={{
          ...document,
          currentTimeMs: 3_000,
        }}
      />,
    );

    expect(screen.getByText("Second cue")).toBeTruthy();
    expect(screen.queryByText("First cue")).toBeNull();
  });

  test("omits subtitle overlay during cue gaps", () => {
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineTextItemData> = {
      durationMs: 6_000,
      currentTimeMs: 2_500,
      tracks: [
        {
          id: "subtitles",
          label: "Subtitles",
          acceptsItemKinds: ["subtitle"],
          items: [
            {
              id: "subtitle",
              trackId: "subtitles",
              label: "Subtitle",
              kind: "subtitle",
              startMs: 1_000,
              durationMs: 4_000,
              data: {
                mediaType: "text",
                cues: [
                  { startMs: 0, endMs: 500, text: "Before gap" },
                  { startMs: 2_500, endMs: 3_000, text: "After gap" },
                ],
              },
            },
          ],
        },
      ],
    };
    const { container } = render(<TimelineWorkbench document={document} />);

    expect(container.querySelector("[data-slot='timeline-workbench-scene-subtitles']")).toBeNull();
    expect(screen.queryByText("Before gap")).toBeNull();
    expect(screen.queryByText("After gap")).toBeNull();
  });

  test("renders multiple styled ASS subtitle cues in layer order", () => {
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineTextItemData> = {
      durationMs: 6_000,
      currentTimeMs: 2_000,
      tracks: [
        {
          id: "subtitles",
          label: "Subtitles",
          acceptsItemKinds: ["subtitle"],
          items: [
            {
              id: "subtitle",
              trackId: "subtitles",
              label: "Subtitle",
              kind: "subtitle",
              startMs: 1_000,
              durationMs: 4_000,
              data: {
                mediaType: "text",
                format: "ass",
                styles: [
                  {
                    name: "Top",
                    color: "#00ff00",
                    fontSize: 32,
                    bold: true,
                    alignment: "top-center",
                    marginVertical: 20,
                  },
                ],
                cues: [
                  { startMs: 0, endMs: 2_000, text: "Lower", layer: 0 },
                  {
                    startMs: 0,
                    endMs: 2_000,
                    text: "Upper",
                    layer: 1,
                    styleName: "Top",
                    color: "#ff0000",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const { container } = render(<TimelineWorkbench document={document} />);
    const cues = container.querySelectorAll("[data-slot='timeline-workbench-scene-subtitle-cue']");

    expect(cues).toHaveLength(2);
    expect(cues[0]?.textContent).toBe("Lower");
    expect(cues[1]?.textContent).toBe("Upper");
    expect((cues[1] as HTMLElement).dataset["subtitleStyle"]).toBe("Top");
    expect((cues[1] as HTMLElement).style.top).toBe("20px");

    const styledCue = cues[1]?.firstElementChild as HTMLElement;
    expect(styledCue.style.color).toBe("rgb(255, 0, 0)");
    expect(styledCue.style.fontSize).toBe("32px");
    expect(styledCue.style.fontWeight).toBe("700");
  });

  test("fetches and parses source-backed subtitles for scene preview", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => "00:00:00,000 --> 00:00:02,000\nFetched subtitle",
    } as Response);
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineTextItemData> = {
      durationMs: 6_000,
      currentTimeMs: 1_500,
      tracks: [
        {
          id: "subtitles",
          label: "Subtitles",
          acceptsItemKinds: ["subtitle"],
          items: [
            {
              id: "subtitle",
              trackId: "subtitles",
              label: "Subtitle",
              kind: "subtitle",
              startMs: 1_000,
              durationMs: 4_000,
              data: {
                mediaType: "text",
                source: {
                  uri: "/captions.srt",
                  label: "captions.srt",
                  mimeType: "application/x-subrip",
                },
              },
            },
          ],
        },
      ],
    };

    render(<TimelineWorkbench document={document} />);

    expect(await screen.findByText("Fetched subtitle")).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith("/captions.srt");
  });

  test("shows a compact state for failed standalone subtitle sources", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("missing"));
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineTextItemData> = {
      durationMs: 6_000,
      currentTimeMs: 1_500,
      tracks: [
        {
          id: "subtitles",
          label: "Subtitles",
          acceptsItemKinds: ["subtitle"],
          items: [
            {
              id: "subtitle",
              trackId: "subtitles",
              label: "Subtitle",
              kind: "subtitle",
              startMs: 1_000,
              durationMs: 4_000,
              data: {
                mediaType: "text",
                source: { uri: "/missing.ass", label: "missing.ass" },
              },
            },
          ],
        },
      ],
    };

    render(<TimelineWorkbench document={document} />);

    expect(await screen.findByText("Subtitle source unavailable")).toBeTruthy();
  });

  test("renders controlled preview mode and preserves selection-first behavior", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            {
              id: "active",
              trackId: "planning",
              label: "Active item",
              startMs: 500,
              durationMs: 1_000,
            },
            {
              id: "selected",
              trackId: "planning",
              label: "Selected item",
              startMs: 5_000,
              durationMs: 1_000,
            },
          ],
        },
      ],
    };
    const { container } = render(
      <TimelineWorkbench
        document={document}
        previewMode="selection-first"
        selection={{ itemIds: ["selected"], anchorItemId: "selected" }}
      />,
    );
    const preview = within(container.querySelector("[data-slot='timeline-workbench-preview']")!);

    expect(preview.getByText("Selected item")).toBeTruthy();
    expect(preview.queryByText("Active item")).toBeNull();
  });

  test("calls onPreviewModeChange when the preview mode changes", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const handlePreviewModeChange = vi.fn();

    render(<TimelineWorkbench document={document} onPreviewModeChange={handlePreviewModeChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "Timeline" }));

    expect(handlePreviewModeChange).toHaveBeenCalledWith("mini-timeline");
    expect(screen.getByRole("radio", { name: "Timeline" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  test("renders mini timeline preview rows and playhead", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const { container } = render(
      <TimelineWorkbench document={document} previewMode="mini-timeline" />,
    );

    expect(container.querySelector("[data-slot='timeline-workbench-mini-preview']")).toBeTruthy();
    expect(
      container.querySelectorAll("[data-slot='timeline-workbench-mini-preview-row']"),
    ).toHaveLength(2);
    expect(
      container.querySelector("[data-slot='timeline-workbench-mini-preview-playhead']"),
    ).toBeTruthy();
  });

  test("preview playback advances current time through document changes", () => {
    vi.useFakeTimers();
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    let currentDocument = document;
    const handleDocumentChange = vi.fn((nextDocument: TimelineEditorDocument) => {
      currentDocument = nextDocument;
    });

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);

      return (
        <TimelineWorkbench
          document={stateDocument}
          onDocumentChange={(nextDocument) => {
            handleDocumentChange(nextDocument);
            setStateDocument(nextDocument);
          }}
        />
      );
    }

    render(<StatefulWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(handleDocumentChange).toHaveBeenCalled();
    expect(currentDocument.currentTimeMs).toBeGreaterThan(1_000);
  });

  test("preview playback stops at document duration", () => {
    vi.useFakeTimers();
    const document: TimelineEditorDocument = {
      durationMs: 1_100,
      currentTimeMs: 1_084,
      tracks,
    };
    let currentDocument = document;

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      currentDocument = stateDocument;

      return (
        <TimelineWorkbench
          document={stateDocument}
          onDocumentChange={(nextDocument) => {
            currentDocument = nextDocument;
            setStateDocument(nextDocument);
          }}
        />
      );
    }

    render(<StatefulWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      for (let index = 0; index < 12; index += 1) {
        vi.advanceTimersByTime(16);
      }
    });

    expect(currentDocument.currentTimeMs).toBe(1_100);
    expect(screen.getByRole("button", { name: "Play" })).toHaveProperty("disabled", false);
    expect(screen.getByText("1x")).toBeTruthy();
  });

  test("preview playback current-time updates do not create undo history entries", () => {
    vi.useFakeTimers();
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const handleHistoryChange = vi.fn();

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      const [history, setHistory] = useState(() => createTimelineEditorHistory());

      return (
        <TimelineWorkbench
          document={stateDocument}
          history={history}
          onHistoryChange={(nextHistory) => {
            handleHistoryChange(nextHistory);
            setHistory(nextHistory);
          }}
          onDocumentChange={setStateDocument}
        />
      );
    }

    render(<StatefulWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(handleHistoryChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", true);
  });

  test("renders uncontrolled and controlled transport state", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const { container, rerender } = render(<TimelineWorkbench document={document} />);

    expect(container.querySelector("[data-slot='timeline-workbench-transport']")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByText("1x")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Loop" }).getAttribute("aria-pressed")).toBe("false");

    rerender(
      <TimelineWorkbench
        document={document}
        transportState={{ status: "playing", playbackRate: -2, loop: true }}
      />,
    );

    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(screen.getByText("-2x")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Loop" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("emits transport state change reasons from transport controls", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const handleTransportStateChange = vi.fn();

    render(
      <TimelineWorkbench document={document} onTransportStateChange={handleTransportStateChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(handleTransportStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "playing", playbackRate: 1, loop: false }),
      expect.objectContaining({ reason: "toggle-play", currentTimeMs: 1_000, durationMs: 8_000 }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Shuttle forward" }));
    expect(handleTransportStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "playing", playbackRate: 2 }),
      expect.objectContaining({ reason: "shuttle-forward" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Shuttle backward" }));
    expect(handleTransportStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "playing", playbackRate: -1 }),
      expect.objectContaining({ reason: "shuttle-backward" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Loop" }));
    expect(handleTransportStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ loop: true }),
      expect.objectContaining({ reason: "loop-toggle" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(handleTransportStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "paused" }),
      expect.objectContaining({ reason: "toggle-play" }),
    );
  });

  test("space and J/K/L hotkeys control transport playback", () => {
    vi.useFakeTimers();
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    let currentDocument = document;

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      currentDocument = stateDocument;

      return <TimelineWorkbench document={stateDocument} onDocumentChange={setStateDocument} />;
    }

    const { container } = render(<StatefulWorkbench />);
    const workbench = container.querySelector("[data-slot='timeline-workbench']")!;
    const spaceEvent = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      fireEvent(workbench, spaceEvent);
    });
    expect(spaceEvent.defaultPrevented).toBe(true);
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(currentDocument.currentTimeMs).toBeGreaterThan(1_000);

    fireEvent.keyDown(workbench, { key: "l" });
    expect(screen.getByText("2x")).toBeTruthy();
    fireEvent.keyDown(workbench, { key: "l" });
    expect(screen.getByText("4x")).toBeTruthy();
    fireEvent.keyDown(workbench, { key: "j" });
    expect(screen.getByText("-1x")).toBeTruthy();

    const reversedFrom = currentDocument.currentTimeMs ?? 0;
    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(currentDocument.currentTimeMs).toBeLessThan(reversedFrom);

    fireEvent.keyDown(workbench, { key: "k" });
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  test("loop playback wraps within the selected range", () => {
    vi.useFakeTimers();
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_900,
      tracks,
    };
    let currentDocument = document;

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      currentDocument = stateDocument;

      return (
        <TimelineWorkbench
          document={stateDocument}
          defaultTransportState={{ status: "playing", loop: true }}
          selection={{ itemIds: [], range: { startMs: 1_000, endMs: 2_000 } }}
          onDocumentChange={setStateDocument}
        />
      );
    }

    render(<StatefulWorkbench />);
    act(() => {
      vi.advanceTimersByTime(240);
    });

    expect(currentDocument.currentTimeMs).toBeGreaterThanOrEqual(1_000);
    expect(currentDocument.currentTimeMs).toBeLessThan(2_000);
  });

  test("loop playback wraps cleanly from exact selected range boundaries", () => {
    let document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 2_000,
      tracks,
    };

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      document = stateDocument;

      return (
        <TimelineWorkbench
          document={stateDocument}
          defaultTransportState={{ loop: true }}
          selection={{ itemIds: [], range: { startMs: 1_000, endMs: 2_000 } }}
          onDocumentChange={setStateDocument}
        />
      );
    }

    const { unmount } = render(<StatefulWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(document.currentTimeMs).toBe(1_000);

    unmount();
    document = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const rendered = render(<StatefulWorkbench />);

    fireEvent.keyDown(rendered.container.querySelector("[data-slot='timeline-workbench']")!, {
      key: "j",
    });
    expect(document.currentTimeMs).toBe(2_000);
  });

  test("full document loop wraps from the exact document end", () => {
    let document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 8_000,
      tracks,
    };

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      document = stateDocument;

      return (
        <TimelineWorkbench
          document={stateDocument}
          defaultTransportState={{ loop: true }}
          onDocumentChange={setStateDocument}
        />
      );
    }

    render(<StatefulWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(document.currentTimeMs).toBe(0);
  });

  test("read-only workbench disables preview playback", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };

    render(<TimelineWorkbench document={document} readOnly />);

    expect(screen.getByRole("button", { name: "Play" })).toHaveProperty("disabled", true);
  });

  test("defaultTransportState initializes uncontrolled transport", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };

    render(
      <TimelineWorkbench
        document={document}
        defaultTransportState={{ status: "playing", playbackRate: 2, loop: true }}
      />,
    );

    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(screen.getByText("2x")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Loop" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("controlled transport emits changes without mutating the visible state", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const handleTransportStateChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        transportState={{ status: "paused", playbackRate: 1, loop: false }}
        onTransportStateChange={handleTransportStateChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(handleTransportStateChange).toHaveBeenCalledWith(
      { status: "playing", playbackRate: 1, loop: false },
      expect.objectContaining({ reason: "toggle-play" }),
    );
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByText("1x")).toBeTruthy();
  });

  test("K stops playback and resets the playback rate to 1x", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const handleTransportStateChange = vi.fn();

    const { container } = render(
      <TimelineWorkbench
        document={document}
        defaultTransportState={{ status: "playing", playbackRate: 4 }}
        onTransportStateChange={handleTransportStateChange}
      />,
    );
    fireEvent.keyDown(container.querySelector("[data-slot='timeline-workbench']")!, { key: "k" });

    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByText("1x")).toBeTruthy();
    expect(handleTransportStateChange).toHaveBeenLastCalledWith(
      { status: "paused", playbackRate: 1, loop: false },
      expect.objectContaining({ reason: "stop" }),
    );
  });

  test("playback starts from opposite endpoints when requested at an edge", () => {
    let document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 8_000,
      tracks,
    };

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      document = stateDocument;

      return <TimelineWorkbench document={stateDocument} onDocumentChange={setStateDocument} />;
    }

    const { unmount } = render(<StatefulWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(document.currentTimeMs).toBe(0);

    unmount();
    document = { durationMs: 8_000, currentTimeMs: 0, tracks };
    const rendered = render(<StatefulWorkbench />);

    fireEvent.keyDown(rendered.container.querySelector("[data-slot='timeline-workbench']")!, {
      key: "j",
    });
    expect(document.currentTimeMs).toBe(8_000);
    expect(
      rendered.container.querySelector("[data-slot='timeline-workbench-transport-rate']")
        ?.textContent,
    ).toBe("-1x");
  });

  test("non-loop playback clamps at both ends and emits ended", () => {
    vi.useFakeTimers();
    let document: TimelineEditorDocument = {
      durationMs: 200,
      currentTimeMs: 190,
      tracks,
    };
    const handleTransportStateChange = vi.fn();

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      document = stateDocument;

      return (
        <TimelineWorkbench
          document={stateDocument}
          onDocumentChange={setStateDocument}
          onTransportStateChange={handleTransportStateChange}
        />
      );
    }

    const { unmount } = render(<StatefulWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      for (let index = 0; index < 8; index += 1) {
        vi.advanceTimersByTime(16);
      }
    });
    expect(document.currentTimeMs).toBe(200);
    expect(handleTransportStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "paused" }),
      expect.objectContaining({ reason: "ended" }),
    );

    unmount();
    document = { durationMs: 200, currentTimeMs: 10, tracks };
    const rendered = render(<StatefulWorkbench />);
    fireEvent.keyDown(rendered.container.querySelector("[data-slot='timeline-workbench']")!, {
      key: "j",
    });
    act(() => {
      for (let index = 0; index < 8; index += 1) {
        vi.advanceTimersByTime(16);
      }
    });
    expect(document.currentTimeMs).toBe(0);
    expect(handleTransportStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "paused" }),
      expect.objectContaining({ reason: "ended" }),
    );
  });

  test("loop playback falls back to the whole document without a valid selected range", () => {
    vi.useFakeTimers();
    let document: TimelineEditorDocument = {
      durationMs: 1_000,
      currentTimeMs: 990,
      tracks,
    };

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      document = stateDocument;

      return (
        <TimelineWorkbench
          document={stateDocument}
          defaultTransportState={{ status: "playing", loop: true }}
          selection={{ itemIds: [], range: { startMs: 500, endMs: 500.5 } }}
          onDocumentChange={setStateDocument}
        />
      );
    }

    render(<StatefulWorkbench />);
    act(() => {
      for (let index = 0; index < 8; index += 1) {
        vi.advanceTimersByTime(16);
      }
    });

    expect(document.currentTimeMs).toBeGreaterThanOrEqual(0);
    expect(document.currentTimeMs).toBeLessThan(200);
  });

  test("read-only becoming true pauses active transport", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const handleTransportStateChange = vi.fn();
    const { rerender } = render(
      <TimelineWorkbench
        document={document}
        defaultTransportState={{ status: "playing" }}
        onTransportStateChange={handleTransportStateChange}
      />,
    );

    rerender(
      <TimelineWorkbench
        document={document}
        readOnly
        defaultTransportState={{ status: "playing" }}
        onTransportStateChange={handleTransportStateChange}
      />,
    );

    expect(handleTransportStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "paused" }),
      expect.objectContaining({ reason: "read-only" }),
    );
  });

  test("synchronized media applies local time, source bounds, rate, volume, and mute", async () => {
    const media = installMockMediaElement();
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineAudioItemData> = {
      durationMs: 4_000,
      currentTimeMs: 1_250,
      tracks: [
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voiceover",
              kind: "audio",
              startMs: 1_000,
              durationMs: 2_000,
              data: {
                mediaType: "audio",
                muted: true,
                volume: 0.25,
                sourceStartMs: 500,
                sourceEndMs: 1_500,
                source: { uri: "blob:voice", mimeType: "audio/wav" },
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        defaultTransportState={{ status: "playing", playbackRate: 2 }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    const player = container.querySelector(
      "[data-slot='timeline-workbench-scene-audio']",
    ) as HTMLAudioElement;
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector("[data-slot='timeline-media-audio-preview-player']")).toBeNull();
    expect(player.currentTime).toBe(0.75);
    expect(player.playbackRate).toBe(2);
    expect(player.muted).toBe(true);
    expect(player.volume).toBe(0.25);
    expect(media.play).toHaveBeenCalled();
    expect(player.dataset["playState"]).toBe("playing");
    media.restore();
  });

  test("forward synchronized media starts once while timeline playback continues", async () => {
    const media = installMockMediaElement();
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineAudioItemData> = {
      durationMs: 4_000,
      currentTimeMs: 1_000,
      tracks: [
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voiceover",
              kind: "audio",
              startMs: 0,
              durationMs: 3_000,
              data: {
                mediaType: "audio",
                source: { uri: "blob:voice", mimeType: "audio/wav" },
              },
            },
          ],
        },
      ],
    };

    const rendered = render(
      <TimelineWorkbench
        document={document}
        transportState={{ status: "playing", playbackRate: 1, loop: false }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    const player = rendered.container.querySelector(
      "[data-slot='timeline-workbench-scene-audio']",
    ) as HTMLAudioElement;

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(player.dataset["playCount"]).toBe("1");

    rendered.rerender(
      <TimelineWorkbench
        document={{ ...document, currentTimeMs: 1_080 }}
        transportState={{ status: "playing", playbackRate: 1, loop: false }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(player.currentTime).toBe(1);

    rendered.rerender(
      <TimelineWorkbench
        document={{ ...document, currentTimeMs: 1_300 }}
        transportState={{ status: "playing", playbackRate: 1, loop: false }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(player.currentTime).toBe(1);

    rendered.rerender(
      <TimelineWorkbench
        document={{ ...document, currentTimeMs: 2_000 }}
        transportState={{ status: "playing", playbackRate: 1, loop: false }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(player.currentTime).toBe(2);

    rendered.rerender(
      <TimelineWorkbench
        document={{ ...document, currentTimeMs: 2_040 }}
        transportState={{ status: "paused", playbackRate: 1, loop: false }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    expect(media.pause).toHaveBeenCalledTimes(1);
    expect(player.dataset["playState"]).toBe("paused");
    media.restore();
  });

  test("reverse synchronized media pauses and seeks instead of playing", () => {
    const media = installMockMediaElement();
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineVideoItemData> = {
      durationMs: 4_000,
      currentTimeMs: 1_500,
      tracks: [
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [
            {
              id: "clip",
              trackId: "video",
              label: "Clip",
              kind: "video",
              startMs: 1_000,
              durationMs: 2_000,
              data: {
                mediaType: "video",
                source: { uri: "blob:clip" },
                poster: "blob:poster",
                sourceStartMs: 250,
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        defaultTransportState={{ status: "playing", playbackRate: -1 }}
        extensions={[createTimelineVideoExtension()]}
      />,
    );
    const player = container.querySelector(
      "[data-slot='timeline-workbench-scene-video']",
    ) as HTMLVideoElement;

    expect(player.currentTime).toBe(0.75);
    expect(player.poster).toContain("blob:poster");
    expect(media.play).not.toHaveBeenCalled();
    expect(media.pause).not.toHaveBeenCalled();
    media.restore();
  });

  test("media play failures are contained and reported as blocked", async () => {
    const media = installMockMediaElement();
    media.play.mockImplementationOnce(() => Promise.reject(new Error("blocked")));
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineAudioItemData> = {
      durationMs: 4_000,
      currentTimeMs: 1_000,
      tracks: [
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voiceover",
              kind: "audio",
              startMs: 0,
              durationMs: 2_000,
              data: { mediaType: "audio", source: { uri: "blob:voice" } },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        defaultTransportState={{ status: "playing" }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(container.querySelector("[data-slot='timeline-media-playback-blocked']")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();

    media.play.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    render(
      <TimelineWorkbench
        document={document}
        defaultTransportState={{ status: "playing" }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Pause" }).length).toBeGreaterThan(0);
    media.restore();
  });

  test("preloads loop audio at the loop start without taking over playback", () => {
    const media = installMockMediaElement();
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineAudioItemData> = {
      durationMs: 4_000,
      currentTimeMs: 3_000,
      tracks: [
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voiceover",
              kind: "audio",
              startMs: 1_000,
              durationMs: 800,
              data: {
                mediaType: "audio",
                sourceStartMs: 250,
                source: { uri: "blob:voice" },
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: [], range: { startMs: 1_000, endMs: 1_800 } }}
        transportState={{ status: "paused", playbackRate: 1, loop: true }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    const preload = container.querySelector(
      "[data-slot='timeline-workbench-scene-media-preload'][data-media-type='audio']",
    ) as HTMLAudioElement | null;

    expect(container.querySelector("[data-slot='timeline-workbench-scene-audio']")).toBeNull();
    expect(preload).toBeTruthy();
    expect(preload?.src).toContain("blob:voice");
    expect(preload?.preload).toBe("auto");
    act(() => {
      preload?.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(preload?.currentTime).toBe(0.25);
    expect(media.play).not.toHaveBeenCalled();
    media.restore();
  });

  test("preloads loop video at the loop start without taking over playback", () => {
    const media = installMockMediaElement();
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineVideoItemData> = {
      durationMs: 4_000,
      currentTimeMs: 3_000,
      tracks: [
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [
            {
              id: "clip",
              trackId: "video",
              label: "Clip",
              kind: "video",
              startMs: 1_000,
              durationMs: 800,
              data: {
                mediaType: "video",
                poster: "blob:poster",
                sourceStartMs: 250,
                source: { uri: "blob:clip" },
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: [], range: { startMs: 1_000, endMs: 1_800 } }}
        transportState={{ status: "paused", playbackRate: 1, loop: true }}
        extensions={[createTimelineVideoExtension()]}
      />,
    );
    const preload = container.querySelector(
      "video[data-slot='timeline-workbench-scene-media-preload'][data-media-type='video']",
    ) as HTMLVideoElement | null;

    expect(container.querySelector("[data-slot='timeline-workbench-scene-video']")).toBeNull();
    expect(preload).toBeTruthy();
    expect(preload?.src).toContain("blob:clip");
    expect(preload?.preload).toBe("auto");
    expect(preload?.muted).toBe(true);
    expect(preload?.poster).toContain("blob:poster");
    act(() => {
      preload?.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(preload?.currentTime).toBe(0.25);
    expect(media.play).not.toHaveBeenCalled();
    media.restore();
  });

  test("preloads nearby cursor video before it becomes active", () => {
    const media = installMockMediaElement();
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineVideoItemData> = {
      durationMs: 4_000,
      currentTimeMs: 900,
      tracks: [
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [
            {
              id: "clip",
              trackId: "video",
              label: "Clip",
              kind: "video",
              startMs: 1_000,
              durationMs: 1_000,
              data: {
                mediaType: "video",
                sourceStartMs: 400,
                source: { uri: "blob:clip" },
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        transportState={{ status: "paused", playbackRate: 1, loop: false }}
        extensions={[createTimelineVideoExtension()]}
      />,
    );
    const preload = container.querySelector(
      "video[data-slot='timeline-workbench-scene-media-preload'][data-media-type='video']",
    ) as HTMLVideoElement | null;

    expect(container.querySelector("[data-slot='timeline-workbench-scene-video']")).toBeNull();
    expect(preload).toBeTruthy();
    expect(preload?.src).toContain("blob:clip");
    act(() => {
      preload?.dispatchEvent(new Event("canplay"));
    });
    expect(preload?.currentTime).toBe(0.4);
    expect(media.play).not.toHaveBeenCalled();
    media.restore();
  });

  test("active scene video uses auto preload", () => {
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineVideoItemData> = {
      durationMs: 4_000,
      currentTimeMs: 1_250,
      tracks: [
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [
            {
              id: "clip",
              trackId: "video",
              label: "Clip",
              kind: "video",
              startMs: 1_000,
              durationMs: 1_000,
              data: {
                mediaType: "video",
                source: { uri: "blob:clip" },
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        transportState={{ status: "paused", playbackRate: 1, loop: false }}
        extensions={[createTimelineVideoExtension()]}
      />,
    );
    const player = container.querySelector(
      "[data-slot='timeline-workbench-scene-video']",
    ) as HTMLVideoElement | null;

    expect(player).toBeTruthy();
    expect(player?.preload).toBe("auto");
  });

  test("preload collection includes audio and video without duplicates", () => {
    const document: TimelineEditorDocument<
      Record<string, unknown>,
      TimelineAudioItemData | TimelineVideoItemData
    > = {
      durationMs: 5_000,
      currentTimeMs: 900,
      tracks: [
        {
          id: "media",
          label: "Media",
          acceptsItemKinds: ["audio", "video"],
          items: [
            {
              id: "voice",
              trackId: "media",
              label: "Voiceover",
              kind: "audio",
              startMs: 1_000,
              durationMs: 1_000,
              data: {
                mediaType: "audio",
                source: { uri: "blob:voice" },
              },
            },
            {
              id: "clip",
              trackId: "media",
              label: "Clip",
              kind: "video",
              startMs: 1_200,
              durationMs: 1_000,
              data: {
                mediaType: "video",
                source: { uri: "blob:clip" },
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: [], range: { startMs: 1_000, endMs: 2_200 } }}
        transportState={{ status: "paused", playbackRate: 1, loop: true }}
        extensions={
          [createTimelineAudioExtension(), createTimelineVideoExtension()] as Array<
            TimelineEditorExtension<TimelineAudioItemData | TimelineVideoItemData>
          >
        }
      />,
    );
    const preloads = Array.from(
      container.querySelectorAll("[data-slot='timeline-workbench-scene-media-preload']"),
    ) as HTMLMediaElement[];

    expect(preloads).toHaveLength(4);
    expect(preloads.filter((preload) => preload.dataset["mediaType"] === "audio")).toHaveLength(2);
    expect(preloads.filter((preload) => preload.dataset["mediaType"] === "video")).toHaveLength(2);
    expect(new Set(preloads.map((preload) => preload.src)).size).toBe(2);
  });

  test("mixed common and custom preview items compose extension fallback with scene layers", () => {
    const document: TimelineEditorDocument = {
      durationMs: 4_000,
      currentTimeMs: 1_000,
      tracks: [
        {
          id: "scene",
          label: "Scene",
          items: [
            {
              id: "image",
              trackId: "scene",
              label: "Image",
              kind: "image",
              startMs: 0,
              durationMs: 2_000,
              data: {
                mediaType: "image",
                source: { uri: "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==" },
              },
            },
            {
              id: "custom",
              trackId: "scene",
              label: "Custom",
              kind: "custom-preview",
              startMs: 0,
              durationMs: 2_000,
            },
          ],
        },
      ],
    };
    const extensions = [
      {
        id: "custom-preview",
        itemKinds: ["custom-preview"],
        renderPreview: ({ items }) => <div data-slot="custom-preview">{items[0]?.label}</div>,
      },
    ] satisfies Array<TimelineEditorExtension>;

    const { container } = render(<TimelineWorkbench document={document} extensions={extensions} />);

    expect(container.querySelector("[data-slot='timeline-workbench-scene-image']")).toBeTruthy();
    expect(container.querySelector("[data-slot='custom-preview']")?.textContent).toBe("Custom");
  });

  test("renders hidden synchronized audio instead of a native preview player", () => {
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineAudioItemData> = {
      durationMs: 4_000,
      currentTimeMs: 1_000,
      tracks: [
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voiceover",
              kind: "audio",
              startMs: 0,
              durationMs: 3_000,
              data: {
                mediaType: "audio",
                muted: true,
                volume: 0.35,
                source: {
                  label: "voice.wav",
                  uri: "blob:voice",
                  mimeType: "audio/wav",
                },
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: ["voice"], anchorItemId: "voice" }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );
    const player = container.querySelector(
      "[data-slot='timeline-workbench-scene-audio']",
    ) as HTMLAudioElement | null;

    expect(container.querySelector("[data-slot='timeline-media-audio-preview-player']")).toBeNull();
    expect(screen.getAllByText("Voiceover").length).toBeGreaterThan(0);
    expect(player).toBeTruthy();
    expect(player?.src).toContain("blob:voice");
    expect(player?.muted).toBe(true);
    expect(player?.volume).toBe(0.35);
  });

  test("shows a compact audio preview state when the source is not playable", () => {
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineAudioItemData> = {
      durationMs: 4_000,
      currentTimeMs: 1_000,
      tracks: [
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voiceover",
              kind: "audio",
              startMs: 0,
              durationMs: 3_000,
              data: {
                mediaType: "audio",
                source: { label: "voice.wav" },
              },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: ["voice"], anchorItemId: "voice" }}
        extensions={[createTimelineAudioExtension()]}
      />,
    );

    expect(screen.getAllByText("Voiceover").length).toBeGreaterThan(0);
    expect(container.querySelector("[data-slot='timeline-media-audio-preview-player']")).toBeNull();
  });

  test("does not use custom audio preview renderers for known workbench audio scenes", () => {
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineAudioItemData> = {
      durationMs: 4_000,
      currentTimeMs: 1_000,
      tracks: [
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voiceover",
              kind: "audio",
              startMs: 0,
              durationMs: 3_000,
              data: { mediaType: "audio", source: { uri: "blob:voice" } },
            },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: ["voice"], anchorItemId: "voice" }}
        extensions={[
          createTimelineAudioExtension({
            renderPreview: () => <div>Custom audio preview</div>,
          }),
        ]}
      />,
    );

    expect(screen.queryByText("Custom audio preview")).toBeNull();
    expect(container.querySelector("[data-slot='timeline-workbench-scene-audio']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-media-audio-preview-player']")).toBeNull();
  });

  test("creates browser audio assets from files", async () => {
    const file = new File(["audio"], "click.wav", {
      type: "audio/wav",
      lastModified: 12,
    });
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const result = await createTimelineAudioFileAsset(file, {
      createObjectUrl: () => "blob:click",
      durationMs: 750,
      color: "#16a34a",
      waveform: [0.2, 0.8],
    });

    expect(result.objectUrl).toBe("blob:click");
    expect(result.asset).toEqual(
      expect.objectContaining({
        id: "audio-click-wav",
        label: "click.wav",
        kind: "audio",
        mediaType: "audio",
        durationMs: 750,
        color: "#16a34a",
        data: expect.objectContaining({
          mediaType: "audio",
          waveform: [0.2, 0.8],
          source: expect.objectContaining({
            uri: "blob:click",
            label: "click.wav",
            mimeType: "audio/wav",
            metadata: expect.objectContaining({
              fileName: "click.wav",
              lastModified: 12,
              size: 5,
            }),
          }),
        }),
      }),
    );

    result.revoke?.();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:click");
    revokeObjectUrl.mockRestore();
  });

  test("asset insertion preserves audio file asset data", async () => {
    const document: TimelineEditorDocument<Record<string, unknown>, TimelineAudioItemData> = {
      durationMs: 4_000,
      currentTimeMs: 500,
      tracks: [{ id: "audio", label: "Audio", acceptsItemKinds: ["audio"], items: [] }],
    };
    const file = new File(["audio"], "music.mp3", { type: "audio/mpeg" });
    const result = await createTimelineAudioFileAsset(file, {
      createObjectUrl: () => "blob:music",
      durationMs: 1_200,
    });
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        assets={[result.asset]}
        extensions={[createTimelineAudioExtension()]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "music.mp3" })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            id: "audio",
            items: [
              expect.objectContaining({
                kind: "audio",
                data: expect.objectContaining({
                  mediaType: "audio",
                  source: expect.objectContaining({
                    uri: "blob:music",
                    label: "music.mp3",
                    mimeType: "audio/mpeg",
                  }),
                }),
              }),
            ],
          }),
        ],
      }),
    );
  });

  test("passes exact item kind and normalized media type to workbench context menus", async () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "subtitles",
          label: "Subtitles",
          acceptsItemKinds: ["subtitle"],
          items: [
            {
              id: "line",
              trackId: "subtitles",
              label: "Line",
              kind: "subtitle",
              startMs: 1_000,
              durationMs: 1_000,
              data: { mediaType: "text" },
            },
          ],
        },
      ],
    };
    const handleContext = vi.fn();

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selectedItemId="line"
        getItemContextMenuItems={(context) => {
          handleContext(context.itemKind, context.mediaType);

          return [{ id: "edit-subtitle", label: "Edit Subtitle" }];
        }}
      />,
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-clip']")!);

    expect(await screen.findByRole("menuitem", { name: "Edit Subtitle" })).toBeTruthy();
    expect(handleContext).toHaveBeenCalledWith("subtitle", "text");
  });

  test("resolves workbench extensions by exact item kind before media type", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "subtitles",
          label: "Subtitles",
          acceptsItemKinds: ["subtitle"],
          items: [
            {
              id: "line",
              trackId: "subtitles",
              label: "Line",
              kind: "subtitle",
              startMs: 0,
              durationMs: 1_000,
              data: { mediaType: "text" },
            },
          ],
        },
      ],
    };

    render(
      <TimelineWorkbench
        document={document}
        extensions={[
          {
            id: "text-media",
            mediaTypes: ["text"],
            renderItem: () => <span>Media renderer</span>,
          },
          {
            id: "subtitle",
            itemKinds: ["subtitle"],
            renderItem: () => <span>Exact renderer</span>,
          },
        ]}
      />,
    );

    expect(screen.getByText("Exact renderer")).toBeTruthy();
    expect(screen.queryByText("Media renderer")).toBeNull();
  });

  test("resolves workbench extensions by normalized media type as a fallback", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "transcript",
          label: "Transcript",
          acceptsItemKinds: ["transcript"],
          items: [
            {
              id: "line",
              trackId: "transcript",
              label: "Line",
              kind: "transcript",
              startMs: 0,
              durationMs: 1_000,
              data: { mediaType: "text" },
            },
          ],
        },
      ],
    };

    render(
      <TimelineWorkbench
        document={document}
        extensions={[
          {
            id: "text-media",
            mediaTypes: ["text"],
            renderItem: () => <span>Media fallback</span>,
          },
        ]}
      />,
    );

    expect(screen.getByText("Media fallback")).toBeTruthy();
  });

  test("asset insertion preserves media data and asset media type metadata", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [{ id: "clips", label: "Clips", acceptsItemKinds: ["clip"], items: [] }],
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        assets={[
          {
            id: "b-roll",
            label: "B-roll",
            kind: "clip",
            mediaType: "video",
            durationMs: 1_000,
          },
        ]}
        createItemId={() => "b-roll-item"}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /B-roll/ })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            id: "clips",
            items: [
              expect.objectContaining({
                id: "b-roll-item",
                kind: "clip",
                data: { mediaType: "video" },
              }),
            ],
          }),
        ],
      }),
    );
  });

  test("extends timeline item context menus by media kind", async () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [
            {
              id: "scene",
              trackId: "video",
              label: "Scene",
              kind: "video",
              startMs: 1_000,
              durationMs: 1_000,
            },
          ],
        },
      ],
    };
    const handleCustomAction = vi.fn();

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selectedItemId="scene"
        getItemContextMenuItems={(context) =>
          context.mediaType === "video"
            ? [
                {
                  id: "transcode-video",
                  label: "Transcode video",
                  onSelect: () => handleCustomAction(context.item.id),
                },
              ]
            : []
        }
      />,
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-clip']")!);
    fireEvent.click(await screen.findByText("Transcode video"));

    expect(handleCustomAction).toHaveBeenCalledWith("scene");
  });

  test("opens timeline context menus from empty lanes with clicked timeline context", async () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 500 },
          ],
        },
      ],
    };
    const handleTimelineAction = vi.fn();

    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={{ pixelsPerSecond: 80 }}
        snap={{ enabled: true, thresholdPx: 8, targets: [{ type: "interval", intervalMs: 100 }] }}
        getTimelineContextMenuItems={(context) => [
          {
            id: "inspect-time",
            label: "Inspect time",
            onSelect: () => handleTimelineAction(context),
          },
        ]}
      />,
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-track-lane']")!, {
      clientX: 164,
      clientY: 24,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Inspect time" }));

    expect(handleTimelineAction).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "track-lane",
        timeMs: 250,
        snappedTimeMs: 200,
        snapped: true,
        track: expect.objectContaining({ id: "planning" }),
        selection: { itemIds: ["brief"], anchorItemId: "brief" },
        selectedItems: [expect.objectContaining({ id: "brief" })],
        clientX: 164,
        clientY: 24,
      }),
    );
  });

  test("opens timeline context menus from the ruler without a track", async () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [{ id: "planning", label: "Planning", items: [] }],
    };
    const handleTimelineAction = vi.fn();

    const { container } = render(
      <TimelineEditor
        document={document}
        viewport={{ pixelsPerSecond: 80 }}
        getTimelineContextMenuItems={(context) => [
          {
            id: "inspect-ruler",
            label: "Inspect ruler",
            onSelect: () => handleTimelineAction(context),
          },
        ]}
      />,
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-ruler-lane']")!, {
      clientX: 240,
      clientY: 12,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Inspect ruler" }));

    expect(handleTimelineAction).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "ruler",
        timeMs: 1_200,
        track: undefined,
      }),
    );
  });

  test("keeps clip context menus separate from timeline context menus", async () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 500 },
          ],
        },
      ],
    };

    const { container } = render(
      <TimelineEditor
        document={document}
        getItemContextMenuItems={() => [{ id: "item-action", label: "Item action" }]}
        getTimelineContextMenuItems={() => [{ id: "timeline-action", label: "Timeline action" }]}
      />,
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-clip']")!);

    expect(await screen.findByRole("menuitem", { name: "Item action" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Timeline action" })).toBeNull();
  });

  test("does not render an empty timeline context menu", () => {
    const timelineDocument: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [{ id: "planning", label: "Planning", items: [] }],
    };

    const { container } = render(
      <TimelineEditor document={timelineDocument} getTimelineContextMenuItems={() => []} />,
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-track-lane']")!);

    expect(document.body.querySelector("[data-slot='context-action-menu-empty']")).toBeNull();
  });

  test("combines workbench timeline context menu items and extension items", async () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [{ id: "planning", label: "Planning", items: [] }],
    };
    const extensionAction = vi.fn();
    const extensions = [
      {
        id: "timeline-extension",
        timelineContextMenuItems: (context) => [
          {
            id: "extension-time",
            label: "Extension time",
            onSelect: () => extensionAction(context.snappedTimeMs),
          },
        ],
      },
    ] satisfies Array<TimelineEditorExtension>;

    const { container } = render(
      <TimelineWorkbench
        document={document}
        extensions={extensions}
        getTimelineContextMenuItems={() => [{ id: "consumer-time", label: "Consumer time" }]}
      />,
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-track-lane']")!, {
      clientX: 160,
    });

    expect(await screen.findByRole("menuitem", { name: "Consumer time" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Extension time" }));
    expect(extensionAction).toHaveBeenCalledWith(200);
  });

  test("workbench timeline context menu helpers set time and add markers", async () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 0,
      tracks: [{ id: "planning", label: "Planning", items: [] }],
    };
    const handleDocumentChange = vi.fn();

    const { container } = render(
      <TimelineWorkbench
        document={document}
        onDocumentChange={handleDocumentChange}
        getTimelineContextMenuItems={(context) => [
          {
            id: "set-current",
            label: "Set current",
            onSelect: () => context.setCurrentTime(),
          },
          {
            id: "add-marker",
            label: "Add marker",
            onSelect: () => context.addMarker(),
          },
        ]}
      />,
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-track-lane']")!, {
      clientX: 160,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Set current" }));
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({ currentTimeMs: 200 }),
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-track-lane']")!, {
      clientX: 240,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add marker" }));
    expect(handleDocumentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        markers: [expect.objectContaining({ timeMs: 1_200, label: "0:01.2" })],
      }),
    );
  });

  test("runs workbench item commands from the context menu", async () => {
    let document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [
            {
              id: "scene",
              trackId: "video",
              label: "Scene",
              kind: "video",
              startMs: 1_000,
              durationMs: 1_000,
            },
            {
              id: "overlay",
              trackId: "video",
              label: "Overlay",
              kind: "video",
              startMs: 3_000,
              durationMs: 1_000,
            },
          ],
        },
      ],
    };
    const selection = { itemIds: ["scene", "overlay"], anchorItemId: "scene" };
    const handleDocumentChange = vi.fn((nextDocument: TimelineEditorDocument) => {
      document = nextDocument;
    });
    const renderWorkbench = () => (
      <TimelineWorkbench
        document={document}
        selection={selection}
        onDocumentChange={handleDocumentChange}
      />
    );

    const { container, rerender } = render(renderWorkbench());

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-clip']")!);

    expect(await screen.findByRole("menuitem", { name: "Split at playhead" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeTruthy();

    fireEvent.click(screen.getByRole("menuitem", { name: "Group" }));

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        itemGroups: [expect.objectContaining({ itemIds: ["scene", "overlay"] })],
      }),
    );

    rerender(renderWorkbench());
    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-clip']")!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ungroup" }));

    expect(handleDocumentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        itemGroups: undefined,
        tracks: [
          expect.objectContaining({
            items: [
              expect.objectContaining({ id: "scene", itemGroupId: undefined }),
              expect.objectContaining({ id: "overlay", itemGroupId: undefined }),
            ],
          }),
        ],
      }),
    );
  });
});
