import { createElement } from "react";

import type { TimelineEditorExtension } from "@moritzbrantner/timeline-editor";

export type TimelineAudioItemData = {
  sourceLabel?: string;
  volume?: number;
  muted?: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
  waveform?: number[];
};

export function createTimelineAudioExtension(): TimelineEditorExtension<TimelineAudioItemData> {
  return {
    id: "timeline-audio",
    itemKinds: ["audio"],
    renderItem: ({ item }) => {
      const waveform = item.data?.waveform;

      return createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement("span", { className: "truncate" }, item.label),
        waveform && waveform.length > 0
          ? createElement(
              "span",
              { "aria-hidden": true, className: "flex h-3 items-end gap-px" },
              waveform.slice(0, 32).map((value, index) =>
                createElement("span", {
                  key: index,
                  className: "w-px rounded bg-white/70",
                  style: { height: `${Math.max(2, Math.round(value * 12))}px` },
                }),
              ),
            )
          : null,
      );
    },
  };
}
