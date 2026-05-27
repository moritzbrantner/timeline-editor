import { createElement } from "react";

import type { TimelineEditorExtension } from "@moritzbrantner/timeline-editor";

export type TimelineCaptionItemData = {
  text?: string;
  align?: "left" | "center" | "right";
  style?: Record<string, unknown>;
};

export function createTimelineCaptionsExtension(): TimelineEditorExtension<TimelineCaptionItemData> {
  return {
    id: "timeline-captions",
    itemKinds: ["caption"],
    renderItem: ({ item }) =>
      createElement("span", { className: "truncate italic" }, item.data?.text ?? item.label),
  };
}
