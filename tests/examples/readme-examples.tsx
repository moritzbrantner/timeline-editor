import { useState } from "react";

import {
  TimelineEditor,
  TimelineWorkbench,
  moveTimelineEditorItem,
  type TimelineEditorDocument,
  type TimelineEditorSelection,
  type TimelineEditorViewport,
} from "@moritzbrantner/timeline-editor";
import { applyTimelineEditorCommand } from "@moritzbrantner/timeline-editor/commands";
import { serializeTimelineEditorDocument } from "@moritzbrantner/timeline-editor/serialization";

const initialDocument: TimelineEditorDocument = {
  durationMs: 8_000,
  currentTimeMs: 1_000,
  markers: [{ id: "handoff", timeMs: 4_000, label: "Handoff" }],
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
          durationMs: 2_000,
        },
      ],
    },
  ],
};

export function ControlledEditorExample() {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });

  return (
    <TimelineEditor
      document={document}
      selection={selection}
      frameRate={24}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
    />
  );
}

export function ControlledWorkbenchExample() {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const [viewport, setViewport] = useState<TimelineEditorViewport>({ pixelsPerSecond: 80 });

  return (
    <TimelineWorkbench
      document={document}
      selection={selection}
      viewport={viewport}
      assets={[{ id: "scene", label: "Scene", kind: "video", durationMs: 2_000 }]}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
      onViewportChange={setViewport}
    />
  );
}

export function coreExamples() {
  const movedTracks = moveTimelineEditorItem(
    initialDocument.tracks,
    { itemId: "brief", startMs: 1_500 },
    { editPolicy: { overlap: "push", ripple: false } },
  );
  const commandResult = applyTimelineEditorCommand(
    { ...initialDocument, tracks: movedTracks },
    { itemIds: ["brief"] },
    { type: "delete-selection" },
    { editPolicy: { overlap: "allow", ripple: true } },
  );

  return serializeTimelineEditorDocument(commandResult.document);
}
