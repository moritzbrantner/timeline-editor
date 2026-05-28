import { createElement } from "react";

import type { TimelineEditorExtension } from "./react/workbench/types";
import type { TimelineMediaSourceRef } from "./media-types";
import { formatTimelineEditorTimeMs } from "./time";

export type TimelineTextAlignment =
  | "left"
  | "center"
  | "right"
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type TimelineTextCue = {
  id?: string;
  startMs: number;
  endMs: number;
  text: string;
  layer?: number;
  styleName?: string;
  actor?: string;
  alignment?: TimelineTextAlignment;
  marginLeft?: number;
  marginRight?: number;
  marginVertical?: number;
  overrideText?: string;
  data?: Record<string, unknown>;
};

export type TimelineTextStyle = {
  name: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: TimelineTextAlignment;
  data?: Record<string, unknown>;
};

export type TimelineTextItemData = {
  mediaType: "text";
  format?: "plain" | "ass-like";
  text?: string;
  cues?: TimelineTextCue[];
  styles?: TimelineTextStyle[];
  language?: string;
  source?: TimelineMediaSourceRef;
};

export type { TimelineMediaSourceRef } from "./media-types";

export function getTimelineTextCueAt(
  data: TimelineTextItemData | undefined,
  offsetMs: number,
): TimelineTextCue | undefined {
  return data?.cues
    ?.filter((cue) => cue.startMs <= offsetMs && cue.endMs >= offsetMs)
    .sort((left, right) => (left.layer ?? 0) - (right.layer ?? 0) || left.startMs - right.startMs)
    .at(-1);
}

export function getTimelineTextDisplayText(
  data: TimelineTextItemData | undefined,
  fallback: string,
  offsetMs?: number,
) {
  const activeCue =
    offsetMs === undefined ? undefined : getTimelineTextCueAt(data, Math.max(0, offsetMs));
  const cue = activeCue ?? data?.cues?.[0];

  return cue?.overrideText ?? cue?.text ?? data?.text ?? data?.source?.label ?? fallback;
}

export function createTimelineTextExtension(): TimelineEditorExtension<TimelineTextItemData> {
  return {
    id: "timeline-text",
    itemKinds: ["text", "caption", "subtitle"],
    mediaTypes: ["text"],
    renderItem: ({ item }) =>
      createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement(
          "span",
          { className: "truncate italic" },
          getTimelineTextDisplayText(item.data, item.label),
        ),
        item.data?.language
          ? createElement(
              "span",
              { className: "truncate text-[10px] uppercase tracking-normal text-white/70" },
              item.data.language,
            )
          : null,
      ),
    renderPreview: ({ currentTimeMs, items }) =>
      createElement(
        "div",
        { className: "grid w-full max-w-xl gap-2 text-white" },
        items.map((item) => {
          const offsetMs = currentTimeMs - item.startMs;
          const cue = getTimelineTextCueAt(item.data, offsetMs);
          const text = getTimelineTextDisplayText(item.data, item.label, offsetMs);

          return createElement(
            "div",
            {
              key: item.id,
              "data-slot": "timeline-media-text-cue",
              className: "grid gap-1 rounded border border-white/10 bg-white/10 px-3 py-2",
            },
            createElement("div", { className: "text-sm font-medium" }, text),
            cue
              ? createElement(
                  "div",
                  { className: "text-xs text-white/60" },
                  `${formatTimelineEditorTimeMs(cue.startMs)} - ${formatTimelineEditorTimeMs(cue.endMs)}`,
                )
              : null,
          );
        }),
      ),
  };
}
