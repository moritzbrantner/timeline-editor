import type { TimelineEditorItem } from "../../core";
import { getTimelineMediaTypeForItem } from "../../media-types";

export function isTimelineWorkbenchKnownSceneItem(item: TimelineEditorItem<unknown>) {
  const mediaType = getTimelineMediaTypeForItem(item);

  return (
    mediaType === "audio" || mediaType === "video" || mediaType === "image" || mediaType === "text"
  );
}

export function getTimelineWorkbenchItemData(item: TimelineEditorItem<unknown>) {
  return item.data && typeof item.data === "object"
    ? (item.data as Record<string, unknown>)
    : undefined;
}

export function getTimelineWorkbenchSourceUri(data: Record<string, unknown> | undefined) {
  const source = data?.["source"];

  if (!source || typeof source !== "object" || !("uri" in source)) {
    return undefined;
  }

  return typeof source.uri === "string" ? source.uri : undefined;
}

export function getTimelineWorkbenchObjectFit(data: Record<string, unknown> | undefined) {
  const fit = getStringField(data, "fit");

  return fit === "cover" || fit === "fill" || fit === "none" ? fit : "contain";
}

export function getStringField(data: Record<string, unknown> | undefined, key: string) {
  const value = data?.[key];

  return typeof value === "string" ? value : undefined;
}

export function getNumberField(data: Record<string, unknown> | undefined, key: string) {
  const value = data?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getBooleanField(data: Record<string, unknown> | undefined, key: string) {
  const value = data?.[key];

  return typeof value === "boolean" ? value : undefined;
}
