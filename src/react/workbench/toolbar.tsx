"use client";

import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";

import {
  ActionMenu,
  Badge,
  Button,
  Input,
  type MenuActionItem,
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Slider,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@moritzbrantner/ui";

import type {
  TimelineEditorClipboard,
  TimelineEditorDocument,
  TimelineEditorSelection,
  TimelineEditorSnapOptions,
  TimelineEditorSnapTarget,
  TimelineEditorTimeMode,
  TimelineEditorTool,
  TimelineEditorViewport,
  TimelineEditorOverlap,
} from "../../core";
import { formatTimelineEditorTimeMs } from "../../core";
import type { TimelineEditorHistory } from "../../history";
import { formatShortcutLabel } from "../../shortcut-label";
import { getHotkeyFromKeyboardEvent } from "../timeline-editor/hotkeys";
import { type TimelineWorkbenchHotkeyId, timelineWorkbenchHotkeyGroups } from "./hotkeys";

import {
  timelineEditorMaxPixelsPerSecond,
  timelineEditorMinPixelsPerSecond,
  type TimelineEditorHotkeys,
} from "../timeline-editor";
import type { TimelineWorkbenchInspectorContext } from "./types";

type TimelineWorkbenchToolbarProps<TTrackData extends Record<string, unknown>, TItemData> = {
  clipboard?: TimelineEditorClipboard<TItemData>;
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  frameStepMs: number;
  hasSelectedItemGroup: boolean;
  history: TimelineEditorHistory<TTrackData, TItemData>;
  inspectorContext: TimelineWorkbenchInspectorContext<TItemData, TTrackData>;
  overlaps: TimelineEditorOverlap[];
  pixelsPerSecond: number;
  readOnly: boolean;
  resolvedHotkeys: TimelineEditorHotkeys;
  resolvedSelection: TimelineEditorSelection;
  resolvedSnap: Partial<TimelineEditorSnapOptions>;
  resolvedTimeMode: TimelineEditorTimeMode;
  resolvedTool: TimelineEditorTool;
  resolvedViewport: TimelineEditorViewport;
  announcement?: string;
  renderToolbarActions?: (
    context: TimelineWorkbenchInspectorContext<TItemData, TTrackData>,
  ) => ReactNode;
  onAddMarker: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDeleteRange: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onInsertGap: () => void;
  onCloseGap: () => void;
  onRedo: () => void;
  onPaste: () => void;
  onSplit: () => void;
  onStepFrame: (direction: -1 | 1) => void;
  onUngroup: () => void;
  onUndo: () => void;
  onViewportChange: (viewport: TimelineEditorViewport) => void;
  onToolChange: (tool: TimelineEditorTool) => void;
  onSnapChange: (snap: Partial<TimelineEditorSnapOptions>) => void;
  onHotkeyChange: (id: TimelineWorkbenchHotkeyId, hotkey: string) => void;
  onHotkeysReset: () => void;
};

export { defaultTimelineWorkbenchHotkeys } from "./hotkeys";

export function TimelineWorkbenchToolbar<TTrackData extends Record<string, unknown>, TItemData>({
  clipboard,
  currentTimeMs,
  document,
  durationMs,
  frameStepMs,
  hasSelectedItemGroup,
  history,
  inspectorContext,
  overlaps,
  pixelsPerSecond,
  readOnly,
  resolvedHotkeys,
  resolvedSelection,
  resolvedSnap,
  resolvedTimeMode,
  resolvedTool,
  resolvedViewport,
  announcement,
  renderToolbarActions,
  onAddMarker,
  onCopy,
  onCut,
  onDelete,
  onDeleteRange,
  onDuplicate,
  onGroup,
  onInsertGap,
  onCloseGap,
  onRedo,
  onPaste,
  onSplit,
  onStepFrame,
  onUngroup,
  onUndo,
  onViewportChange,
  onToolChange,
  onSnapChange,
  onHotkeyChange,
  onHotkeysReset,
}: TimelineWorkbenchToolbarProps<TTrackData, TItemData>) {
  const hasRange = Boolean(resolvedSelection.range);
  const selectedItemCount = resolvedSelection.itemIds.length;
  const range = normalizeTimelineWorkbenchToolbarRange(resolvedSelection.range);
  const stepLabel = resolvedTimeMode === "frames" ? "frame" : "step";
  const moreItems: MenuActionItem[] = [
    {
      id: "paste",
      label: "Paste",
      disabled: readOnly || !clipboard || clipboard.items.length === 0,
      onSelect: onPaste,
    },
    {
      id: "add-marker",
      label: "Add Marker",
      disabled: readOnly,
      onSelect: onAddMarker,
    },
    { id: "timeline-navigation-separator", type: "separator" },
    {
      id: "previous-frame",
      label: `Previous ${stepLabel} (${formatTimelineWorkbenchFrameStep(frameStepMs)})`,
      disabled: readOnly || frameStepMs <= 0 || currentTimeMs <= 0,
      onSelect: () => onStepFrame(-1),
    },
    {
      id: "next-frame",
      label: `Next ${stepLabel} (${formatTimelineWorkbenchFrameStep(frameStepMs)})`,
      disabled: readOnly || frameStepMs <= 0 || currentTimeMs >= durationMs,
      onSelect: () => onStepFrame(1),
    },
  ];

  return (
    <div
      data-slot="timeline-workbench-toolbar"
      className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2"
    >
      <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || history.undoStack.length === 0}
          onClick={onUndo}
        >
          Undo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || history.redoStack.length === 0}
          onClick={onRedo}
        >
          Redo
        </Button>
        <ToggleGroup
          type="single"
          value={resolvedTool}
          aria-label="Timeline tool"
          disabled={readOnly}
          className="ml-1"
          onValueChange={(value) => {
            if (value) {
              onToolChange(value as TimelineEditorTool);
            }
          }}
        >
          {(["select", "blade", "trim", "ripple-trim", "pan"] as const).map((tool) => (
            <ToggleGroupItem
              key={tool}
              value={tool}
              size="sm"
              aria-label={formatTimelineWorkbenchToolLabel(tool)}
            >
              {formatTimelineWorkbenchToolLabel(tool)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5">
        {selectedItemCount > 0 ? (
          <>
            <Badge variant="secondary">
              {selectedItemCount} {selectedItemCount === 1 ? "item" : "items"}
            </Badge>
            <Button type="button" size="sm" variant="outline" onClick={onCopy}>
              Copy
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={onCut}>
              Cut
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={onSplit}>
              Split
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly}
              onClick={onDuplicate}
            >
              Duplicate
            </Button>
            {selectedItemCount > 1 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={readOnly}
                onClick={onGroup}
              >
                Group
              </Button>
            ) : null}
            {hasSelectedItemGroup ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={readOnly}
                onClick={onUngroup}
              >
                Ungroup
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={readOnly}
              onClick={onDelete}
            >
              Delete
            </Button>
          </>
        ) : null}
        {hasRange && range ? (
          <>
            <Badge variant="outline">
              Range {formatTimelineEditorTimeMs(range.startMs)}-
              {formatTimelineEditorTimeMs(range.endMs)} (
              {formatTimelineEditorTimeMs(range.endMs - range.startMs)})
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly}
              onClick={onDeleteRange}
            >
              Delete Range
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly}
              onClick={onInsertGap}
            >
              Insert Gap
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly}
              onClick={onCloseGap}
            >
              Close Gap
            </Button>
          </>
        ) : null}
        {clipboard?.items.length ? (
          <Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={onPaste}>
            Paste
          </Button>
        ) : null}
        {selectedItemCount === 0 && !hasRange && !clipboard?.items.length ? (
          <span className="text-xs text-muted-foreground">
            {formatTimelineWorkbenchToolLabel(resolvedTool)} tool ·{" "}
            {(resolvedSnap.enabled ?? true) ? "Snap on" : "Snap off"} ·{" "}
            {formatTimelineEditorTimeMs(currentTimeMs)} / {formatTimelineEditorTimeMs(durationMs)}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 max-w-full flex-nowrap items-center justify-end gap-2 overflow-x-auto pb-1">
        <Badge variant="outline">{document.tracks.length} tracks</Badge>
        {document.groups?.length ? (
          <Badge variant="outline">{document.groups.length} groups</Badge>
        ) : null}
        {document.itemGroups?.length ? (
          <Badge variant="outline">{document.itemGroups.length} item groups</Badge>
        ) : null}
        <Badge
          variant={overlaps.length > 0 ? "outline" : "secondary"}
          className={cn(overlaps.length > 0 && "border-destructive/60 text-destructive")}
        >
          {overlaps.length} overlaps
        </Badge>
        {announcement ? (
          <span
            data-slot="timeline-workbench-announcement"
            className="max-w-48 truncate text-xs text-muted-foreground"
          >
            {announcement}
          </span>
        ) : null}
        <ActionMenu
          label="More timeline actions"
          align="end"
          items={moreItems}
          trigger={
            <Button type="button" size="sm" variant="outline">
              More
            </Button>
          }
        />
        <TimelineWorkbenchSnapMenu snap={resolvedSnap} onSnapChange={onSnapChange} />
        <TimelineWorkbenchHotkeyMenu
          hotkeys={resolvedHotkeys}
          onHotkeyChange={onHotkeyChange}
          onHotkeysReset={onHotkeysReset}
        />
        <span className="text-xs text-muted-foreground">Zoom</span>
        <Slider
          className="w-32"
          value={[resolvedViewport.pixelsPerSecond]}
          min={timelineEditorMinPixelsPerSecond}
          max={timelineEditorMaxPixelsPerSecond}
          step={4}
          onValueChange={(value) => {
            onViewportChange({
              ...resolvedViewport,
              pixelsPerSecond: value[0] ?? pixelsPerSecond,
            });
          }}
        />
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatTimelineEditorTimeMs(currentTimeMs)} / {formatTimelineEditorTimeMs(durationMs)}
        </span>
        {renderToolbarActions?.(inspectorContext)}
      </div>
    </div>
  );
}

