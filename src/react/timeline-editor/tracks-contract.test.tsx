import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import {
  TimelineEditor,
  type TimelineEditorDocument,
  type TimelineEditorItemRenderContext,
} from "@moritzbrantner/timeline-editor";

import { createTimelineEditorDocumentIndex } from "../../document-index";

// Count document index builds without changing what they return.
vi.mock("../../document-index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../document-index")>();

  return {
    ...actual,
    createTimelineEditorDocumentIndex: vi.fn(actual.createTimelineEditorDocumentIndex),
  };
});

const indexBuilds = vi.mocked(createTimelineEditorDocumentIndex);

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

beforeEach(() => {
  indexBuilds.mockClear();
});

function createDocument(): TimelineEditorDocument {
  return {
    durationMs: 8_000,
    currentTimeMs: 0,
    tracks: [
      {
        id: "planning",
        label: "Planning",
        items: [
          { id: "brief", trackId: "planning", label: "Brief", startMs: 0, durationMs: 1_000 },
          { id: "draft", trackId: "planning", label: "Draft", startMs: 2_000, durationMs: 1_000 },
        ],
      },
      {
        id: "review",
        label: "Review",
        items: [{ id: "notes", trackId: "review", label: "Notes", startMs: 0, durationMs: 1_000 }],
      },
    ],
  };
}

const renderedItemIds: string[] = [];

// Module-level so its identity is stable, as a host's memoized renderer would be.
function renderItem({ item }: TimelineEditorItemRenderContext<Record<string, unknown>>) {
  renderedItemIds.push(item.id);
  return <span>{item.label}</span>;
}

const viewport = { pixelsPerSecond: 100 };

describe("timeline editor tracks snapshot contract", () => {
  test("playhead-only changes neither rebuild the document index nor re-render clips", () => {
    const document = createDocument();
    const selection = { itemIds: ["brief"], anchorItemId: "brief" };
    const { rerender } = render(
      <TimelineEditor
        document={document}
        selection={selection}
        viewport={viewport}
        renderItem={renderItem}
      />,
    );
    renderedItemIds.length = 0;
    indexBuilds.mockClear();

    for (const currentTimeMs of [250, 500, 750]) {
      rerender(
        <TimelineEditor
          document={{ ...document, currentTimeMs }}
          // A new, equal selection object each render must not invalidate clips either.
          selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
          viewport={viewport}
          renderItem={renderItem}
        />,
      );
    }

    expect(indexBuilds).not.toHaveBeenCalled();
    expect(renderedItemIds).toEqual([]);
  });

  test("replacing tracks rebuilds lookups and re-renders the affected clips", () => {
    const document = createDocument();
    const { rerender } = render(
      <TimelineEditor document={document} viewport={viewport} renderItem={renderItem} />,
    );
    renderedItemIds.length = 0;
    indexBuilds.mockClear();

    const [track, untouchedTrack] = document.tracks;
    const nextDocument: TimelineEditorDocument = {
      ...document,
      tracks: [
        {
          ...track!,
          items: [{ ...track!.items[0]!, label: "Brief v2" }, track!.items[1]!],
        },
        untouchedTrack!,
      ],
    };
    rerender(
      <TimelineEditor document={nextDocument} viewport={viewport} renderItem={renderItem} />,
    );

    expect(indexBuilds).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Brief v2").length).toBeGreaterThan(0);
    // Clips of the replaced track re-render; clips of the untouched track snapshot do not.
    expect(renderedItemIds.sort()).toEqual(["brief", "draft"]);
  });

  test("selection changes re-render clips with the new selected state", () => {
    const document = createDocument();
    const { container, rerender } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief"] }}
        viewport={viewport}
        renderItem={renderItem}
      />,
    );

    rerender(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["draft"] }}
        viewport={viewport}
        renderItem={renderItem}
      />,
    );

    const selectedClips = [
      ...container.querySelectorAll("[data-slot='timeline-editor-clip'][data-selected='true']"),
    ];
    expect(selectedClips.map((clip) => clip.textContent)).toEqual(["DraftDraft"]);
  });

  test("builds item menus when opened from the latest document and selection", async () => {
    const document = createDocument();
    const getItemContextMenuItems = vi.fn(
      ({ document: menuDocument, item, selected, selection }) => [
        {
          id: "describe",
          label: `${item.label} at ${menuDocument.currentTimeMs} (${selection.itemIds.join(",")}, ${selected ? "selected" : "unselected"})`,
        },
      ],
    );
    const onSelectionChange = vi.fn();
    const { container, rerender } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={viewport}
        getItemContextMenuItems={getItemContextMenuItems}
        onSelectionChange={onSelectionChange}
      />,
    );
    rerender(
      <TimelineEditor
        document={{ ...document, currentTimeMs: 1_500 }}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={viewport}
        getItemContextMenuItems={getItemContextMenuItems}
        onSelectionChange={onSelectionChange}
      />,
    );

    // Nothing is built while rendering or scrubbing.
    expect(getItemContextMenuItems).not.toHaveBeenCalled();

    const draftClip = [...container.querySelectorAll("[data-slot='timeline-editor-clip']")].find(
      (clip) => clip.textContent?.includes("Draft"),
    )!;
    fireEvent.contextMenu(draftClip);

    // Opening the menu on an unselected clip selects it, and the menu describes that selection.
    expect(onSelectionChange).toHaveBeenCalledWith({ itemIds: ["draft"], anchorItemId: "draft" });
    expect(
      await screen.findByRole("menuitem", { name: "Draft at 1500 (draft, selected)" }),
    ).toBeTruthy();
    expect(getItemContextMenuItems).toHaveBeenCalledTimes(1);
  });

  test("in-place tracks mutation is unsupported: lookups stay stale until tracks are replaced", () => {
    const document = createDocument();
    const getItemContextMenuItems = vi.fn(({ selectedItems }) => [
      {
        id: "selected-labels",
        label: selectedItems.map((item: { label: string }) => item.label).join(","),
      },
    ]);
    const { container, rerender } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={viewport}
        getItemContextMenuItems={getItemContextMenuItems}
      />,
    );

    // Unsupported: mutate the same tracks array in place and pass a new document object.
    document.tracks[0]!.items[0] = { ...document.tracks[0]!.items[0]!, label: "Mutated" };
    rerender(
      <TimelineEditor
        document={{ ...document }}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={viewport}
        getItemContextMenuItems={getItemContextMenuItems}
      />,
    );
    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-clip']")!);

    // The index is keyed on `document.tracks`, so the selected item is the stale snapshot.
    expect(getItemContextMenuItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedItems: [expect.objectContaining({ label: "Brief" })] }),
    );
  });
});
