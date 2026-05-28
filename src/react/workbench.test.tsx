import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  TimelineWorkbench,
  normalizeTimelineEditorTracks,
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
  TimelineEditor,
  type TimelineEditorDocument,
  type TimelineEditorExtension,
  type TimelineEditorTrack,
} from "@moritzbrantner/timeline-editor";
import {
  createTimelineAudioExtension,
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

describe("@moritzbrantner/timeline-editor React workbench", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Marker" }));
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
