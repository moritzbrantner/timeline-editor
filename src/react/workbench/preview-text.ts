import { useEffect, useState, type CSSProperties } from "react";

import {
  parseTimelineText,
  type TimelineTextAlignment,
  type TimelineTextCue,
  type TimelineTextItemData,
  type TimelineTextParseResult,
  type TimelineTextStyle,
} from "../../text";

type TimelineWorkbenchParsedTextSourceState = {
  status: "idle" | "loading" | "ready" | "failed";
  result?: TimelineTextParseResult;
};

const maxTimelineWorkbenchTextSourceCacheEntries = 32;
const timelineWorkbenchTextSourceCache = new Map<string, TimelineTextParseResult>();

export function useTimelineWorkbenchParsedTextSource(
  sourceUri: string | undefined,
  data: TimelineTextItemData | undefined,
) {
  const cacheKey = sourceUri
    ? [sourceUri, data?.format ?? "", data?.source?.mimeType ?? ""].join("|")
    : undefined;
  const [state, setState] = useState<TimelineWorkbenchParsedTextSourceState>(() => {
    const cached = cacheKey ? timelineWorkbenchTextSourceCache.get(cacheKey) : undefined;

    return cached ? { status: "ready", result: cached } : { status: "idle" };
  });

  useEffect(() => {
    if (!sourceUri || !cacheKey) {
      setState({ status: "idle" });
      return;
    }

    const cached = timelineWorkbenchTextSourceCache.get(cacheKey);

    if (cached) {
      setState({ status: "ready", result: cached });
      return;
    }

    if (typeof fetch !== "function") {
      setState({ status: "failed" });
      return;
    }

    let cancelled = false;

    setState({ status: "loading" });
    void fetch(sourceUri)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Subtitle source request failed with status ${response.status}.`);
        }

        return response.text();
      })
      .then((text) => {
        const result = parseTimelineText(text, {
          format: data?.format,
          sourceLabel: data?.source?.label ?? sourceUri,
          mimeType: data?.source?.mimeType,
        });

        if (cancelled) {
          return;
        }

        timelineWorkbenchTextSourceCache.set(cacheKey, result);

        while (timelineWorkbenchTextSourceCache.size > maxTimelineWorkbenchTextSourceCacheEntries) {
          const oldestKey = timelineWorkbenchTextSourceCache.keys().next().value;

          if (!oldestKey) {
            break;
          }

          timelineWorkbenchTextSourceCache.delete(oldestKey);
        }

        setState({ status: "ready", result });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "failed" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, data?.format, data?.source?.label, data?.source?.mimeType, sourceUri]);

  return state;
}

export function getTimelineWorkbenchSubtitlePlacementStyle(
  cue: TimelineTextCue,
  style: TimelineTextStyle | undefined,
): CSSProperties {
  const alignment = cue.alignment ?? style?.alignment ?? "bottom-center";
  const [vertical, horizontal] = getTimelineWorkbenchTextAlignmentParts(alignment);
  const marginLeft = cue.marginLeft ?? style?.marginLeft ?? 16;
  const marginRight = cue.marginRight ?? style?.marginRight ?? 16;
  const marginVertical = cue.marginVertical ?? style?.marginVertical ?? 16;

  if (cue.positionX !== undefined || cue.positionY !== undefined) {
    return {
      left: `${cue.positionX ?? 50}%`,
      maxWidth: "80%",
      textAlign: getTimelineWorkbenchSubtitleTextAlign(horizontal),
      top: `${cue.positionY ?? 90}%`,
      transform: "translate(-50%, -50%)",
    };
  }

  return {
    bottom: vertical === "bottom" ? marginVertical : undefined,
    justifyItems: getTimelineWorkbenchSubtitleJustifyItems(horizontal),
    left: marginLeft,
    right: marginRight,
    textAlign: getTimelineWorkbenchSubtitleTextAlign(horizontal),
    top: vertical === "middle" ? "50%" : vertical === "top" ? marginVertical : undefined,
    transform: vertical === "middle" ? "translateY(-50%)" : undefined,
  };
}

export function getTimelineWorkbenchSubtitleCueStyle(
  cue: TimelineTextCue,
  style: TimelineTextStyle | undefined,
): CSSProperties {
  const shadowColor =
    cue.shadowColor ?? style?.shadowColor ?? cue.outlineColor ?? style?.outlineColor;

  return {
    backgroundColor: cue.backgroundColor ?? style?.backgroundColor,
    color: cue.color ?? style?.color,
    fontFamily: cue.fontFamily ?? style?.fontFamily,
    fontSize: cue.fontSize ?? style?.fontSize,
    fontStyle: (cue.italic ?? style?.italic) ? "italic" : undefined,
    fontWeight: (cue.bold ?? style?.bold) ? 700 : undefined,
    textDecoration: (cue.underline ?? style?.underline) ? "underline" : undefined,
    textShadow: shadowColor
      ? `0 1px 2px ${shadowColor}, 1px 0 2px ${shadowColor}, -1px 0 2px ${shadowColor}`
      : undefined,
  };
}

function getTimelineWorkbenchTextAlignmentParts(alignment: TimelineTextAlignment) {
  if (alignment.startsWith("top-")) {
    return ["top", alignment.slice(4)] as const;
  }

  if (alignment.startsWith("middle-")) {
    return ["middle", alignment.slice(7)] as const;
  }

  if (alignment.startsWith("bottom-")) {
    return ["bottom", alignment.slice(7)] as const;
  }

  return ["bottom", alignment] as const;
}

function getTimelineWorkbenchSubtitleJustifyItems(horizontal: string) {
  return horizontal === "left" ? "start" : horizontal === "right" ? "end" : "center";
}

function getTimelineWorkbenchSubtitleTextAlign(horizontal: string) {
  return horizontal === "left" ? "left" : horizontal === "right" ? "right" : "center";
}
