import { useMemo, useState } from "react";

import {
  TimelineWorkbench,
  formatTimelineEditorTimeMs,
  migrateTimelineEditorDocument,
  serializeTimelineEditorDocument,
  type TimelineEditorDocument,
  type TimelineEditorExtension,
  type TimelineEditorSelection,
  type TimelineEditorViewport,
} from "@moritzbrantner/timeline-editor";

type AnnotationData = {
  mediaType: "annotation";
  assignee?: string;
  status?: "todo" | "doing" | "done";
};

const annotationExtension: TimelineEditorExtension<AnnotationData> = {
  id: "annotation",
  itemKinds: ["annotation"],
  renderItem: ({ item }) => (
    <span>
      {item.label} {item.data?.status ? `(${item.data.status})` : ""}
    </span>
  ),
  inspectorSections: [
    ({ selectedItems, updateSelectedItems }) =>
      selectedItems.length > 0 ? (
        <button
          type="button"
          onClick={() =>
            updateSelectedItems((item) => ({
              data: { ...item.data, mediaType: "annotation", status: "done" },
            }))
          }
        >
          Mark done
        </button>
      ) : null,
  ],
  renderPreview: ({ items, currentTimeMs }) => (
    <div>
      {formatTimelineEditorTimeMs(currentTimeMs)} · {items.map((item) => item.label).join(", ")}
    </div>
  ),
};

const planningDocument: TimelineEditorDocument<Record<string, unknown>, AnnotationData> = {
  durationMs: 12_000,
  currentTimeMs: 2_000,
  tracks: [
    {
      id: "planning",
      label: "Planning",
      acceptsItemKinds: ["annotation"],
      items: [
        {
          id: "brief",
          trackId: "planning",
          label: "Brief review",
          kind: "annotation",
          startMs: 1_000,
          durationMs: 2_000,
          data: { mediaType: "annotation", assignee: "Mira", status: "todo" },
        },
      ],
    },
  ],
};

export function AnnotationPlanningWorkbench() {
  const [document, setDocument] = useState(planningDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const [viewport, setViewport] = useState<TimelineEditorViewport>({ pixelsPerSecond: 90 });
  const restoredDocument = useMemo(
    () => migrateTimelineEditorDocument(serializeTimelineEditorDocument(document)).document,
    [document],
  );

  return (
    <TimelineWorkbench
      document={restoredDocument as typeof document}
      selection={selection}
      viewport={viewport}
      extensions={[annotationExtension]}
      inspectorSchema={{
        itemFields: [
          { id: "assignee", label: "Assignee", type: "text", dataKey: "assignee" },
          { id: "status", label: "Status", type: "text", dataKey: "status" },
        ],
      }}
      assets={[
        {
          id: "decision",
          label: "Decision point",
          kind: "annotation",
          durationMs: 1_500,
          data: { mediaType: "annotation", status: "todo" },
        },
      ]}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
      onViewportChange={setViewport}
    />
  );
}
