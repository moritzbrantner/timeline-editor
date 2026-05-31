import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  TimelineEditorClip,
  TimelineEditorContent,
  TimelineEditorLiveRegion,
  TimelineEditorProvider,
  TimelineEditorRoot,
  TimelineEditorRuler,
  TimelineEditorSnapFeedback,
  TimelineEditorSnapGuide,
  TimelineEditorTracks,
  useTimelineEditor,
  type TimelineEditorDocument,
  type TimelineEditorTrack,
} from "@moritzbrantner/timeline-editor";

const document: TimelineEditorDocument = {
  durationMs: 6_000,
  currentTimeMs: 1_500,
  groups: [{ id: "program", label: "Program", trackIds: ["planning", "review"] }],
  markers: [{ id: "handoff", label: "Handoff", timeMs: 4_000 }],
  tracks: [
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
  ] satisfies TimelineEditorTrack[],
};

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

function TimelineEditorPartsHarness() {
  return (
    <TimelineEditorProvider
      document={document}
      selection={{
        itemIds: ["brief"],
        anchorItemId: "brief",
        range: { startMs: 500, endMs: 2_500 },
        trackIds: ["planning"],
      }}
      viewport={{ pixelsPerSecond: 100 }}
    >
      <TimelineEditorRoot>
        <TimelineEditorContent>
          <TimelineEditorRuler />
          <TimelineEditorTracks />
          <TimelineEditorLiveRegion data-testid="selection-live-region" />
        </TimelineEditorContent>
      </TimelineEditorRoot>
    </TimelineEditorProvider>
  );
}

function SnapFeedbackHarness() {
  const editor = useTimelineEditor();

  useEffect(() => {
    editor.schedulePreviewUpdate(null, 2_000);
  }, [editor]);

  return (
    <>
      <TimelineEditorSnapGuide />
      <TimelineEditorSnapFeedback />
    </>
  );
}

describe("timeline editor component parts", () => {
  test("renders the exported timeline editor building blocks through the provider", () => {
    const { container } = render(<TimelineEditorPartsHarness />);

    expect(container.querySelector("[data-slot='timeline-editor']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-editor-ruler']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-editor-playhead']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-editor-tracks']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-editor-track-group']")?.textContent).toBe(
      "Program",
    );
    expect(container.querySelector("[data-slot='timeline-editor-track-header']")?.textContent).toBe(
      "Planning",
    );
    expect(container.querySelector("[data-slot='timeline-editor-track-lane']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-editor-track-tick']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-editor-range-overlay']")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Brief" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("selection-live-region").textContent).toBe(
      "1 timeline items selected",
    );
  });

  test("renders a standalone clip and forwards clip interactions", () => {
    const handleContextMenu = vi.fn();
    const handleMovePointerDown = vi.fn();
    const handleResizePointerDown = vi.fn();

    render(
      <TimelineEditorClip
        item={document.tracks[0]!.items[0]!}
        selected
        durationMs={6_000}
        timelineWidthPx={600}
        onContextMenu={handleContextMenu}
        onMovePointerDown={handleMovePointerDown}
        onResizePointerDown={handleResizePointerDown}
      />,
    );

    const clip = screen.getByRole("button", { name: "Brief" });
    fireEvent.contextMenu(clip);
    fireEvent.pointerDown(clip);

    expect(clip.getAttribute("aria-pressed")).toBe("true");
    expect(handleContextMenu).toHaveBeenCalledOnce();
    expect(handleMovePointerDown).toHaveBeenCalledOnce();

    handleMovePointerDown.mockClear();
    fireEvent.pointerDown(clip.querySelector("[data-slot='timeline-editor-resize-end']")!);

    expect(handleResizePointerDown).toHaveBeenCalledWith("end", expect.any(Object));
  });

  test("renders snap guide and feedback after a scheduled preview update", async () => {
    const { container } = render(
      <TimelineEditorProvider document={document} viewport={{ pixelsPerSecond: 100 }}>
        <SnapFeedbackHarness />
      </TimelineEditorProvider>,
    );

    await waitFor(() => {
      expect(container.querySelector("[data-slot='timeline-editor-snap-guide']")).toBeTruthy();
      expect(container.querySelector("[data-slot='timeline-editor-snap-feedback']")).toBeTruthy();
      expect(
        container.querySelector("[data-slot='timeline-editor-snap-feedback-label']")?.textContent,
      ).toBe("0:02.0");
    });
  });
});
