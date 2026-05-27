import { createElement } from "react";

import type { TimelineEditorExtension } from "./react/workbench/types";
import type { TimelineMediaDisplayRange, TimelineMediaSourceRef } from "./media-types";

export type TimelineAudioItemData = TimelineMediaDisplayRange & {
  mediaType: "audio";
  source?: TimelineMediaSourceRef;
  volume?: number;
  muted?: boolean;
  channels?: number;
  sampleRate?: number;
  waveform?: number[];
  color?: string;
  data?: Record<string, unknown>;
};

export type { TimelineMediaDisplayRange, TimelineMediaSourceRef } from "./media-types";

export function createTimelineAudioExtension(): TimelineEditorExtension<TimelineAudioItemData> {
  return {
    id: "timeline-audio",
    itemKinds: ["audio"],
    renderItem: ({ item }) =>
      createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement("span", { className: "truncate" }, item.label),
        createElement(
          "span",
          { className: "flex min-w-0 items-center gap-1 text-[10px] text-white/70" },
          item.data?.source?.label
            ? createElement("span", { className: "truncate" }, item.data.source.label)
            : null,
          getTimelineAudioStateLabel(item.data)
            ? createElement(
                "span",
                { className: "shrink-0" },
                getTimelineAudioStateLabel(item.data),
              )
            : null,
        ),
        item.data?.waveform?.length
          ? createTimelineAudioWaveform(item.data.waveform, item.data.color)
          : null,
      ),
  };
}

function getTimelineAudioStateLabel(data: TimelineAudioItemData | undefined) {
  if (!data) {
    return undefined;
  }

  if (data.muted) {
    return "Muted";
  }

  return data.volume === undefined ? undefined : `${Math.round(data.volume * 100)}%`;
}

function createTimelineAudioWaveform(waveform: number[], color?: string) {
  return createElement(
    "span",
    {
      "aria-hidden": true,
      "data-slot": "timeline-media-audio-waveform",
      className: "flex h-3 items-end gap-px",
    },
    waveform.slice(0, 48).map((value, index) =>
      createElement("span", {
        key: index,
        className: "w-px rounded bg-white/70",
        style: {
          backgroundColor: color,
          height: `${Math.max(2, Math.round(Math.max(0, Math.min(1, value)) * 12))}px`,
        },
      }),
    ),
  );
}
