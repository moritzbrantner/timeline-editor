import { createElement } from "react";

import type { TimelineEditorExtension } from "./react/workbench/types";
import type { TimelineMediaFit, TimelineMediaSize, TimelineMediaSourceRef } from "./media-types";

export type TimelineImageItemData = TimelineMediaSize & {
  mediaType: "image";
  source?: TimelineMediaSourceRef;
  src?: string;
  alt?: string;
  fit?: TimelineMediaFit;
  thumbnail?: string;
  data?: Record<string, unknown>;
};

export type { TimelineMediaFit, TimelineMediaSize, TimelineMediaSourceRef } from "./media-types";

export function createTimelineImageExtension(): TimelineEditorExtension<TimelineImageItemData> {
  return {
    id: "timeline-image",
    itemKinds: ["image"],
    mediaTypes: ["image"],
    renderItem: ({ item }) => {
      const imageSrc = item.data?.thumbnail ?? item.data?.src;

      return createElement(
        "span",
        { className: "flex min-w-0 items-center gap-2" },
        imageSrc
          ? createElement("img", {
              alt: item.data?.alt ?? "",
              "data-slot": "timeline-media-image-thumbnail",
              className: "h-7 w-10 shrink-0 rounded-sm object-cover",
              src: imageSrc,
            })
          : null,
        createElement(
          "span",
          { className: "grid min-w-0 gap-0.5" },
          createElement("span", { className: "truncate" }, item.label),
          getTimelineImageMeta(item.data)
            ? createElement(
                "span",
                { className: "truncate text-[10px] text-white/70" },
                getTimelineImageMeta(item.data),
              )
            : null,
        ),
      );
    },
  };
}

function getTimelineImageMeta(data: TimelineImageItemData | undefined) {
  if (!data) {
    return undefined;
  }

  if (data.width && data.height) {
    return `${data.width}x${data.height}`;
  }

  return data.source?.label;
}
