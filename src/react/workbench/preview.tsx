"use client";

import { useMemo, useRef } from "react";

import { ToggleGroup, ToggleGroupItem } from "@moritzbrantner/ui";

import {
  formatTimelineEditorTimeMs,
  getTimelineEditorItemEndMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorTimeRange,
  type TimelineEditorTrack,
} from "../../core";
import { findTimelineEditorExtensionForItem } from "../../extensions";
import { getTimelineMediaTypeForItem } from "../../media-types";
import {
  getTimelineTextCuesAt,
  getTimelineTextStyleForCue,
  type TimelineTextItemData,
} from "../../text";
import type {
  TimelineEditorExtension,
  TimelinePreviewTransportContext,
  TimelineWorkbenchMediaErrorCode,
  TimelineWorkbenchMediaStatus,
  TimelineWorkbenchPreviewMode,
} from "./types";
import { getTimelineWorkbenchPreviewItems, TimelineWorkbenchMiniPreview } from "./preview-mini";
import {
  getTimelineWorkbenchSceneMediaPreloads,
  TimelineWorkbenchSceneMediaPreloads,
} from "./preview-media-preloads";
import {
  getTimelineWorkbenchSubtitleCueStyle,
  getTimelineWorkbenchSubtitlePlacementStyle,
  useTimelineWorkbenchParsedTextSource,
} from "./preview-text";
import {
  getBooleanField,
  getNumberField,
  getStringField,
  getTimelineWorkbenchItemData,
  getTimelineWorkbenchObjectFit,
  getTimelineWorkbenchSourceUri,
  isTimelineWorkbenchKnownSceneItem,
} from "./preview-utils";
import {
  useTimelineWorkbenchMediaElementStatus,
  useTimelineWorkbenchSynchronizedMediaElement,
} from "./use-synchronized-media";

type TimelineWorkbenchPreviewProps<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
> = {
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  extensions?: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>;
  mode: TimelineWorkbenchPreviewMode;
  loopRange?: TimelineEditorTimeRange;
  readOnly: boolean;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  transport: TimelinePreviewTransportContext;
  onModeChange: (mode: TimelineWorkbenchPreviewMode) => void;
};

export function TimelineWorkbenchPreview<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>({
  currentTimeMs,
  document,
  durationMs,
  extensions = [],
  loopRange,
  mode,
  readOnly: _readOnly,
  selectedItems,
  transport,
  onModeChange,
}: TimelineWorkbenchPreviewProps<TTrackData, TItemData, TAssetData>) {
  const activeItems = document.tracks.flatMap((track) =>
    track.items
      .filter(
        (item) =>
          item.startMs <= currentTimeMs && getTimelineEditorItemEndMs(item) >= currentTimeMs,
      )
      .map((item) => ({ item, track })),
  );
  const previewItems = getTimelineWorkbenchPreviewItems(mode, document, selectedItems, activeItems);
  const progress =
    durationMs > 0 ? Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100)) : 0;

  return (
    <div
      data-slot="timeline-workbench-preview"
      className="grid h-full min-w-0 overflow-hidden p-0"
      style={{ gridTemplateRows: "auto minmax(0, 1fr)" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">Preview</div>
          <div className="text-xs tabular-nums text-muted-foreground">
            {formatTimelineEditorTimeMs(currentTimeMs)}
          </div>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <ToggleGroup
            type="single"
            value={mode}
            aria-label="Preview mode"
            onValueChange={(value) => {
              if (value) {
                onModeChange(value as TimelineWorkbenchPreviewMode);
              }
            }}
          >
            <ToggleGroupItem value="active-scene" size="sm" aria-label="Scene">
              Scene
            </ToggleGroupItem>
            <ToggleGroupItem value="selection-first" size="sm" aria-label="Selection">
              Selection
            </ToggleGroupItem>
            <ToggleGroupItem value="mini-timeline" size="sm" aria-label="Timeline">
              Timeline
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div className="relative min-h-0 overflow-hidden bg-zinc-950">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-zinc-800">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        {mode === "mini-timeline" ? (
          <TimelineWorkbenchMiniPreview
            currentTimeMs={currentTimeMs}
            document={document}
            durationMs={durationMs}
          />
        ) : (
          <TimelineWorkbenchScenePreview
            currentTimeMs={currentTimeMs}
            document={document}
            durationMs={durationMs}
            extensions={extensions}
            items={previewItems}
            loopRange={loopRange}
            selectedItems={selectedItems}
            transport={transport}
          />
        )}
      </div>
    </div>
  );
}

