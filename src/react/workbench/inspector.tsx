"use client";

import { InspectorPanel, type InspectorFieldValue } from "@moritzbrantner/ui/labs";

import { getTimelineEditorItemEndMs, snapTimelineEditorTime } from "../../core";
import type { TimelineWorkbenchInspectorContext } from "../workbench";

export function DefaultTimelineInspector<TData>({
  context,
  timingStepMs,
}: {
  context: TimelineWorkbenchInspectorContext<TData>;
  timingStepMs?: number;
}) {
  const item = context.selectedItem;
  const inputStepMs = timingStepMs ?? 100;

  if (context.selectedItems.length > 1) {
    return (
      <div className="grid gap-3 p-4 text-sm">
        <div className="font-medium">{context.selectedItems.length} timeline items</div>
        <div className="text-muted-foreground">
          Shared actions are available from the toolbar. Select one item to edit timing fields.
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a timeline item to inspect its timing and metadata.
      </div>
    );
  }

  return (
    <InspectorPanel
      title="Timeline item"
      description={context.selectedTrack?.label}
      readOnly={context.readOnly}
      values={{
        label: item.label,
        startMs: item.startMs,
        durationMs: item.durationMs,
        endMs: getTimelineEditorItemEndMs(item),
        kind: item.kind ?? "",
        locked: item.locked ?? false,
      }}
      sections={[
        {
          id: "timing",
          title: "Timing",
          fields: [
            { id: "label", label: "Label", type: "text" },
            { id: "startMs", label: "Start", type: "number", min: 0, step: inputStepMs },
            { id: "durationMs", label: "Duration", type: "number", min: 100, step: inputStepMs },
            { id: "endMs", label: "End", type: "number", readOnly: true },
            { id: "kind", label: "Kind", type: "text" },
            { id: "locked", label: "Locked", type: "boolean" },
          ],
        },
      ]}
      onApply={(values) => {
        context.updateSelectedItem({
          label: String(values.label ?? item.label),
          startMs: snapTimelineWorkbenchInspectorTime(
            toNumber(values.startMs, item.startMs),
            timingStepMs,
          ),
          durationMs: snapTimelineWorkbenchInspectorTime(
            toNumber(values.durationMs, item.durationMs),
            timingStepMs,
          ),
          kind: String(values.kind ?? "") || undefined,
          locked: Boolean(values.locked),
        });
      }}
    />
  );
}

function toNumber(value: InspectorFieldValue, fallback: number) {
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function snapTimelineWorkbenchInspectorTime(timeMs: number, snapMs?: number) {
  return snapMs && snapMs > 0 ? snapTimelineEditorTime(timeMs, snapMs) : timeMs;
}
