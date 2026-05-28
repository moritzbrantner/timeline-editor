import { createElement } from "react";

import type { TimelineEditorExtension } from "./react/workbench/types";
import type {
  TimelineMediaDisplayRange,
  TimelineMediaFit,
  TimelineMediaSourceRef,
} from "./media-types";

export type TimelineVideoItemData = TimelineMediaDisplayRange & {
  mediaType: "video";
  source?: TimelineMediaSourceRef;
  width?: number;
  height?: number;
  poster?: string;
  thumbnails?: string[];
  fit?: TimelineMediaFit;
  muted?: boolean;
  volume?: number;
  data?: Record<string, unknown>;
};

export type {
  TimelineMediaDisplayRange,
  TimelineMediaFit,
  TimelineMediaSourceRef,
} from "./media-types";

export function createTimelineVideoExtension(): TimelineEditorExtension<TimelineVideoItemData> {
  return {
    id: "timeline-video",
    itemKinds: ["video"],
    mediaTypes: ["video"],
    renderItem: ({ item }) =>
      createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement("span", { className: "truncate" }, item.label),
        item.data?.source?.label
          ? createElement(
              "span",
              { className: "truncate text-[10px] text-white/70" },
              item.data.source.label,
            )
          : null,
        createTimelineVideoStrip(item.data),
      ),
  };
}

function createTimelineVideoStrip(data: TimelineVideoItemData | undefined) {
  const thumbnails = data?.thumbnails ?? [];

  if (thumbnails.length > 0) {
    return createElement(
      "span",
      {
        "aria-hidden": true,
        "data-slot": "timeline-media-video-thumbnails",
        className: "flex h-4 overflow-hidden rounded-sm",
      },
      thumbnails.slice(0, 5).map((thumbnail, index) =>
        createElement("img", {
          key: index,
          alt: "",
          className: "h-full min-w-6 object-cover",
          src: thumbnail,
        }),
      ),
    );
  }

  if (!data?.poster) {
    return null;
  }

  return createElement("img", {
    alt: "",
    "aria-hidden": true,
    "data-slot": "timeline-media-video-poster",
    className: "h-4 w-full rounded-sm object-cover",
    src: data.poster,
  });
}
