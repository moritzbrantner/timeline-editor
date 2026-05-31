"use client";

import { Button, Input } from "@moritzbrantner/ui";

import {
  formatTimelineEditorTimeMs,
  snapTimelineEditorTime,
  type TimelineEditorMarker,
} from "../../core";
import type { TimelineWorkbenchInspectorContext } from "./types";

type TimelineWorkbenchMarkersPanelProps<
  TData,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
> = {
  context: TimelineWorkbenchInspectorContext<TData, TTrackData>;
};

export function TimelineWorkbenchMarkersPanel<
  TData,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
>({ context }: TimelineWorkbenchMarkersPanelProps<TData, TTrackData>) {
  const markers = [...(context.document.markers ?? [])].sort((left, right) =>
    left.timeMs === right.timeMs ? left.id.localeCompare(right.id) : left.timeMs - right.timeMs,
  );

  if (markers.length === 0) {
    return (
      <div className="grid gap-2 rounded border border-border bg-background p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Markers</div>
            <div className="text-xs text-muted-foreground">
              0 markers · playhead {formatTimelineEditorTimeMs(context.document.currentTimeMs ?? 0)}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={context.readOnly}
            onClick={() => context.addMarker()}
          >
            Add
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Markers</div>
          <div className="text-xs text-muted-foreground">{markers.length} markers</div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={context.readOnly}
          onClick={() => context.addMarker()}
        >
          Add
        </Button>
      </div>
      <div className="grid gap-1.5">
        {markers.map((marker) => (
          <div
            key={marker.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded border border-border/70 px-2 py-1.5"
          >
            <span
              aria-hidden="true"
              className="size-3 rounded-full border border-border"
              style={{ background: marker.color ?? "var(--primary)" }}
            />
            <button
              type="button"
              className="grid min-w-0 text-left"
              onClick={() => context.setCurrentTime(marker.timeMs)}
            >
              <span className="truncate text-sm font-medium">{marker.label ?? marker.id}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatTimelineEditorTimeMs(marker.timeMs)}
              </span>
            </button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => context.setCurrentTime(marker.timeMs)}
            >
              Jump
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={context.readOnly}
              onClick={() => context.removeMarker(marker.id)}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

type TimelineWorkbenchMarkerInspectorProps<
  TData,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
> = {
  context: TimelineWorkbenchInspectorContext<TData, TTrackData>;
  marker: TimelineEditorMarker;
  timingStepMs?: number;
};

export function TimelineWorkbenchMarkerInspector<
  TData,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
>({ context, marker, timingStepMs }: TimelineWorkbenchMarkerInspectorProps<TData, TTrackData>) {
  const updateMarkerTime = (value: string) => {
    const timeMs = Number(value);

    if (!Number.isFinite(timeMs)) {
      return;
    }

    context.updateMarker(marker.id, {
      timeMs: timingStepMs ? snapTimelineEditorTime(timeMs, timingStepMs) : timeMs,
    });
  };

  return (
    <div className="grid gap-3">
      <div
        data-slot="timeline-workbench-marker-inspector"
        className="grid gap-3 rounded border border-border bg-background p-3"
      >
        <div>
          <div className="text-sm font-medium">Marker</div>
          <div className="text-xs text-muted-foreground">
            {formatTimelineEditorTimeMs(marker.timeMs)}
          </div>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Label</span>
          <Input
            data-slot="timeline-workbench-marker-label"
            value={marker.label ?? ""}
            disabled={context.readOnly}
            onChange={(event) =>
              context.updateMarker(marker.id, {
                label: event.currentTarget.value || undefined,
              })
            }
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Time</span>
          <Input
            data-slot="timeline-workbench-marker-time"
            type="number"
            min={0}
            step={timingStepMs ?? 100}
            value={marker.timeMs}
            disabled={context.readOnly}
            onChange={(event) => updateMarkerTime(event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Color</span>
          <Input
            data-slot="timeline-workbench-marker-color"
            value={marker.color ?? ""}
            disabled={context.readOnly}
            onChange={(event) =>
              context.updateMarker(marker.id, {
                color: event.currentTarget.value || undefined,
              })
            }
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => context.setCurrentTime(marker.timeMs)}
          >
            Jump
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={context.readOnly}
            onClick={() => context.removeMarker(marker.id)}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