function TimelineWorkbenchScenePreview<TTrackData extends Record<string, unknown>, TItemData>({
  currentTimeMs,
  document,
  durationMs,
  extensions,
  items,
  loopRange,
  selectedItems,
  transport,
}: {
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, unknown>>;
  items: Array<{
    item: TimelineEditorItem<TItemData>;
    track?: TimelineEditorTrack<TTrackData, TItemData>;
  }>;
  loopRange?: TimelineEditorTimeRange;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  transport: TimelinePreviewTransportContext;
}) {
  const mediaPreloads = getTimelineWorkbenchSceneMediaPreloads(
    document as TimelineEditorDocument<Record<string, unknown>, unknown>,
    currentTimeMs,
    loopRange,
  );
  const sceneItems = items.filter(({ item }) => isTimelineWorkbenchKnownSceneItem(item));
  const visualItems = sceneItems.filter(({ item }) => {
    const mediaType = getTimelineMediaTypeForItem(item as TimelineEditorItem<unknown>);

    return mediaType === "video" || mediaType === "image" || mediaType === "text";
  });
  const audioItems = sceneItems.filter(({ item }) => {
    const mediaType = getTimelineMediaTypeForItem(item as TimelineEditorItem<unknown>);

    return mediaType === "audio";
  });
  const unknownItems = items.filter(({ item }) => !isTimelineWorkbenchKnownSceneItem(item));
  const extension = getTimelineWorkbenchPreviewExtension(
    unknownItems.map(({ item }) => item),
    extensions,
  );
  const extensionPreview =
    unknownItems.length > 0
      ? extension?.renderPreview?.({
          currentTimeMs,
          document: document as TimelineEditorDocument<Record<string, unknown>, TItemData>,
          durationMs,
          items: unknownItems.map(({ item }) => item),
          selectedItems,
          transport,
        })
      : null;
  if (items.length === 0) {
    const emptyState = getTimelineWorkbenchPreviewEmptyState(document, currentTimeMs);

    return (
      <>
        <TimelineWorkbenchSceneMediaPreloads preloads={mediaPreloads} />
        <div className="grid h-full place-items-center p-4">
          <div className="grid gap-1 text-center text-white">
            <div className="text-sm font-medium">No active scene items</div>
            <div className="text-xs text-white/60">
              {formatTimelineEditorTimeMs(currentTimeMs)} / {formatTimelineEditorTimeMs(durationMs)}
            </div>
            <div className="text-xs text-white/70">{emptyState}</div>
          </div>
        </div>
      </>
    );
  }

  if (sceneItems.length === 0 && extensionPreview) {
    return (
      <>
        <TimelineWorkbenchSceneMediaPreloads preloads={mediaPreloads} />
        {extensionPreview}
      </>
    );
  }

  return (
    <div data-slot="timeline-workbench-scene-preview" className="relative h-full w-full text-white">
      <TimelineWorkbenchSceneMediaPreloads preloads={mediaPreloads} />
      {visualItems.map(({ item, track }, index) => (
        <TimelineWorkbenchSceneLayer
          key={item.id}
          currentTimeMs={currentTimeMs}
          item={item as TimelineEditorItem<unknown>}
          showSourceFailureState={visualItems.length === 1 && unknownItems.length === 0}
          trackLabel={track?.label}
          transport={transport}
          zIndex={index + 1}
        />
      ))}
      {audioItems.map(({ item }) => (
        <TimelineWorkbenchSceneAudio
          key={item.id}
          currentTimeMs={currentTimeMs}
          item={item as TimelineEditorItem<unknown>}
          transport={transport}
        />
      ))}
      {visualItems.length === 0 && unknownItems.length === 0 ? (
        <div className="grid h-full place-items-center p-4">
          <div className="grid w-full max-w-md gap-2">
            {items.slice(0, 4).map(({ item, track }) => (
              <TimelineWorkbenchFallbackItemCard
                key={item.id}
                item={item}
                trackLabel={track?.label}
              />
            ))}
          </div>
        </div>
      ) : null}
      {unknownItems.length > 0 ? (
        <div className="absolute inset-x-4 bottom-4 z-50 grid max-h-40 gap-2 overflow-auto">
          {extensionPreview ?? (
            <>
              {unknownItems.slice(0, 4).map(({ item, track }) => (
                <TimelineWorkbenchFallbackItemCard
                  key={item.id}
                  item={item}
                  trackLabel={track?.label}
                />
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TimelineWorkbenchSceneLayer({
  currentTimeMs,
  item,
  showSourceFailureState,
  trackLabel,
  transport,
  zIndex,
}: {
  currentTimeMs: number;
  item: TimelineEditorItem<unknown>;
  showSourceFailureState: boolean;
  trackLabel?: string;
  transport: TimelinePreviewTransportContext;
  zIndex: number;
}) {
  const mediaType = getTimelineMediaTypeForItem(item);
  const data = getTimelineWorkbenchItemData(item);

  if (mediaType === "video") {
    return (
      <TimelineWorkbenchSceneVideo
        currentTimeMs={currentTimeMs}
        item={item}
        transport={transport}
        zIndex={zIndex}
      />
    );
  }

  if (mediaType === "image") {
    const sourceUri = getTimelineWorkbenchSourceUri(data) ?? getStringField(data, "src");

    return sourceUri ? (
      <img
        alt={getStringField(data, "alt") ?? item.label}
        data-slot="timeline-workbench-scene-image"
        className="absolute inset-0 h-full w-full"
        src={sourceUri}
        style={{ objectFit: getTimelineWorkbenchObjectFit(data), zIndex }}
      />
    ) : (
      <TimelineWorkbenchSourceState item={item} label="No image source" zIndex={zIndex} />
    );
  }

  if (mediaType === "text") {
    return (
      <TimelineWorkbenchSceneText
        currentTimeMs={currentTimeMs}
        item={item}
        showSourceFailureState={showSourceFailureState}
        zIndex={zIndex}
      />
    );
  }

  return <TimelineWorkbenchFallbackItemCard item={item} trackLabel={trackLabel} />;
}

function TimelineWorkbenchSceneText({
  currentTimeMs,
  item,
  showSourceFailureState,
  zIndex,
}: {
  currentTimeMs: number;
  item: TimelineEditorItem<unknown>;
  showSourceFailureState: boolean;
  zIndex: number;
}) {
  const data = getTimelineWorkbenchItemData(item) as TimelineTextItemData | undefined;
  const sourceUri = getTimelineWorkbenchSourceUri(data);
  const shouldFetchSource = Boolean(sourceUri && !data?.cues?.length && !data?.text);
  const parsedSource = useTimelineWorkbenchParsedTextSource(
    shouldFetchSource ? sourceUri : undefined,
    data,
  );
  const displayData = useMemo<TimelineTextItemData | undefined>(() => {
    if (data?.cues?.length) {
      return data;
    }

    if (data?.text) {
      return {
        ...data,
        cues: [{ startMs: 0, endMs: Math.max(1, item.durationMs), text: data.text }],
      };
    }

    if (parsedSource.result) {
      return {
        ...data,
        mediaType: "text",
        format: parsedSource.result.format,
        cues: parsedSource.result.cues,
        styles: parsedSource.result.styles,
      };
    }

    return data;
  }, [data, item.durationMs, parsedSource.result]);
  const cues = getTimelineTextCuesAt(displayData, Math.max(0, currentTimeMs - item.startMs));

  if (cues.length === 0) {
    if (showSourceFailureState && parsedSource.status === "failed") {
      return (
        <TimelineWorkbenchSourceState
          item={item}
          label="Subtitle source unavailable"
          zIndex={zIndex}
        />
      );
    }

    return null;
  }

  return (
    <div
      data-slot="timeline-workbench-scene-subtitles"
      data-subtitle-format={displayData?.format}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex }}
    >
      {cues.map((cue, index) => {
        const style = getTimelineTextStyleForCue(displayData, cue);

        return (
          <div
            key={cue.id ?? `${cue.startMs}-${cue.endMs}-${index}`}
            data-slot="timeline-workbench-scene-subtitle-cue"
            data-subtitle-style={cue.styleName}
            className="absolute grid px-3"
            style={getTimelineWorkbenchSubtitlePlacementStyle(cue, style)}
          >
            <div
              className="max-w-[80vw] rounded bg-black/70 px-3 py-2 text-center text-sm leading-snug text-white shadow whitespace-pre-line"
              style={getTimelineWorkbenchSubtitleCueStyle(cue, style)}
            >
              {cue.overrideText ?? cue.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineWorkbenchSceneVideo({
  currentTimeMs,
  item,
  transport,
  zIndex,
}: {
  currentTimeMs: number;
  item: TimelineEditorItem<unknown>;
  transport: TimelinePreviewTransportContext;
  zIndex: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const data = getTimelineWorkbenchItemData(item);
  const sourceUri = getTimelineWorkbenchSourceUri(data);
  const mediaStatus = useTimelineWorkbenchMediaElementStatus(videoRef, sourceUri);
  const sync = useTimelineWorkbenchSynchronizedMediaElement({
    elementRef: videoRef,
    item,
    transport,
    currentTimeMs,
    sourceStartMs: getNumberField(data, "sourceStartMs"),
    sourceEndMs: getNumberField(data, "sourceEndMs"),
    muted: getBooleanField(data, "muted"),
    volume: getNumberField(data, "volume"),
  });

  if (!sourceUri) {
    return <TimelineWorkbenchSourceState item={item} label="No video source" zIndex={zIndex} />;
  }

  return (
    <>
      <video
        ref={videoRef}
        data-slot="timeline-workbench-scene-video"
        className="absolute inset-0 h-full w-full"
        muted={getBooleanField(data, "muted")}
        playsInline
        poster={getStringField(data, "poster")}
        preload="auto"
        src={sourceUri}
        style={{ objectFit: getTimelineWorkbenchObjectFit(data), zIndex }}
      />
      <TimelineWorkbenchMediaStateOverlay
        blocked={sync.blocked}
        errorCode={mediaStatus.errorCode}
        item={item}
        status={mediaStatus.status}
        zIndex={zIndex + 1}
      />
    </>
  );
}

function TimelineWorkbenchSceneAudio({
  currentTimeMs,
  item,
  transport,
}: {
  currentTimeMs: number;
  item: TimelineEditorItem<unknown>;
  transport: TimelinePreviewTransportContext;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const data = getTimelineWorkbenchItemData(item);
  const sourceUri = getTimelineWorkbenchSourceUri(data);
  const mediaStatus = useTimelineWorkbenchMediaElementStatus(audioRef, sourceUri);
  const sync = useTimelineWorkbenchSynchronizedMediaElement({
    elementRef: audioRef,
    item,
    transport,
    currentTimeMs,
    sourceStartMs: getNumberField(data, "sourceStartMs"),
    sourceEndMs: getNumberField(data, "sourceEndMs"),
    muted: getBooleanField(data, "muted"),
    volume: getNumberField(data, "volume"),
  });

  if (!sourceUri) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioRef}
        data-slot="timeline-workbench-scene-audio"
        muted={getBooleanField(data, "muted")}
        preload="auto"
        src={sourceUri}
      />
      <TimelineWorkbenchMediaStateOverlay
        audio
        blocked={sync.blocked}
        errorCode={mediaStatus.errorCode}
        item={item}
        status={mediaStatus.status}
        zIndex={50}
      />
    </>
  );
}

function TimelineWorkbenchMediaStateOverlay({
  audio = false,
  blocked,
  errorCode,
  item,
  status,
  zIndex,
}: {
  audio?: boolean;
  blocked?: boolean;
  errorCode?: TimelineWorkbenchMediaErrorCode;
  item: TimelineEditorItem<unknown>;
  status: TimelineWorkbenchMediaStatus;
  zIndex: number;
}) {
  const message = getTimelineWorkbenchMediaStateMessage(status, errorCode, blocked);

  if (!message) {
    return null;
  }

  return (
    <div
      data-slot={blocked ? "timeline-media-playback-blocked" : "timeline-media-state"}
      className={
        audio
          ? "absolute right-3 top-3 rounded bg-black/70 px-2 py-1 text-xs"
          : "absolute right-3 top-3 max-w-56 truncate rounded bg-black/70 px-2 py-1 text-xs"
      }
      title={`${item.label}: ${message}`}
      style={{ zIndex }}
    >
      {message}
    </div>
  );
}

function getTimelineWorkbenchMediaStateMessage(
  status: TimelineWorkbenchMediaStatus,
  errorCode: TimelineWorkbenchMediaErrorCode | undefined,
  blocked?: boolean,
) {
  if (blocked || status === "blocked") {
    return "Playback blocked";
  }

  if (status === "stalled") {
    return "Media stalled";
  }

  if (status === "error") {
    if (errorCode === "decode-failed" || errorCode === "unsupported-source") {
      return "Unsupported or corrupt media";
    }

    return "Media source unavailable";
  }

  return undefined;
}

function TimelineWorkbenchSourceState({
  item,
  label,
  zIndex,
}: {
  item: TimelineEditorItem<unknown>;
  label: string;
  zIndex: number;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center p-4" style={{ zIndex }}>
      <div className="grid gap-1 text-center text-white">
        <div className="text-sm font-medium">{item.label}</div>
        <div className="text-xs text-white/60">{label}</div>
      </div>
    </div>
  );
}

function TimelineWorkbenchFallbackItemCard<TItemData>({
  item,
  trackLabel,
}: {
  item: TimelineEditorItem<TItemData>;
  trackLabel?: string;
}) {
  return (
    <div
      className="grid min-h-12 gap-1 rounded border border-white/10 bg-white/10 px-3 py-2 text-white shadow-sm"
      style={{
        borderLeftColor: item.color ?? "hsl(var(--primary))",
        borderLeftWidth: 4,
      }}
    >
      <div className="truncate text-sm font-medium">{item.label}</div>
      <div className="truncate text-xs text-white/60">{trackLabel ?? item.kind ?? item.id}</div>
    </div>
  );
}

function getTimelineWorkbenchPreviewEmptyState<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  currentTimeMs: number,
) {
  const sceneEntries = document.tracks.flatMap((track) =>
    track.items
      .filter((item) => isTimelineWorkbenchKnownSceneItem(item))
      .map((item) => ({ item, track })),
  );
  const futureEntry = sceneEntries
    .filter(({ item }) => item.startMs > currentTimeMs)
    .sort((left, right) => left.item.startMs - right.item.startMs)[0];
  const previousEntry = sceneEntries
    .filter(({ item }) => getTimelineEditorItemEndMs(item) < currentTimeMs)
    .sort(
      (left, right) =>
        getTimelineEditorItemEndMs(right.item) - getTimelineEditorItemEndMs(left.item),
    )[0];

  if (futureEntry) {
    return `Next ${futureEntry.item.label} at ${formatTimelineEditorTimeMs(futureEntry.item.startMs)}`;
  }

  if (previousEntry) {
    return `Previous ${previousEntry.item.label} ended at ${formatTimelineEditorTimeMs(
      getTimelineEditorItemEndMs(previousEntry.item),
    )}`;
  }

  const itemCount = document.tracks.reduce((count, track) => count + track.items.length, 0);

  return `${document.tracks.length} ${document.tracks.length === 1 ? "track" : "tracks"} · ${itemCount} ${
    itemCount === 1 ? "item" : "items"
  }`;
}

function getTimelineWorkbenchPreviewExtension<
  TItemData,
  TTrackData extends Record<string, unknown>,
  TAssetData,
>(
  items: Array<TimelineEditorItem<TItemData>>,
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>,
) {
  for (const item of items) {
    const extension = findTimelineEditorExtensionForItem(item, extensions, {
      predicate: (candidate) => Boolean(candidate.renderPreview),
    });

    if (extension) {
      return extension;
    }
  }

  return undefined;
}