type TimelineWorkbenchHotkeyMenuProps = {
  hotkeys: TimelineEditorHotkeys;
  onHotkeyChange: (id: TimelineWorkbenchHotkeyId, hotkey: string) => void;
  onHotkeysReset: () => void;
};

type TimelineWorkbenchSnapMenuProps = {
  snap: Partial<TimelineEditorSnapOptions>;
  onSnapChange: (snap: Partial<TimelineEditorSnapOptions>) => void;
};

function TimelineWorkbenchSnapMenu({ snap, onSnapChange }: TimelineWorkbenchSnapMenuProps) {
  const targets = snap.targets ?? [];
  const intervalTarget = targets.find((target) => target.type === "interval");
  const customTargetCount = targets.filter((target) => target.type === "custom").length;
  const updateSnap = (patch: Partial<TimelineEditorSnapOptions>) =>
    onSnapChange({ ...snap, ...patch });
  const updateTarget = (
    type: Exclude<TimelineEditorSnapTarget["type"], "custom">,
    enabled: boolean,
  ) => {
    const nextTargets = targets.filter((target) => target.type !== type);

    if (enabled) {
      nextTargets.push(
        type === "interval"
          ? { type: "interval", intervalMs: getTimelineWorkbenchSnapIntervalMs(snap) }
          : { type },
      );
    }

    updateSnap({ targets: nextTargets });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Snap
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0" data-slot="timeline-workbench-snap-menu">
        <PopoverHeader className="border-b border-border">
          <PopoverTitle>Snap</PopoverTitle>
        </PopoverHeader>
        <div className="grid gap-3 p-3 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span>Enabled</span>
            <input
              type="checkbox"
              checked={snap.enabled ?? true}
              onChange={(event) => updateSnap({ enabled: event.currentTarget.checked })}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Threshold px</span>
            <Input
              type="number"
              min={0}
              value={snap.thresholdPx ?? 8}
              onChange={(event) => updateSnap({ thresholdPx: toPositiveNumber(event, 8) })}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Interval ms</span>
            <Input
              type="number"
              min={1}
              value={getTimelineWorkbenchSnapIntervalMs(snap)}
              onChange={(event) => {
                const intervalMs = toPositiveNumber(event, 100);
                updateSnap({
                  targets: targets.map((target) =>
                    target.type === "interval" ? { ...target, intervalMs } : target,
                  ),
                });
              }}
            />
          </label>
          {(["interval", "marker", "item-edge", "playhead"] as const).map((type) => (
            <label key={type} className="flex items-center justify-between gap-3">
              <span>{formatTimelineWorkbenchSnapTarget(type)}</span>
              <input
                type="checkbox"
                checked={targets.some((target) => target.type === type)}
                onChange={(event) => updateTarget(type, event.currentTarget.checked)}
              />
            </label>
          ))}
          {customTargetCount > 0 ? (
            <div className="text-xs text-muted-foreground">{customTargetCount} custom targets</div>
          ) : null}
          {!intervalTarget ? (
            <div className="text-xs text-muted-foreground">Interval target is disabled.</div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimelineWorkbenchHotkeyMenu({
  hotkeys,
  onHotkeyChange,
  onHotkeysReset,
}: TimelineWorkbenchHotkeyMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Hotkeys
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[30rem] overflow-y-auto p-0"
        data-slot="timeline-workbench-hotkeys-menu"
      >
        <PopoverHeader className="border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <PopoverTitle>Hotkeys</PopoverTitle>
            <Button type="button" size="xs" variant="outline" onClick={onHotkeysReset}>
              Reset
            </Button>
          </div>
        </PopoverHeader>
        <div className="grid gap-4 p-3">
          {timelineWorkbenchHotkeyGroups.map((group) => (
            <div key={group.id} className="grid gap-2">
              <div className="text-xs font-medium text-muted-foreground">{group.label}</div>
              <div className="grid gap-1.5">
                {group.hotkeys.map((definition) => {
                  const hotkey = hotkeys[definition.id] ?? "";
                  const conflictLabels = getTimelineWorkbenchHotkeyConflictLabels(
                    definition.id,
                    hotkey,
                    hotkeys,
                  );

                  return (
                    <div
                      key={definition.id}
                      className="grid grid-cols-[minmax(8rem,1fr)_minmax(8rem,11rem)_auto] items-center gap-2"
                    >
                      <label
                        className="truncate text-xs text-foreground"
                        htmlFor={`timeline-hotkey-${definition.id}`}
                      >
                        {definition.label}
                      </label>
                      <div className="grid gap-1">
                        <Input
                          id={`timeline-hotkey-${definition.id}`}
                          aria-label={`${definition.label} hotkey`}
                          className={cn(
                            "h-7 text-xs",
                            conflictLabels.length > 0 && "border-destructive",
                          )}
                          readOnly
                          value={hotkey ? formatShortcutLabel(hotkey) : ""}
                          onKeyDown={(event) => {
                            handleTimelineWorkbenchHotkeyInputKeyDown(
                              event,
                              definition.id,
                              onHotkeyChange,
                            );
                          }}
                        />
                        {conflictLabels.length > 0 ? (
                          <div className="text-[0.6875rem] leading-tight text-destructive">
                            Also {conflictLabels.join(", ")}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        aria-label={`Clear ${definition.label} hotkey`}
                        onClick={() => onHotkeyChange(definition.id, "")}
                      >
                        Clear
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getTimelineWorkbenchSnapIntervalMs(snap: Partial<TimelineEditorSnapOptions>) {
  const intervalTarget = snap.targets?.find((target) => target.type === "interval");

  return intervalTarget?.intervalMs ?? 100;
}

function formatTimelineWorkbenchSnapTarget(
  target: Exclude<TimelineEditorSnapTarget["type"], "custom">,
) {
  if (target === "item-edge") {
    return "Item edges";
  }

  return target[0]!.toUpperCase() + target.slice(1);
}

function toPositiveNumber(event: ChangeEvent<HTMLInputElement>, fallback: number) {
  const value = Number(event.currentTarget.value);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function handleTimelineWorkbenchHotkeyInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  id: TimelineWorkbenchHotkeyId,
  onHotkeyChange: (id: TimelineWorkbenchHotkeyId, hotkey: string) => void,
) {
  if (event.key === "Tab") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const hotkey = getHotkeyFromKeyboardEvent(event);

  if (hotkey) {
    onHotkeyChange(id, hotkey);
  }
}

function getTimelineWorkbenchHotkeyConflictLabels(
  id: TimelineWorkbenchHotkeyId,
  hotkey: string,
  hotkeys: TimelineEditorHotkeys,
) {
  if (!hotkey) {
    return [];
  }

  const normalizedHotkey = hotkey.toLowerCase();

  return timelineWorkbenchHotkeyGroups
    .flatMap((group) => group.hotkeys)
    .filter(
      (definition) =>
        definition.id !== id && (hotkeys[definition.id] ?? "").toLowerCase() === normalizedHotkey,
    )
    .map((definition) => definition.label);
}

function normalizeTimelineWorkbenchToolbarRange(range?: { startMs: number; endMs: number }) {
  if (!range) {
    return undefined;
  }

  return {
    startMs: Math.max(0, Math.min(range.startMs, range.endMs)),
    endMs: Math.max(range.startMs, range.endMs),
  };
}

function formatTimelineWorkbenchToolLabel(tool: TimelineEditorTool) {
  if (tool === "ripple-trim") {
    return "Ripple Trim";
  }

  return tool[0]!.toUpperCase() + tool.slice(1);
}

function formatTimelineWorkbenchFrameStep(frameStepMs: number) {
  if (frameStepMs < 1_000) {
    return `${Math.round(frameStepMs * 100) / 100} ms`;
  }

  return formatTimelineEditorTimeMs(frameStepMs);
}
