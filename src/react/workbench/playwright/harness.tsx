import "@moritzbrantner/ui/styles.css";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ActionMenu, Button } from "@moritzbrantner/ui";

import {
  TimelineEditor,
  TimelineWorkbench,
  type TimelineEditorDocument,
  type TimelineEditorEditPolicy,
  type TimelineEditorSelection,
  type TimelineEditorTrack,
  type TimelineWorkbenchAsset,
  type TimelineWorkbenchImportSource,
  type TimelineWorkbenchSelection,
} from "@moritzbrantner/timeline-editor";

type HarnessState = {
  changes: string[];
  document: TimelineEditorDocument;
  frameRate?: number;
  imports: Array<{
    fileName?: string;
    label?: string;
    size?: number;
    type: string;
    mimeType?: string;
  }>;
  range?: TimelineEditorSelection["range"];
  selectedItemId: string | null;
  selectedItemIds: string[];
};

declare global {
  interface Window {
    __timelineEditorHarness: HarnessState;
  }
}

const createDocument = (): TimelineEditorDocument => ({
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
  durationMs: 8_000,
  currentTimeMs: 1_000,
  markers: [{ id: "handoff", timeMs: 4_000, label: "Handoff" }],
});

const createOverlapPreventDocument = (): TimelineEditorDocument => ({
  tracks: [
    {
      id: "planning",
      label: "Planning",
      acceptsItemKinds: ["task", "review"],
      items: [
        {
          id: "first",
          trackId: "planning",
          label: "First",
          kind: "task",
          startMs: 1_000,
          durationMs: 2_000,
          color: "#2563eb",
        },
        {
          id: "second",
          trackId: "planning",
          label: "Second",
          kind: "task",
          startMs: 3_500,
          durationMs: 1_500,
          color: "#16a34a",
        },
      ],
    },
  ] satisfies TimelineEditorTrack[],
  durationMs: 8_000,
  currentTimeMs: 1_000,
  markers: [{ id: "handoff", timeMs: 4_000, label: "Handoff" }],
});

const createNoActiveItemsDocument = (): TimelineEditorDocument => ({
  ...createDocument(),
  currentTimeMs: 7_500,
});

const createLargeDocument = (): TimelineEditorDocument => ({
  durationMs: 10 * 60_000,
  currentTimeMs: 0,
  tracks: Array.from({ length: 200 }, (_, trackIndex) => ({
    id: `track-${trackIndex + 1}`,
    label: `Track ${trackIndex + 1}`,
    items: Array.from({ length: 100 }, (_, itemIndex) => ({
      id: `track-${trackIndex + 1}-item-${itemIndex + 1}`,
      trackId: `track-${trackIndex + 1}`,
      label: `Item ${trackIndex + 1}-${itemIndex + 1}`,
      startMs: itemIndex * 5_000,
      durationMs: 1_000,
      color: itemIndex % 2 === 0 ? "#2563eb" : "#16a34a",
    })),
  })),
});

