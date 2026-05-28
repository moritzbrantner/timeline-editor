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
      inspectorSchema={{
        transformFields: [
          { id: "x", label: "X", step: 1, defaultValue: 0 },
          { id: "opacity", label: "Opacity", min: 0, max: 1, step: 0.1, defaultValue: 1 },
        ],
      }}
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

const groupedMediaDocument: TimelineEditorDocument = {
  durationMs: 10_000,
  currentTimeMs: 2_000,
  groups: [{ id: "program", label: "Program", trackIds: ["video", "audio", "captions"] }],
  tracks: [
    {
      id: "video",
      label: "Video",
      kind: "video",
      items: [
        {
          id: "scene",
          trackId: "video",
          label: "Scene",
          kind: "video",
          startMs: 0,
          durationMs: 4_000,
          transform: {
            points: [
              { offsetMs: 0, values: { x: 0, opacity: 1 } },
              { offsetMs: 4_000, values: { x: 120, opacity: 0.75 }, easing: "ease-out" },
            ],
          },
        },
      ],
    },
    { id: "audio", label: "Audio", kind: "audio", items: [] },
    { id: "captions", label: "Captions", acceptsItemKinds: ["caption"], items: [] },
  ],
};

export function KeyframeAndTrackGroupWorkbenchExample() {
  const [document, setDocument] = useState(groupedMediaDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({
    itemIds: ["scene"],
    anchorItemId: "scene",
  });

  return (
    <TimelineWorkbench
      document={document}
      selection={selection}
      inspectorSchema={{
        transformFields: [
          { id: "x", label: "X", step: 1, defaultValue: 0 },
          { id: "opacity", label: "Opacity", min: 0, max: 1, step: 0.1, defaultValue: 1 },
        ],
      }}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
    />
  );
}
