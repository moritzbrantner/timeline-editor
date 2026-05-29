"use client";

import { Button, cn } from "@moritzbrantner/ui";

import { formatTimelineEditorTimeMs } from "../../core";
import type { TimelineEditorTimeRange } from "../../core";
import type { TimelineWorkbenchTransportState } from "./types";

type TimelineWorkbenchTransportProps = {
  currentTimeMs: number;
  durationMs: number;
  frameStepMs: number;
  loopRange?: TimelineEditorTimeRange;
  readOnly: boolean;
  transportState: TimelineWorkbenchTransportState;
  onJumpEnd: () => void;
  onJumpStart: () => void;
  onNextFrame: () => void;
  onPreviousFrame: () => void;
  onShuttleBackward: () => void;
  onShuttleForward: () => void;
  onToggleLoop: () => void;
  onTogglePlay: () => void;
};

export function TimelineWorkbenchTransport({
  currentTimeMs,
  durationMs,
  frameStepMs,
  loopRange,
  readOnly,
  transportState,
  onJumpEnd,
  onJumpStart,
  onNextFrame,
  onPreviousFrame,
  onShuttleBackward,
  onShuttleForward,
  onToggleLoop,
  onTogglePlay,
}: TimelineWorkbenchTransportProps) {
  const disabled = readOnly || durationMs <= 0;
  const isPlaying = transportState.status === "playing";
  const rateLabel = `${transportState.playbackRate}x`;
  const loopLabel = loopRange
    ? `${formatTimelineEditorTimeMs(loopRange.startMs)} - ${formatTimelineEditorTimeMs(loopRange.endMs)}`
    : "Document";

  return (
    <div
      data-slot="timeline-workbench-transport"
      className="flex min-h-10 min-w-0 items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-1.5"
    >
      <div className="flex shrink-0 items-center gap-1">
        <TransportButton label="Jump to start" disabled={disabled} onClick={onJumpStart}>
          |&lt;
        </TransportButton>
        <TransportButton
          label="Step back one frame"
          disabled={disabled || frameStepMs <= 0}
          onClick={onPreviousFrame}
        >
          &lt;
        </TransportButton>
        <TransportButton label="Shuttle backward" disabled={disabled} onClick={onShuttleBackward}>
          J
        </TransportButton>
        <TransportButton
          label={isPlaying ? "Pause" : "Play"}
          disabled={disabled}
          emphasized
          onClick={onTogglePlay}
        >
          {isPlaying ? "Pause" : "Play"}
        </TransportButton>
        <TransportButton label="Shuttle forward" disabled={disabled} onClick={onShuttleForward}>
          L
        </TransportButton>
        <TransportButton
          label="Step ahead one frame"
          disabled={disabled || frameStepMs <= 0}
          onClick={onNextFrame}
        >
          &gt;
        </TransportButton>
        <TransportButton label="Jump to end" disabled={disabled} onClick={onJumpEnd}>
          &gt;|
        </TransportButton>
        <TransportButton
          label="Loop"
          disabled={disabled}
          pressed={transportState.loop}
          onClick={onToggleLoop}
        >
          Loop
        </TransportButton>
      </div>
      <div className="min-w-0 flex-1 truncate text-xs tabular-nums text-muted-foreground">
        {formatTimelineEditorTimeMs(currentTimeMs)} / {formatTimelineEditorTimeMs(durationMs)}
        {transportState.loop ? (
          <span className="ml-2 hidden sm:inline">Loop: {loopLabel}</span>
        ) : null}
      </div>
      <div
        data-slot="timeline-workbench-transport-rate"
        className={cn(
          "shrink-0 rounded border border-border/70 bg-background px-2 py-0.5 text-xs tabular-nums",
          isPlaying ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {rateLabel}
      </div>
    </div>
  );
}

function TransportButton({
  children,
  disabled,
  emphasized = false,
  label,
  pressed,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  emphasized?: boolean;
  label: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={emphasized || pressed ? "default" : "ghost"}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      className="h-7 min-w-7 px-2 text-xs"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