const timelineAssets = [
  {
    id: "prototype",
    label: "Prototype",
    kind: "review",
    durationMs: 1_000,
    color: "#16a34a",
    description: "Review pass",
  },
  {
    id: "handoff-task",
    label: "Handoff task",
    kind: "task",
    durationMs: 1_500,
    color: "#9333ea",
    description: "Planning task",
  },
] satisfies TimelineWorkbenchAsset[];

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const readOnly = searchParams.get("readOnly") === "true";
  const fixture = searchParams.get("fixture") ?? "basic";
  const largeFixture = fixture === "large";
  const timelineMenuFixture = searchParams.get("timelineMenu") === "true";
  const importAssetsFixture = searchParams.get("importAssets") === "true";
  const assetActionsFixture = searchParams.get("assetActions") === "true";
  const emptyAssetsFixture = searchParams.get("assets") === "none";
  const editPolicy: Partial<TimelineEditorEditPolicy> | undefined =
    searchParams.get("editPolicy") === "prevent"
      ? { overlap: "prevent", ripple: false }
      : undefined;
  const frameRateParam = searchParams.get("frameRate");
  const initialFrameRate = frameRateParam ? Number(frameRateParam) : undefined;
  const [frameRate, setFrameRate] = useState<number | undefined>(initialFrameRate);
  const [document, setDocument] = useState(() => createFixtureDocument(fixture));
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const changes = useRef<string[]>([]);
  const imports = useRef<HarnessState["imports"]>([]);

  useEffect(() => {
    window["__timelineEditorHarness"] = {
      changes: changes.current,
      document,
      frameRate,
      imports: imports.current,
      range: selection.range,
      selectedItemId: selection.itemIds[0] ?? null,
      selectedItemIds: selection.itemIds,
    };
  }, [document, frameRate, selection]);

  const recordChange = (change: string) => {
    const nextChanges = [...changes.current, change];
    changes.current = nextChanges;

    if (window["__timelineEditorHarness"]) {
      window["__timelineEditorHarness"].changes = nextChanges;
    }
  };

  const handleDocumentChange = (nextDocument: TimelineEditorDocument) => {
    recordChange("document");
    setDocument(nextDocument);
  };

  const handleCurrentTimeChange = (timeMs: number) => {
    recordChange(`current-time:${timeMs}`);
  };

  const handleSelectionChange = (nextSelection: TimelineEditorSelection) => {
    recordChange(`selection:${nextSelection.itemIds.join(",")}`);
    setSelection(nextSelection);
  };

  const handleSelectedItemChange = (selection: TimelineWorkbenchSelection) => {
    recordChange(`selected:${selection.itemId ?? ""}`);
  };

  const handleImportAssets = (sources: TimelineWorkbenchImportSource[]) => {
    const nextImports = sources.map((source) => ({
      type: source.type,
      label: source.label,
      fileName: source.file?.name,
      size: source.file?.size,
      mimeType: source.file?.type,
    }));
    imports.current = [...imports.current, ...nextImports];

    if (window["__timelineEditorHarness"]) {
      window["__timelineEditorHarness"].imports = imports.current;
    }

    recordChange(
      `import:${nextImports.map((source) => source.fileName ?? source.label).join(",")}`,
    );

    return sources.map((source) => {
      const label = source.label ?? source.file?.name ?? "Imported asset";

      return {
        asset: {
          id: `imported-${label
            .toLowerCase()
            .replaceAll(/[^a-z0-9]+/g, "-")
            .replaceAll(/^-|-$/g, "")}`,
          label,
          kind: "task",
          mediaType: "video",
          durationMs: 750,
          color: "#f59e0b",
          description: "Imported file",
          data: {
            fileName: source.file?.name,
            imported: true,
            mediaType: "video",
          },
        } satisfies TimelineWorkbenchAsset,
      };
    });
  };

  if (largeFixture) {
    return (
      <div className="p-4">
        <TimelineEditor
          className="h-[360px]"
          document={document}
          selection={selection}
          readOnly={readOnly}
          editPolicy={editPolicy}
          viewport={{ pixelsPerSecond: 80 }}
          virtualization={{ rows: true, rowOverscanPx: 80 }}
          onDocumentChange={handleDocumentChange}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    );
  }

  return (
    <TimelineWorkbench
      document={document}
      selection={selection}
      readOnly={readOnly}
      editPolicy={editPolicy}
      pixelsPerSecond={80}
      frameRate={frameRate}
      snapMs={100}
      assets={emptyAssetsFixture ? [] : timelineAssets}
      acceptedImportTypes={["video/*"]}
      showAssetsPanel={searchParams.get("showAssetsPanel") !== "false"}
      showPreviewPanel={searchParams.get("showPreviewPanel") !== "false"}
      showInspectorPanel={searchParams.get("showInspectorPanel") !== "false"}
      onImportAssets={importAssetsFixture ? handleImportAssets : undefined}
      onDocumentChange={handleDocumentChange}
      onCurrentTimeChange={handleCurrentTimeChange}
      onSelectionChange={handleSelectionChange}
      onSelectedItemChange={handleSelectedItemChange}
      onSnapChange={(nextSnap) => recordChange(`snap:${JSON.stringify(nextSnap)}`)}
      getTimelineContextMenuItems={
        timelineMenuFixture
          ? (context) => [
              {
                id: "record-timeline-time",
                label: "Record timeline time",
                onSelect: () =>
                  recordChange(`timeline-menu:${context.snappedTimeMs}:${context.track?.id ?? ""}`),
              },
              {
                id: "frame-rate",
                type: "radio-group",
                label: "Frame rate",
                value: String(frameRate ?? ""),
                options: [24, 25, 30, 50, 60].map((fps) => ({
                  id: `fps-${fps}`,
                  value: String(fps),
                  label: `${fps} fps`,
                })),
                onValueChange: (value) => {
                  const nextFrameRate = Number(value);
                  setFrameRate(nextFrameRate);
                  recordChange(`frame-rate:${nextFrameRate}`);
                },
              },
            ]
          : undefined
      }
      renderAsset={(asset) =>
        assetActionsFixture ? (
          <div className="flex w-full items-center justify-between gap-2">
            <div className="min-w-0">
              <div>{asset.label}</div>
              <div className="text-xs text-muted-foreground">{asset.description}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Delete ${asset.label}`}
                data-timeline-workbench-asset-action=""
                onClick={() => recordChange(`asset-action:delete:${asset.id}`)}
              >
                Delete
              </Button>
              <ActionMenu
                label={`${asset.label} actions`}
                trigger={
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`${asset.label} menu`}
                    data-timeline-workbench-asset-action=""
                  >
                    More
                  </Button>
                }
                items={[
                  {
                    id: `delete-${asset.id}`,
                    label: `Delete ${asset.label} from menu`,
                    onSelect: () => recordChange(`asset-action:delete-menu:${asset.id}`),
                  },
                ]}
              />
            </div>
          </div>
        ) : (
          <div>
            <div>{asset.label}</div>
            <div className="text-xs text-muted-foreground">{asset.description}</div>
          </div>
        )
      }
    />
  );
}

function createFixtureDocument(fixture: string): TimelineEditorDocument {
  if (fixture === "large") {
    return createLargeDocument();
  }

  if (fixture === "overlap-prevent") {
    return createOverlapPreventDocument();
  }

  if (fixture === "no-active") {
    return createNoActiveItemsDocument();
  }

  return createDocument();
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(<App />);
