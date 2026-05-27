"use client";

import type { ReactNode } from "react";

import {
  InspectorPanel,
  type InspectorFieldDefinition,
  type InspectorFieldValue,
} from "@moritzbrantner/ui/labs";

import {
  formatTimelineEditorTimeMs,
  getTimelineEditorItemEndMs,
  snapTimelineEditorTime,
  type TimelineEditorItem,
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
    const sharedValues = getTimelineWorkbenchInspectorSharedValues(
      context.selectedItems,
      inspectorSchema,
    );
    const mixedFieldIds = new Set(
      Object.entries(sharedValues)
        .filter(([, value]) => value.mixed)
        .map(([fieldId]) => fieldId),
    );
    const values = Object.fromEntries(
      Object.entries(sharedValues).map(([fieldId, value]) => [fieldId, value.value]),
    );
    const sections = getTimelineWorkbenchInspectorSections({
      inputStepMs,
      inspectorSchema,
      mixedFieldIds,
      showEndMs: false,
    });

    return (
      <div className="grid gap-3">
        <TimelineWorkbenchInfoPanel
          title="Selection"
          summary={`${context.selectedItems.length} timeline items`}
          rows={[
            ["Start", formatTimelineEditorTimeMs(selectionStartMs)],
            ["End", formatTimelineEditorTimeMs(selectionEndMs)],
            ["Span", formatTimelineEditorTimeMs(selectionEndMs - selectionStartMs)],
          ]}
        />
        <InspectorPanel
          title="Timeline items"
          description="Shared fields"
          readOnly={context.readOnly}
          defaultValues={values}
          sections={sections}
          onApply={(nextValues) => {
            context.updateSelectedItems((selected) => {
              const dataPatch = Object.fromEntries(
                (inspectorSchema?.itemFields ?? [])
                  .filter(
                    (field) =>
                      field.dataKey &&
                      (!mixedFieldIds.has(field.id) || nextValues[field.id] !== values[field.id]),
                  )
                  .map((field) => [field.dataKey!, nextValues[field.id]]),
              );
              const patch: Partial<typeof selected> = {};

              if (!mixedFieldIds.has("label") || nextValues.label !== values.label) {
                patch.label = String(nextValues.label ?? selected.label);
              }

              if (!mixedFieldIds.has("startMs") || nextValues.startMs !== values.startMs) {
                patch.startMs = snapTimelineWorkbenchInspectorTime(
                  toNumber(nextValues.startMs, selected.startMs),
                  timingStepMs,
                );
              }

              if (!mixedFieldIds.has("durationMs") || nextValues.durationMs !== values.durationMs) {
                patch.durationMs = snapTimelineWorkbenchInspectorTime(
                  toNumber(nextValues.durationMs, selected.durationMs),
                  timingStepMs,
                );
              }

              if (!mixedFieldIds.has("kind") || nextValues.kind !== values.kind) {
                patch.kind = String(nextValues.kind ?? "") || undefined;
              }

              if (!mixedFieldIds.has("color") || nextValues.color !== values.color) {
                patch.color = String(nextValues.color ?? "") || undefined;
              }

              if (!mixedFieldIds.has("locked") || nextValues.locked !== values.locked) {
                patch.locked = Boolean(nextValues.locked);
              }

              if (Object.keys(dataPatch).length > 0) {
                patch.data = {
                  ...((selected.data as object | undefined) ?? {}),
                  ...dataPatch,
                } as TData;
              }

              return patch;
            });
          }}
        />
        {extensionSections}
      </div>
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
        defaultValues={{
          label: item.label,
          startMs: item.startMs,
          durationMs: item.durationMs,
          endMs: getTimelineEditorItemEndMs(item),
          kind: item.kind ?? "",
          color: item.color ?? "",
          locked: item.locked ?? false,
          ...schemaValues,
        }}
        sections={getTimelineWorkbenchInspectorSections({ inputStepMs, inspectorSchema })}
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

function getTimelineWorkbenchInspectorSections<TData>({
  inputStepMs,
  inspectorSchema,
  mixedFieldIds = new Set(),
  showEndMs = true,
}: {
  inputStepMs: number;
  inspectorSchema?: TimelineWorkbenchInspectorSchema<TData>;
  mixedFieldIds?: ReadonlySet<string>;
  showEndMs?: boolean;
}) {
  const fields: InspectorFieldDefinition[] = [
    withMixedPlaceholder({ id: "label", label: "Label", type: "text" }, mixedFieldIds),
    withMixedPlaceholder(
      { id: "startMs", label: "Start", type: "number", min: 0, step: inputStepMs },
      mixedFieldIds,
    ),
    withMixedPlaceholder(
      { id: "durationMs", label: "Duration", type: "number", min: 100, step: inputStepMs },
      mixedFieldIds,
    ),
    ...(showEndMs
      ? [
          {
            id: "endMs",
            label: "End",
            type: "number",
            readOnly: true,
          } satisfies InspectorFieldDefinition,
        ]
      : []),
    withMixedPlaceholder({ id: "kind", label: "Kind", type: "text" }, mixedFieldIds),
    withMixedPlaceholder({ id: "color", label: "Color", type: "text" }, mixedFieldIds),
    withMixedPlaceholder({ id: "locked", label: "Locked", type: "boolean" }, mixedFieldIds),
  ];

  return [
    {
      id: "timing",
      title: "Timing",
      fields,
    },
    ...(inspectorSchema?.itemFields?.length
      ? [
          {
            id: "data",
            title: "Data",
            fields: inspectorSchema.itemFields.map((field) =>
              withMixedPlaceholder(
                {
                  id: field.id,
                  label: field.label,
                  type: field.type === "color" ? "text" : field.type,
                },
                mixedFieldIds,
              ),
            ),
          },
        ]
      : []),
  ];
}

function withMixedPlaceholder(
  field: InspectorFieldDefinition,
  mixedFieldIds: ReadonlySet<string>,
): InspectorFieldDefinition {
  return mixedFieldIds.has(field.id)
    ? { ...field, placeholder: field.placeholder ?? "Mixed values" }
    : field;
}

function getTimelineWorkbenchInspectorSharedValues<TData>(
  selectedItems: Array<TimelineEditorItem<TData>>,
  inspectorSchema?: TimelineWorkbenchInspectorSchema<TData>,
) {
  return {
    label: getSharedInspectorValue(selectedItems, (item) => item.label),
    startMs: getSharedInspectorValue(selectedItems, (item) => item.startMs),
    durationMs: getSharedInspectorValue(selectedItems, (item) => item.durationMs),
    kind: getSharedInspectorValue(selectedItems, (item) => item.kind ?? ""),
    color: getSharedInspectorValue(selectedItems, (item) => item.color ?? ""),
    locked: getSharedInspectorValue(selectedItems, (item) => item.locked ?? false),
    ...Object.fromEntries(
      (inspectorSchema?.itemFields ?? []).map((field) => [
        field.id,
        getSharedInspectorValue(selectedItems, (item) =>
          field.dataKey ? (item.data as Record<string, unknown> | undefined)?.[field.dataKey] : "",
        ),
      ]),
    ),
  } satisfies Record<string, { value: InspectorFieldValue; mixed: boolean }>;
}

function getSharedInspectorValue<TItem>(
  items: TItem[],
  getValue: (item: TItem) => unknown,
): { value: InspectorFieldValue; mixed: boolean } {
  const [firstItem] = items;

  if (!firstItem) {
    return { value: "", mixed: false };
  }

  const firstValue = normalizeInspectorFieldValue(getValue(firstItem));
  const mixed = items.some((item) => normalizeInspectorFieldValue(getValue(item)) !== firstValue);

  return { value: mixed ? getMixedInspectorFieldValue(firstValue) : firstValue, mixed };
}

function normalizeInspectorFieldValue(value: unknown): InspectorFieldValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value;
  }

  return String(value ?? "");
}

function getMixedInspectorFieldValue(value: InspectorFieldValue): InspectorFieldValue {
  return typeof value === "boolean" ? null : "";
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
