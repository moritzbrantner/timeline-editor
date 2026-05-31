"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button, Input } from "@moritzbrantner/ui";

import {
  formatTimelineEditorTimeMs,
  getTimelineEditorItemTransformValuesAt,
  getTimelineEditorItemEndMs,
  snapTimelineEditorTime,
  timelineEditorTransformEasings,
  type TimelineEditorItem,
  type TimelineEditorTrack,
  type TimelineEditorTransformPoint,
  type TimelineEditorTransformValues,
  validateTimelineEditorDocument,
} from "../../core";
import type {
  TimelineWorkbenchInspectorContext,
  TimelineWorkbenchInspectorSchema,
} from "../workbench";
import { TimelineWorkbenchMarkerInspector, TimelineWorkbenchMarkersPanel } from "./markers";

type InspectorFieldValue = string | number | boolean | string[] | null | undefined;

type InspectorFieldDefinition = {
  id: string;
  label: string;
  type: "text" | "number" | "boolean" | "color";
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  placeholder?: string;
};

type InspectorSection = {
  id: string;
  title: string;
  fields: InspectorFieldDefinition[];
};

type InspectorValues = Record<string, InspectorFieldValue>;

export function DefaultTimelineInspector<
  TData,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
>({
  context,
  extensionSections = [],
  inspectorSchema,
  timingStepMs,
}: {
  context: TimelineWorkbenchInspectorContext<TData, TTrackData>;
  extensionSections?: ReactNode[];
  inspectorSchema?: TimelineWorkbenchInspectorSchema<TData>;
  timingStepMs?: number;
}) {
  const item = context.selectedItem;
  const selectedMarkerId = context.selection.markerIds?.[0];
  const selectedMarker = selectedMarkerId
    ? context.document.markers?.find((marker) => marker.id === selectedMarkerId)
    : undefined;
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

  if (selectedMarker) {
    return (
      <TimelineWorkbenchMarkerInspector
        context={context}
        marker={selectedMarker}
        timingStepMs={timingStepMs}
      />
    );
  }

  const selectedRange = normalizeTimelineWorkbenchInspectorRange(context.selection.range);

  if (!item && selectedRange) {
    const trackCount = context.selection.trackIds?.length ?? context.document.tracks.length;
    const targetTrackId =
      context.selection.trackIds?.[0] ??
      context.selectedTrack?.id ??
      context.document.tracks.find((track) => !track.locked)?.id;
    const trackLabel =
      context.selection.trackIds?.length === 1
        ? (context.document.tracks.find((track) => track.id === context.selection.trackIds?.[0])
            ?.label ?? context.selection.trackIds[0])
        : `${trackCount} ${trackCount === 1 ? "track" : "tracks"}`;

    return (
      <div className="grid gap-3">
        <TimelineWorkbenchInfoPanel
          title="Range"
          summary={`${formatTimelineEditorTimeMs(selectedRange.endMs - selectedRange.startMs)} selected`}
          rows={[
            ["Start", formatTimelineEditorTimeMs(selectedRange.startMs)],
            ["End", formatTimelineEditorTimeMs(selectedRange.endMs)],
            ["Span", formatTimelineEditorTimeMs(selectedRange.endMs - selectedRange.startMs)],
            ["Tracks", trackLabel],
          ]}
        />
        <div className="flex flex-wrap items-center gap-2 px-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={context.readOnly}
            onClick={() => context.deleteRange(selectedRange)}
          >
            Delete Range
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={context.readOnly || !targetTrackId}
            onClick={() => {
              if (targetTrackId) {
                context.insertGap(
                  targetTrackId,
                  selectedRange.startMs,
                  selectedRange.endMs - selectedRange.startMs,
                );
              }
            }}
          >
            Insert Gap
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={context.readOnly || !targetTrackId}
            onClick={() => {
              if (targetTrackId) {
                context.closeGap(targetTrackId, selectedRange.startMs, selectedRange.endMs);
              }
            }}
          >
            Close Gap
          </Button>
        </div>
        {extensionSections}
      </div>
    );
  }

  if (!item && context.selectedTrack && context.selection.trackIds?.length === 1) {
    return (
      <TimelineWorkbenchTrackInspector
        context={context}
        extensionSections={extensionSections}
        track={context.selectedTrack}
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
        <TimelineWorkbenchMarkersPanel context={context} />
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
      {inspectorSchema?.transformFields?.length ? (
        <TimelineWorkbenchTransformInspector
          context={context}
          item={item}
          timingStepMs={timingStepMs}
          transformFields={inspectorSchema.transformFields}
        />
      ) : null}
      {extensionSections}
    </div>
  );
}

function TimelineWorkbenchTrackInspector<
  TData,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
>({
  context,
  extensionSections,
  track,
}: {
  context: TimelineWorkbenchInspectorContext<TData, TTrackData>;
  extensionSections: ReactNode[];
  track: TimelineEditorTrack<TTrackData, TData>;
}) {
  const group = context.document.groups?.find((candidate) => candidate.trackIds.includes(track.id));
  const trackStartMs = track.items.length
    ? Math.min(...track.items.map((item) => item.startMs))
    : undefined;
  const trackEndMs = track.items.length
    ? Math.max(...track.items.map((item) => getTimelineEditorItemEndMs(item)))
    : undefined;
  const acceptedKinds =
    track.acceptsItemKinds && track.acceptsItemKinds.length > 0
      ? track.acceptsItemKinds.join(", ")
      : "Any";
  const occupiedSpan =
    trackStartMs !== undefined && trackEndMs !== undefined
      ? formatTimelineEditorTimeMs(trackEndMs - trackStartMs)
      : "0:00.0";

  return (
    <div className="grid gap-3">
      <TimelineWorkbenchInfoPanel
        title="Track"
        summary={track.label}
        rows={[
          ["Kind", track.kind ?? "untyped"],
          ["Accepted", acceptedKinds],
          ["Items", track.items.length],
          ["Occupied span", occupiedSpan],
          ["Locked", track.locked ? "Yes" : "No"],
          ["Group", group?.label ?? "None"],
        ]}
      />
      <InspectorPanel
        title="Track fields"
        description={group?.label}
        readOnly={context.readOnly}
        defaultValues={{
          label: track.label,
          kind: track.kind ?? "",
          height: track.height ?? "",
          locked: track.locked ?? false,
        }}
        sections={[
          {
            id: "track",
            title: "Track",
            fields: [
              { id: "label", label: "Label", type: "text" },
              { id: "kind", label: "Kind", type: "text" },
              { id: "height", label: "Height", type: "number", min: 1, step: 1 },
              { id: "locked", label: "Locked", type: "boolean" },
            ],
          },
        ]}
        onApply={(values) => {
          const nextHeight = Number(values.height);

          context.updateSelectedTrack({
            label: String(values.label ?? track.label),
            kind: String(values.kind ?? "") || undefined,
            height: Number.isFinite(nextHeight) && nextHeight > 0 ? nextHeight : undefined,
            locked: Boolean(values.locked),
          });
        }}
      />
      <div className="flex flex-wrap items-center gap-2 px-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={track.items.length === 0}
          onClick={() => context.selectSelectedTrackItems()}
        >
          Select Items
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={context.readOnly}
          onClick={() => context.updateSelectedTrack({ locked: !track.locked })}
        >
          {track.locked ? "Unlock Track" : "Lock Track"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={context.readOnly}
          onClick={() => context.removeSelectedTrack()}
        >
          Delete Track
        </Button>
      </div>
      {extensionSections}
    </div>
  );
}

function TimelineWorkbenchTransformInspector<
  TData,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
>({
  context,
  item,
  timingStepMs,
  transformFields,
}: {
  context: TimelineWorkbenchInspectorContext<TData, TTrackData>;
  item: TimelineEditorItem<TData>;
  timingStepMs?: number;
  transformFields: NonNullable<TimelineWorkbenchInspectorSchema<TData>["transformFields"]>;
}) {
  const playheadOffsetMs = clampTimelineWorkbenchTransformOffset(
    (context.document.currentTimeMs ?? 0) - item.startMs,
    item.durationMs,
  );
  const keyframes = item.transform?.points ?? [];
  const nearestKeyframe = getNearestTimelineWorkbenchTransformPoint(keyframes, playheadOffsetMs);
  const sampledValues = getTimelineEditorItemTransformValuesAt(
    item,
    item.startMs + playheadOffsetMs,
  );
  const nearestOffsetMs = nearestKeyframe?.offsetMs ?? playheadOffsetMs;
  const easing = nearestKeyframe?.easing ?? "linear";
  const values = Object.fromEntries(
    transformFields.map((field) => [
      field.id,
      toTransformFieldValue(
        nearestKeyframe?.values[field.id] ?? sampledValues[field.id] ?? field.defaultValue ?? 0,
      ),
    ]),
  );
  const createPoint = (
    offsetMs = playheadOffsetMs,
    nextValues: Partial<TimelineEditorTransformValues> = values,
  ): TimelineEditorTransformPoint<TimelineEditorTransformValues> => ({
    offsetMs,
    easing,
    values: Object.fromEntries(
      transformFields.map((field) => [
        field.id,
        toTransformFieldValue(nextValues[field.id] ?? field.defaultValue ?? 0),
      ]),
    ),
  });

  const updateValue = (fieldId: string, value: string) => {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return;
    }

    context.upsertSelectedTransformPoint(
      createPoint(nearestKeyframe?.offsetMs ?? playheadOffsetMs, {
        ...values,
        [fieldId]: numberValue,
      }),
    );
  };
  const updateEasing = (value: string) => {
    if (
      !timelineEditorTransformEasings.includes(
        value as (typeof timelineEditorTransformEasings)[number],
      )
    ) {
      return;
    }

    context.updateSelectedTransformPoint(nearestOffsetMs, {
      easing: value as (typeof timelineEditorTransformEasings)[number],
    });
  };
  const moveKeyframe = (value: string) => {
    const nextOffsetMs = snapTimelineWorkbenchInspectorTime(
      toNumber(value, nearestOffsetMs),
      timingStepMs,
    );

    context.moveSelectedTransformPoint(nearestOffsetMs, nextOffsetMs);
  };

  return (
    <section
      data-slot="timeline-workbench-transform-inspector"
      className="grid gap-3 rounded border border-border bg-background p-3 text-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold">Transform</h2>
          <p className="text-xs text-muted-foreground">
            {keyframes.length} {keyframes.length === 1 ? "keyframe" : "keyframes"} · playhead{" "}
            {formatTimelineEditorTimeMs(playheadOffsetMs)}
          </p>
        </div>
        {nearestKeyframe ? (
          <div className="text-right text-xs text-muted-foreground">
            Nearest {formatTimelineEditorTimeMs(nearestKeyframe.offsetMs)}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          <span>Keyframe time</span>
          <Input
            data-slot="timeline-workbench-transform-offset"
            type="number"
            min={0}
            max={item.durationMs}
            step={timingStepMs ?? 100}
            value={nearestOffsetMs}
            disabled={context.readOnly || !nearestKeyframe}
            onChange={(event) => moveKeyframe(event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          <span>Easing</span>
          <select
            data-slot="timeline-workbench-transform-easing"
            className="h-8 rounded border bg-background px-2 text-xs"
            value={easing}
            disabled={context.readOnly || !nearestKeyframe}
            onChange={(event) => updateEasing(event.currentTarget.value)}
          >
            {timelineEditorTransformEasings.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-2">
        {transformFields.map((field) => (
          <label key={field.id} className="grid gap-1 text-xs text-muted-foreground">
            <span>{field.label}</span>
            <Input
              data-slot={`timeline-workbench-transform-field-${field.id}`}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={values[field.id]}
              disabled={context.readOnly}
              onChange={(event) => updateValue(field.id, event.currentTarget.value)}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={context.readOnly}
          onClick={() => context.upsertSelectedTransformPoint(createPoint(playheadOffsetMs))}
        >
          Add Keyframe
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={context.readOnly}
          onClick={() => context.upsertSelectedTransformPoint(createPoint(playheadOffsetMs))}
        >
          Update Keyframe
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={context.readOnly || !nearestKeyframe}
          onClick={() => {
            if (nearestKeyframe) {
              context.removeSelectedTransformPoint(nearestKeyframe.offsetMs);
            }
          }}
        >
          Remove Keyframe
        </Button>
      </div>
    </section>
  );
}

function InspectorPanel({
  defaultValues,
  description,
  onApply,
  readOnly,
  sections,
  title,
}: {
  defaultValues: InspectorValues;
  description?: ReactNode;
  onApply: (values: InspectorValues) => void;
  readOnly?: boolean;
  sections: InspectorSection[];
  title: string;
}) {
  const defaultValuesKey = useMemo(() => JSON.stringify(defaultValues), [defaultValues]);
  const [values, setValues] = useState(defaultValues);

  useEffect(() => {
    setValues(defaultValues);
  }, [defaultValuesKey]);

  const updateValue = (field: InspectorFieldDefinition, value: InspectorFieldValue) => {
    setValues((current) => ({ ...current, [field.id]: value }));
  };

  return (
    <section className="grid gap-3 rounded border border-border bg-background p-3 text-sm">
      <div className="grid gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4">
        {sections.map((section) => (
          <fieldset key={section.id} className="grid gap-2">
            <legend className="text-xs font-medium text-muted-foreground">{section.title}</legend>
            {section.fields.map((field) => (
              <InspectorField
                key={field.id}
                disabled={readOnly || field.readOnly}
                field={field}
                value={values[field.id]}
                onChange={(value) => updateValue(field, value)}
              />
            ))}
          </fieldset>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={readOnly} onClick={() => onApply(values)}>
          Apply
        </Button>
      </div>
    </section>
  );
}

function InspectorField({
  disabled,
  field,
  onChange,
  value,
}: {
  disabled?: boolean;
  field: InspectorFieldDefinition;
  onChange: (value: InspectorFieldValue) => void;
  value: InspectorFieldValue;
}) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{field.label}</span>
        <input
          aria-label={field.label}
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
      </label>
    );
  }

  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span>{field.label}</span>
      <Input
        aria-label={field.label}
        type={field.type}
        min={field.min}
        max={field.max}
        step={field.step}
        value={toInspectorInputValue(value)}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            field.type === "number" ? event.currentTarget.valueAsNumber : event.currentTarget.value,
          )
        }
      />
    </label>
  );
}

function toInspectorInputValue(value: InspectorFieldValue) {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return "";
}

function clampTimelineWorkbenchTransformOffset(offsetMs: number, durationMs: number) {
  if (!Number.isFinite(offsetMs)) {
    return 0;
  }

  return Math.max(0, Math.min(durationMs, offsetMs));
}

function getNearestTimelineWorkbenchTransformPoint(
  points: Array<TimelineEditorTransformPoint<TimelineEditorTransformValues>>,
  offsetMs: number,
) {
  return points
    .slice()
    .sort(
      (left, right) =>
        Math.abs(left.offsetMs - offsetMs) - Math.abs(right.offsetMs - offsetMs) ||
        left.offsetMs - right.offsetMs,
    )[0];
}

function toTransformFieldValue(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
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
                  type: field.type,
                },
                mixedFieldIds,
              ),
            ),
          },
        ]
      : []),
  ];
}

function normalizeTimelineWorkbenchInspectorRange(range?: { startMs: number; endMs: number }) {
  if (!range || range.startMs === range.endMs) {
    return undefined;
  }

  return {
    startMs: Math.max(0, Math.min(range.startMs, range.endMs)),
    endMs: Math.max(range.startMs, range.endMs),
  };
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
