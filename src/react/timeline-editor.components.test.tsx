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
    expect(
      container.querySelector("[data-slot='timeline-editor-track-header-label']")?.textContent,
    ).toBe("Planning");
    expect(container.querySelector("[data-slot='timeline-editor-track-lane']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-editor-track-tick']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-editor-range-overlay']")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Brief/ }).getAttribute("aria-pressed")).toBe("true");
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

    const clip = screen.getByRole("button", { name: /Brief/ });
    fireEvent.contextMenu(clip);
    fireEvent.pointerDown(clip);

    expect(clip.getAttribute("aria-pressed")).toBe("true");
    expect(clip.getAttribute("data-selected")).toBe("true");
    expect(clip.getAttribute("data-kind")).toBe("task");
    expect(clip.getAttribute("data-density")).toBe("full");
    expect(clip.querySelector("[data-slot='timeline-editor-clip-meta']")?.textContent).toContain(
      "task",
    );
    expect(handleContextMenu).toHaveBeenCalledOnce();
    expect(handleMovePointerDown).toHaveBeenCalledOnce();

    handleMovePointerDown.mockClear();
    fireEvent.pointerDown(clip.querySelector("[data-slot='timeline-editor-resize-end']")!);

    expect(handleResizePointerDown).toHaveBeenCalledWith("end", expect.any(Object));
  });

  test("renders default clip content by density", () => {
    const item = document.tracks[0]!.items[0]!;
    const { container } = render(
      <div>
        <TimelineEditorClip item={item} durationMs={6_000} timelineWidthPx={120} />
        <TimelineEditorClip
          item={{ ...item, id: "compact", startMs: 0, durationMs: 1_000 }}
          durationMs={6_000}
          timelineWidthPx={600}
        />
        <TimelineEditorClip
          item={{ ...item, id: "full" }}
          durationMs={6_000}
          timelineWidthPx={600}
        />
      </div>,
    );
    const clips = container.querySelectorAll("[data-slot='timeline-editor-clip']");

    expect(clips[0]?.getAttribute("data-density")).toBe("minimal");
    expect(clips[0]?.querySelector("[data-slot='timeline-editor-clip-identity']")).toBeTruthy();
    expect(clips[0]?.querySelector("[data-slot='timeline-editor-clip-meta']")).toBeFalsy();
    expect(clips[1]?.getAttribute("data-density")).toBe("compact");
    expect(clips[1]?.querySelector("[data-slot='timeline-editor-clip-label']")?.textContent).toBe(
      "Brief",
    );
    expect(clips[2]?.getAttribute("data-density")).toBe("full");
    expect(clips[2]?.querySelector("[data-slot='timeline-editor-clip-meta']")).toBeTruthy();
  });

  test("surfaces generic clip state badges and data hooks", () => {
    const item = {
      ...document.tracks[0]!.items[0]!,
      itemGroupId: "group-a",
      locked: true,
      transform: {
        points: [
          { offsetMs: 0, values: { opacity: 1 } },
          { offsetMs: 2_000, values: { opacity: 0.5 } },
        ],
      },
    };

    const { container } = render(
      <TimelineEditorClip item={item} durationMs={6_000} timelineWidthPx={600} />,
    );
    const clip = container.querySelector("[data-slot='timeline-editor-clip']")!;

    expect(clip.getAttribute("data-locked")).toBe("true");
    expect(clip.getAttribute("data-grouped")).toBe("true");
    expect(clip.getAttribute("data-has-transform")).toBe("true");
    expect(clip.getAttribute("data-transform-point-count")).toBe("2");
    expect(clip.textContent).toContain("2 keyframes");
    expect(clip.textContent).toContain("Grouped");
    expect(clip.textContent).toContain("Locked");
  });

  test("renders default track header metadata and locked state", () => {
    const lockedDocument: TimelineEditorDocument = {
      ...document,
      tracks: [
        {
          ...document.tracks[0]!,
          locked: true,
        },
      ],
      groups: undefined,
    };
    const { container } = render(
      <TimelineEditorProvider document={lockedDocument}>
        <TimelineEditorTracks />
      </TimelineEditorProvider>,
    );
    const header = container.querySelector("[data-slot='timeline-editor-track-header']")!;

    expect(header.getAttribute("data-locked")).toBe("true");
    expect(header.getAttribute("data-item-count")).toBe("1");
    expect(header.getAttribute("data-accepts-item-kinds")).toBe("task review");
    expect(
      header.querySelector("[data-slot='timeline-editor-track-header-label']")?.textContent,
    ).toBe("Planning");
    expect(
      header.querySelector("[data-slot='timeline-editor-track-header-meta']")?.textContent,
    ).toBe("1 item");
    expect(
      header.querySelector("[data-slot='timeline-editor-track-header-kinds']")?.textContent,
    ).toBe("task, review");
    expect(
      header.querySelector("[data-slot='timeline-editor-track-header-lock']")?.textContent,
    ).toBe("Locked");
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
