import "@moritzbrantner/ui/styles.css";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  TimelineEditor,
  TimelineWorkbench,
  type TimelineEditorDocument,
  type TimelineEditorSelection,
  type TimelineEditorTrack,
  type TimelineWorkbenchAsset,
  type TimelineWorkbenchSelection,
} from "@moritzbrantner/timeline-editor";

type HarnessState = {
  changes: string[];
  document: TimelineEditorDocument;
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
  const largeFixture = searchParams.get("fixture") === "large";
  const frameRateParam = searchParams.get("frameRate");
  const frameRate = frameRateParam ? Number(frameRateParam) : undefined;
  const [document, setDocument] = useState(() =>
    largeFixture ? createLargeDocument() : createDocument(),
  );
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const changes = useRef<string[]>([]);

  useEffect(() => {
    window["__timelineEditorHarness"] = {
      changes: changes.current,
      document,
      selectedItemId: selection.itemIds[0] ?? null,
      selectedItemIds: selection.itemIds,
    };
  }, [document, selection]);

  const recordChange = (change: string) => {
    changes.current = [...changes.current, change];
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

  if (largeFixture) {
    return (
      <div className="p-4">
        <TimelineEditor
          className="h-[360px]"
          document={document}
          selection={selection}
          readOnly={readOnly}
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
      pixelsPerSecond={80}
      frameRate={frameRate}
      snapMs={100}
      assets={timelineAssets}
      onDocumentChange={handleDocumentChange}
      onCurrentTimeChange={handleCurrentTimeChange}
      onSelectionChange={handleSelectionChange}
      onSelectedItemChange={handleSelectedItemChange}
      renderAsset={(asset) => (
        <div>
          <div>{asset.label}</div>
          <div className="text-xs text-muted-foreground">{asset.description}</div>
        </div>
      )}
    />
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(<App />);
