import "@moritzbrantner/ui/styles.css";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  TimelineWorkbench,
  type TimelineEditorDocument,
  type TimelineEditorTrack,
  type TimelineWorkbenchSelection,
} from "@moritzbrantner/timeline-editor";

type HarnessState = {
  changes: string[];
  document: TimelineEditorDocument;
  selectedItemId: string | null;
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

function App() {
  const readOnly = new URLSearchParams(window.location.search).get("readOnly") === "true";
  const [document, setDocument] = useState(createDocument);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const changes = useRef<string[]>([]);

  useEffect(() => {
    window["__timelineEditorHarness"] = {
      changes: changes.current,
      document,
      selectedItemId,
    };
  }, [document, selectedItemId]);

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

  const handleSelectedItemChange = (selection: TimelineWorkbenchSelection) => {
    recordChange(`selected:${selection.itemId ?? ""}`);
    setSelectedItemId(selection.itemId ?? null);
  };

  return (
    <TimelineWorkbench
      document={document}
      selectedItemId={selectedItemId}
      readOnly={readOnly}
      pixelsPerSecond={80}
      snapMs={100}
      onDocumentChange={handleDocumentChange}
      onCurrentTimeChange={handleCurrentTimeChange}
      onSelectedItemChange={handleSelectedItemChange}
    />
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(<App />);
