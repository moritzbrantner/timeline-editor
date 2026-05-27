"use client";

import type { ReactNode } from "react";

import { InspectorPanel, type InspectorFieldValue } from "@moritzbrantner/ui/labs";

import {
  formatTimelineEditorTimeMs,
  getTimelineEditorItemEndMs,
  snapTimelineEditorTime,
  validateTimelineEditorDocument,
} from "../../core";
import type {
  TimelineWorkbenchInspectorContext,
  TimelineWorkbenchInspectorSchema,
} from "../workbench";

export function DefaultTimelineInspector<TData>({
  context,
  extensionSections = [],
  inspectorSchema,
  timingStepMs,
}: {
  context: TimelineWorkbenchInspectorContext<TData>;
  extensionSections?: ReactNode[];
  inspectorSchema?: TimelineWorkbenchInspectorSchema<TData>;
  timingStepMs?: number;
}) {
  const item = context.selectedItem;
  const inputStepMs = timingStepMs ?? 100;
  const documentItemCount = context.document.tracks.reduce(
    (count, track) => count + track.items.length,
    0,
  );

  if (context.selectedItems.length > 1) {
    const selectionStartMs = Math.min(...context.selectedItems.map((selected) => selected.startMs));
    const selectionEndMs = Math.max(
      ...context.selectedItems.map((selected) => getTimelineEditorItemEndMs(selected)),
    );

    return (
      <TimelineWorkbenchInfoPanel
        title="Selection"
        summary={`${context.selectedItems.length} timeline items`}
        rows={[
          ["Start", formatTimelineEditorTimeMs(selectionStartMs)],
          ["End", formatTimelineEditorTimeMs(selectionEndMs)],
          ["Span", formatTimelineEditorTimeMs(selectionEndMs - selectionStartMs)],
        ]}
      />
    );
  }

  if (!item) {
    const issues = validateTimelineEditorDocument(context.document as never);

    return (
      <div className="grid gap-3">
        <TimelineWorkbenchInfoPanel
          title="Document"
          summary={formatDocumentSummary(context.document.tracks.length, documentItemCount)}
          rows={[
            ["Duration", formatTimelineEditorTimeMs(context.durationMs)],
            ["Current time", formatTimelineEditorTimeMs(context.document.currentTimeMs ?? 0)],
            ["Tracks", context.document.tracks.length],
            ["Items", documentItemCount],
            ["Markers", context.document.markers?.length ?? 0],
            ["Groups", context.document.groups?.length ?? 0],
            ["Item groups", context.document.itemGroups?.length ?? 0],
            ["Validation", issues.length],
          ]}
        />
        {(context.document.markers?.length ?? 0) > 0 ? (
          <TimelineWorkbenchInfoPanel
            title="Markers"
            summary={`${context.document.markers?.length ?? 0} markers`}
            rows={(context.document.markers ?? []).map((marker) => [
              marker.label ?? marker.id,
              formatTimelineEditorTimeMs(marker.timeMs),
            ])}
          />
        ) : null}
        {issues.length > 0 ? (
          <TimelineWorkbenchInfoPanel
            title="Validation"
            summary={`${issues.length} issues`}
            rows={issues.slice(0, 6).map((issue) => [issue.code, issue.message])}
          />
        ) : null}
        {extensionSections}
      </div>
    );
  }

  const schemaValues = Object.fromEntries(
    (inspectorSchema?.itemFields ?? []).map((field) => [
      field.id,
      field.dataKey ? (item.data as Record<string, unknown> | undefined)?.[field.dataKey] : "",
    ]),
  );

  return (
    <div className="grid gap-3">
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
          color: item.color ?? "",
          locked: item.locked ?? false,
          ...schemaValues,
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
              { id: "color", label: "Color", type: "text" },
              { id: "locked", label: "Locked", type: "boolean" },
            ],
          },
          ...(inspectorSchema?.itemFields?.length
            ? [
                {
                  id: "data",
                  title: "Data",
                  fields: inspectorSchema.itemFields.map((field) => ({
                    id: field.id,
                    label: field.label,
                    type: field.type === "color" ? "text" : field.type,
                  })),
                },
              ]
            : []),
        ]}
        onApply={(values) => {
          const dataPatch = Object.fromEntries(
            (inspectorSchema?.itemFields ?? [])
              .filter((field) => field.dataKey)
              .map((field) => [field.dataKey!, values[field.id]]),
          );

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
            color: String(values.color ?? "") || undefined,
            locked: Boolean(values.locked),
            data:
              Object.keys(dataPatch).length > 0
                ? ({ ...((item.data as object | undefined) ?? {}), ...dataPatch } as TData)
                : item.data,
          });
        }}
      />
      {extensionSections}
    </div>
  );
}

function toNumber(value: InspectorFieldValue, fallback: number) {
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function snapTimelineWorkbenchInspectorTime(timeMs: number, snapMs?: number) {
  return snapMs && snapMs > 0 ? snapTimelineEditorTime(timeMs, snapMs) : timeMs;
}

function formatDocumentSummary(trackCount: number, itemCount: number) {
  return `${trackCount} ${trackCount === 1 ? "track" : "tracks"} · ${itemCount} ${
    itemCount === 1 ? "item" : "items"
  }`;
}

function TimelineWorkbenchInfoPanel({
  title,
  summary,
  rows,
}: {
  title: string;
  summary: string;
  rows: Array<[string, string | number]>;
}) {
  return (
    <aside className="grid gap-3 p-3 text-sm">
      <div className="grid gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{summary}</p>
      </div>
      <dl className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="min-w-0 truncate text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
