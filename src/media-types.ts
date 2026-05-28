import type { TimelineAudioItemData } from "./audio";
import type { TimelineImageItemData } from "./image";
import type { TimelineNumericDataItemData } from "./data";
import type { TimelineTextItemData } from "./text";
import type {
  TimelineEditorDocument,
  TimelineEditorItem,
  TimelineEditorItemKind,
  TimelineEditorValidationIssue,
} from "./types";
import type { TimelineVideoItemData } from "./video";

export const timelineMediaTypes = ["audio", "video", "image", "text", "numeric-data"] as const;

export type TimelineMediaType = (typeof timelineMediaTypes)[number];

export type TimelineKnownMediaKind = TimelineMediaType | "caption" | "subtitle" | "data";

export type TimelineMediaItemData =
  | TimelineAudioItemData
  | TimelineVideoItemData
  | TimelineImageItemData
  | TimelineTextItemData
  | TimelineNumericDataItemData;

export type TimelineMediaSourceRef = {
  id?: string;
  uri?: string;
  label?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
};

export type TimelineMediaDisplayRange = {
  sourceStartMs?: number;
  sourceEndMs?: number;
};

export type TimelineMediaSize = {
  width?: number;
  height?: number;
};

export type TimelineMediaFit = "contain" | "cover" | "fill" | "none";

const timelineMediaKindAliases = {
  audio: "audio",
  video: "video",
  image: "image",
  text: "text",
  caption: "text",
  subtitle: "text",
  "numeric-data": "numeric-data",
  data: "numeric-data",
} satisfies Record<TimelineKnownMediaKind, TimelineMediaType>;

export function isTimelineMediaType(input: unknown): input is TimelineMediaType {
  return typeof input === "string" && timelineMediaTypes.includes(input as TimelineMediaType);
}

export function getTimelineMediaTypeForKind(
  kind?: TimelineEditorItemKind,
): TimelineMediaType | undefined {
  return kind && kind in timelineMediaKindAliases
    ? timelineMediaKindAliases[kind as TimelineKnownMediaKind]
    : undefined;
}

export function getTimelineMediaTypeFromData(data: unknown): TimelineMediaType | undefined {
  const mediaType = getTimelineMediaTypeField(data);

  return isTimelineMediaType(mediaType) ? mediaType : undefined;
}

export function getTimelineMediaTypeForItem(
  item: TimelineEditorItem<unknown>,
): TimelineMediaType | undefined {
  return getTimelineMediaTypeForKind(item.kind) ?? getTimelineMediaTypeFromData(item.data);
}

export function getTimelineMediaTypeForAsset(asset: {
  kind?: TimelineEditorItemKind;
  mediaType?: unknown;
  data?: unknown;
}): TimelineMediaType | undefined {
  return (
    getTimelineMediaTypeForKind(asset.kind) ??
    (isTimelineMediaType(asset.mediaType) ? asset.mediaType : undefined) ??
    getTimelineMediaTypeFromData(asset.data)
  );
}

export function assertTimelineMediaKindMatchesData(
  item: TimelineEditorItem<unknown>,
): TimelineEditorValidationIssue | undefined {
  return validateTimelineMediaItem(item, "data.mediaType");
}

export function validateTimelineEditorMediaTypes(
  document: TimelineEditorDocument,
): TimelineEditorValidationIssue[] {
  return document.tracks.flatMap((track, trackIndex) =>
    track.items.flatMap((item, itemIndex) => {
      const issue = validateTimelineMediaItem(
        item,
        `tracks[${trackIndex}].items[${itemIndex}].data.mediaType`,
      );

      return issue ? [issue] : [];
    }),
  );
}

function validateTimelineMediaItem(
  item: TimelineEditorItem<unknown>,
  path: string,
): TimelineEditorValidationIssue | undefined {
  const dataMediaType = getTimelineMediaTypeField(item.data);

  if (dataMediaType !== undefined && !isTimelineMediaType(dataMediaType)) {
    return {
      path,
      code: "invalid_media_type",
      message: `Media type must be one of: ${timelineMediaTypes.join(", ")}.`,
      severity: "error",
    };
  }

  const kindMediaType = getTimelineMediaTypeForKind(item.kind);

  if (kindMediaType && isTimelineMediaType(dataMediaType) && kindMediaType !== dataMediaType) {
    return {
      path,
      code: "mismatched_media_type",
      message: `Item kind "${item.kind}" maps to "${kindMediaType}" but data.mediaType is "${dataMediaType}".`,
      severity: "error",
    };
  }

  return undefined;
}

function getTimelineMediaTypeField(data: unknown) {
  return data && typeof data === "object" && "mediaType" in data
    ? (data as { mediaType?: unknown }).mediaType
    : undefined;
}
