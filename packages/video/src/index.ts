import { createElement } from "react";

import type { TimelineEditorExtension } from "@moritzbrantner/timeline-editor";

export type TimelineVideoItemData = {
  sourceLabel?: string;
  opacity?: number;
  fit?: "cover" | "contain" | "fill";
  thumbnails?: string[];
};

export function createTimelineVideoExtension(): TimelineEditorExtension<TimelineVideoItemData> {
  return {
    id: "timeline-video",
    itemKinds: ["video"],
    renderItem: ({ item }) => {
      const thumbnails = item.data?.thumbnails ?? [];

      return createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement("span", { className: "truncate" }, item.label),
        thumbnails.length > 0
          ? createElement(
              "span",
              { "aria-hidden": true, className: "flex h-4 overflow-hidden rounded-sm" },
              thumbnails.slice(0, 4).map((thumbnail, index) =>
                createElement("img", {
                  key: index,
                  alt: "",
                  className: "h-full min-w-6 object-cover",
                  src: thumbnail,
                }),
              ),
            )
          : null,
      );
    },
  };
}
