"use client";

import { useEffect, useRef } from "react";

import {
  getTimelineEditorItemEndMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorTimeRange,
} from "../../core";
import { getTimelineMediaTypeForItem } from "../../media-types";
import {
  getNumberField,
  getStringField,
  getTimelineWorkbenchItemData,
  getTimelineWorkbenchSourceUri,
} from "./preview-utils";

type TimelineWorkbenchSceneMediaPreload = {
  key: string;
  mediaType: "audio" | "video";
  item: TimelineEditorItem<unknown>;
  muted?: boolean;
  poster?: string;
  sourceEndMs?: number;
  sourceStartMs?: number;
  src: string;
  targetTimeMs: number;
};

const mediaPreloadLookaheadMs = 2_000;
const mediaPreloadBeforeCursorMs = 250;
const maxTimelineWorkbenchSceneMediaPreloads = 24;

export function TimelineWorkbenchSceneMediaPreloads({
  preloads,
}: {
  preloads: TimelineWorkbenchSceneMediaPreload[];
}) {
  return (
    <>
      {preloads.map((preload) => (
        <TimelineWorkbenchSceneMediaPreloadElement key={preload.key} preload={preload} />
      ))}
    </>
  );
}

function TimelineWorkbenchSceneMediaPreloadElement({
  preload,
}: {
  preload: TimelineWorkbenchSceneMediaPreload;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const targetLocalTimeSeconds =
    getTimelineWorkbenchPreloadLocalTimeMs(preload.item, preload.targetTimeMs, {
      sourceEndMs: preload.sourceEndMs,
      sourceStartMs: preload.sourceStartMs ?? 0,
    }) / 1_000;

  useEffect(() => {
    const element = mediaRef.current;

    if (!element) {
      return;
    }

    const seekToTarget = () => {
      if (!Number.isFinite(targetLocalTimeSeconds)) {
        return;
      }

      try {
        if (Math.abs(element.currentTime - targetLocalTimeSeconds) > 0.05) {
          element.currentTime = targetLocalTimeSeconds;
        }
      } catch {
        // Some media sources cannot seek until enough metadata has loaded.
      }
    };

    if (element.readyState >= 1) {
      seekToTarget();
    }

    element.addEventListener("loadedmetadata", seekToTarget);
    element.addEventListener("canplay", seekToTarget);

    return () => {
      element.removeEventListener("loadedmetadata", seekToTarget);
      element.removeEventListener("canplay", seekToTarget);
    };
  }, [targetLocalTimeSeconds]);

  const sharedProps = {
    "aria-hidden": "true",
    "data-media-type": preload.mediaType,
    "data-slot": "timeline-workbench-scene-media-preload",
    muted: preload.muted ?? true,
    preload: "auto",
    src: preload.src,
    style: {
      height: 1,
      left: 0,
      opacity: 0,
      pointerEvents: "none",
      position: "absolute",
      top: 0,
      width: 1,
    },
    tabIndex: -1,
  } as const;

  if (preload.mediaType === "video") {
    return (
      <video
        ref={(element) => {
          mediaRef.current = element;
        }}
        {...sharedProps}
        playsInline
        poster={preload.poster}
      />
    );
  }

  return (
    <audio
      ref={(element) => {
        mediaRef.current = element;
      }}
      {...sharedProps}
    />
  );
}

export function getTimelineWorkbenchSceneMediaPreloads(
  document: TimelineEditorDocument<Record<string, unknown>, unknown>,
  currentTimeMs: number,
  loopRange: TimelineEditorTimeRange | undefined,
): TimelineWorkbenchSceneMediaPreload[] {
  const ranges = [
    {
      id: "cursor",
      order: 0,
      startMs: Math.max(0, currentTimeMs - mediaPreloadBeforeCursorMs),
      endMs: Math.max(0, currentTimeMs + mediaPreloadLookaheadMs),
      targetTimeMs: Math.max(0, currentTimeMs),
    },
  ];

  if (loopRange && loopRange.endMs > loopRange.startMs) {
    ranges.push({
      id: "loop",
      order: 1,
      startMs: Math.max(0, loopRange.startMs),
      endMs: Math.max(0, Math.min(loopRange.endMs, loopRange.startMs + mediaPreloadLookaheadMs)),
      targetTimeMs: Math.max(0, loopRange.startMs),
    });
  }

  const seen = new Set<string>();
  const preloads: Array<
    TimelineWorkbenchSceneMediaPreload & { order: number; rangeOrder: number }
  > = [];
  let order = 0;

  for (const track of document.tracks) {
    for (const item of track.items) {
      const mediaType = getTimelineMediaTypeForItem(item as TimelineEditorItem<unknown>);

      if (mediaType !== "audio" && mediaType !== "video") {
        order += 1;
        continue;
      }

      const data = getTimelineWorkbenchItemData(item as TimelineEditorItem<unknown>);
      const src = getTimelineWorkbenchSourceUri(data);

      if (!src) {
        order += 1;
        continue;
      }

      const itemEndMs = getTimelineEditorItemEndMs(item);

      for (const range of ranges) {
        if (range.endMs < item.startMs || range.startMs > itemEndMs) {
          continue;
        }

        const key = `${range.id}:${item.id}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        preloads.push({
          key,
          item: item as TimelineEditorItem<unknown>,
          mediaType,
          muted: true,
          order,
          poster: mediaType === "video" ? getStringField(data, "poster") : undefined,
          rangeOrder: range.order,
          sourceEndMs: getNumberField(data, "sourceEndMs"),
          sourceStartMs: getNumberField(data, "sourceStartMs"),
          src,
          targetTimeMs: Math.max(item.startMs, Math.min(itemEndMs, range.targetTimeMs)),
        });
      }

      order += 1;
    }
  }

  return preloads
    .sort((a, b) => {
      if (a.rangeOrder !== b.rangeOrder) {
        return a.rangeOrder - b.rangeOrder;
      }

      if (a.targetTimeMs !== b.targetTimeMs) {
        return a.targetTimeMs - b.targetTimeMs;
      }

      return a.order - b.order;
    })
    .slice(0, maxTimelineWorkbenchSceneMediaPreloads)
    .map(({ order: _order, rangeOrder: _rangeOrder, ...preload }) => preload);
}

function getTimelineWorkbenchPreloadLocalTimeMs(
  item: TimelineEditorItem<unknown>,
  currentTimeMs: number,
  options: { sourceStartMs: number; sourceEndMs?: number },
) {
  const unclampedLocalTimeMs = currentTimeMs - item.startMs + options.sourceStartMs;
  const lowerBoundMs = Math.max(0, options.sourceStartMs);
  const resolvedUpperBoundMs = options.sourceEndMs ?? lowerBoundMs + item.durationMs;
  const upperBoundMs = Math.max(lowerBoundMs, resolvedUpperBoundMs);

  return Math.max(lowerBoundMs, Math.min(upperBoundMs, unclampedLocalTimeMs));
}
