import { createTimelineAudioFileAsset, type TimelineAudioItemData } from "./audio";
import { createTimelineImageFileAsset, type TimelineImageItemData } from "./image";
import type {
  TimelineMediaFit,
  TimelineMediaItemData,
  TimelineMediaSourceLibrary,
  TimelineMediaSourceRef,
  TimelineMediaSourceRegistry,
  TimelineMediaType,
} from "./media-types";
import type {
  TimelineWorkbenchAsset,
  TimelineWorkbenchImportResult,
  TimelineWorkbenchImportSource,
} from "./react/workbench/types";
import {
  createTimelineVideoFileAsset,
  type TimelineVideoFileAssetOptions,
  type TimelineVideoItemData,
} from "./video";

export type TimelineMediaImportResolverOptions = {
  sourceLibrary?: TimelineMediaSourceLibrary;
  sourceRegistry?: TimelineMediaSourceRegistry;
  createObjectUrl?: (file: File) => string;
  defaultImageDurationMs?: number;
  videoThumbnailCount?: number;
};

export type TimelineMediaImportResolverResult =
  TimelineWorkbenchImportResult<TimelineMediaItemData>;

type ImportableTimelineMediaType = Extract<TimelineMediaType, "audio" | "video" | "image">;

export function createTimelineMediaImportResolver(
  options: TimelineMediaImportResolverOptions = {},
): (sources: TimelineWorkbenchImportSource[]) => Promise<TimelineMediaImportResolverResult[]> {
  return async (sources) =>
    Promise.all(sources.map((source) => resolveTimelineMediaImportSource(source, options)));
}

async function resolveTimelineMediaImportSource(
  source: TimelineWorkbenchImportSource,
  options: TimelineMediaImportResolverOptions,
): Promise<TimelineMediaImportResolverResult> {
  if (source.type === "file") {
    return resolveTimelineMediaFileImportSource(source, options);
  }

  if (source.type === "url") {
    return resolveTimelineMediaUrlImportSource(source, options);
  }

  if (source.type === "reference") {
    return resolveTimelineMediaReferenceImportSource(source, options);
  }

  throw new Error("Unsupported media import source.");
}

async function resolveTimelineMediaFileImportSource(
  source: TimelineWorkbenchImportSource,
  options: TimelineMediaImportResolverOptions,
): Promise<TimelineMediaImportResolverResult> {
  const file = source.file;

  if (!file) {
    throw new Error("Unsupported file import source: missing file.");
  }

  const mediaType = getTimelineMediaTypeForImportSource(source);

  if (!isImportableTimelineMediaType(mediaType)) {
    throw new Error(`Unsupported file import source: ${source.label ?? file.name}.`);
  }

  const commonOptions = {
    id: source.label ? createTimelineMediaAssetId(mediaType, source.label) : undefined,
    label: source.label,
    durationMs: source.durationMs,
    metadata: source.metadata,
    sourceId:
      getStringMetadata(isRecord(source.metadata) ? source.metadata : {}, "sourceId") ??
      getStringMetadata(isRecord(source.metadata) ? source.metadata : {}, "id"),
    createObjectUrl: options.createObjectUrl,
    sourceLibrary: options.sourceLibrary,
    sourceRegistry: options.sourceLibrary ? undefined : options.sourceRegistry,
  };

  if (mediaType === "audio") {
    return toTimelineMediaImportResult(await createTimelineAudioFileAsset(file, commonOptions));
  }

  if (mediaType === "video") {
    const metadata = isRecord(source.metadata) ? source.metadata : {};
    const videoOptions: TimelineVideoFileAssetOptions = {
      ...commonOptions,
      width: getNumberMetadata(metadata, "width"),
      height: getNumberMetadata(metadata, "height"),
      poster: getStringMetadata(metadata, "poster"),
      fit: getTimelineMediaFitMetadata(metadata),
      ...(options.videoThumbnailCount !== undefined
        ? { thumbnailCount: options.videoThumbnailCount }
        : {}),
    };

    return toTimelineMediaImportResult(await createTimelineVideoFileAsset(file, videoOptions));
  }

  return toTimelineMediaImportResult(await createTimelineImageFileAsset(file, commonOptions));
}

function resolveTimelineMediaUrlImportSource(
  source: TimelineWorkbenchImportSource,
  options: TimelineMediaImportResolverOptions,
): TimelineMediaImportResolverResult {
  const url = source.url;

  if (!url) {
    throw new Error("Unsupported URL import source: missing URL.");
  }

  const mediaType = getTimelineMediaTypeForImportSource(source);

  if (!isImportableTimelineMediaType(mediaType)) {
    throw new Error(`Unsupported URL import source: ${url}.`);
  }

  const label = source.label ?? getTimelineMediaLabelFromUrl(url) ?? `${mediaType} source`;
  const metadata = isRecord(source.metadata) ? source.metadata : {};
  const mimeType = getTimelineMediaMimeTypeFromMetadata(metadata);
  const durationMs = Math.max(
    1,
    source.durationMs ??
      (mediaType === "image" ? options.defaultImageDurationMs : undefined) ??
      1_000,
  );
  const sourceRef: TimelineMediaSourceRef = {
    id: getStringMetadata(metadata, "sourceId") ?? getStringMetadata(metadata, "id"),
    uri: url,
    label,
    mimeType,
    metadata: source.metadata,
  };
  const asset = createTimelineMediaAsset({
    id: createTimelineMediaAssetId(mediaType, label),
    label,
    mediaType,
    durationMs,
    source: sourceRef,
    metadata,
  });

  return { asset };
}

function resolveTimelineMediaReferenceImportSource(
  source: TimelineWorkbenchImportSource,
  options: TimelineMediaImportResolverOptions,
): TimelineMediaImportResolverResult {
  const reference = isRecord(source.reference) ? source.reference : {};
  const mediaType = getTimelineMediaTypeForImportSource(source);
  const label =
    source.label ??
    getStringMetadata(reference, "label") ??
    getStringMetadata(reference, "name") ??
    getStringMetadata(reference, "title");
  const durationMs = source.durationMs ?? getNumberMetadata(reference, "durationMs");

  if (!isImportableTimelineMediaType(mediaType) || !label || durationMs === undefined) {
    throw new Error("Unsupported reference import source.");
  }

  const metadata = {
    ...(isRecord(reference.metadata) ? reference.metadata : {}),
    ...(isRecord(source.metadata) ? source.metadata : {}),
  };
  const uri =
    getStringMetadata(reference, "uri") ??
    getStringMetadata(reference, "url") ??
    getStringMetadata(reference, "src");
  const sourceRef: TimelineMediaSourceRef = {
    id: getStringMetadata(reference, "sourceId") ?? getStringMetadata(reference, "id"),
    uri,
    label,
    mimeType:
      getStringMetadata(reference, "mimeType") ??
      getStringMetadata(reference, "type") ??
      getTimelineMediaMimeTypeFromMetadata(metadata),
    metadata,
  };
  const asset = createTimelineMediaAsset({
    id: createTimelineMediaAssetId(mediaType, label),
    label,
    mediaType,
    durationMs: Math.max(1, durationMs),
    source: sourceRef,
    metadata,
    defaultImageDurationMs: options.defaultImageDurationMs,
  });

  return { asset };
}

function getTimelineMediaTypeForImportSource(
  source: TimelineWorkbenchImportSource,
): TimelineMediaType | undefined {
  if (source.mediaType) {
    return source.mediaType;
  }

  const mimeType =
    source.type === "file"
      ? source.file?.type
      : getTimelineMediaMimeTypeFromMetadata(isRecord(source.metadata) ? source.metadata : {});
  const mediaTypeFromMimeType = getTimelineMediaTypeFromMimeType(mimeType);

  if (mediaTypeFromMimeType) {
    return mediaTypeFromMimeType;
  }

  const name =
    source.type === "file"
      ? source.file?.name
      : source.type === "url"
        ? source.url
        : (getStringMetadata(isRecord(source.reference) ? source.reference : {}, "uri") ??
          getStringMetadata(isRecord(source.reference) ? source.reference : {}, "url") ??
          getStringMetadata(isRecord(source.reference) ? source.reference : {}, "src") ??
          source.label);

  return getTimelineMediaTypeFromExtension(name);
}

function createTimelineMediaAsset({
  id,
  label,
  mediaType,
  durationMs,
  source,
  metadata,
}: {
  id: string;
  label: string;
  mediaType: ImportableTimelineMediaType;
  durationMs: number;
  source: TimelineMediaSourceRef;
  metadata: Record<string, unknown>;
  defaultImageDurationMs?: number;
}): TimelineWorkbenchAsset<TimelineMediaItemData> {
  if (mediaType === "audio") {
    return {
      id,
      label,
      kind: "audio",
      mediaType: "audio",
      durationMs,
      description: source.mimeType || "Audio source",
      data: {
        mediaType: "audio",
        source,
      } satisfies TimelineAudioItemData,
    };
  }

  if (mediaType === "video") {
    return {
      id,
      label,
      kind: "video",
      mediaType: "video",
      durationMs,
      description: source.mimeType || "Video source",
      data: {
        mediaType: "video",
        source,
        width: getNumberMetadata(metadata, "width"),
        height: getNumberMetadata(metadata, "height"),
        poster: getStringMetadata(metadata, "poster"),
        thumbnails: getStringArrayMetadata(metadata, "thumbnails"),
        fit: getTimelineMediaFitMetadata(metadata),
      } satisfies TimelineVideoItemData,
    };
  }

  return {
    id,
    label,
    kind: "image",
    mediaType: "image",
    durationMs,
    description: source.mimeType || "Image source",
    data: {
      mediaType: "image",
      source,
      src: source.uri,
      thumbnail: source.uri,
      alt: getStringMetadata(metadata, "alt") ?? label,
      fit: getTimelineMediaFitMetadata(metadata),
      width: getNumberMetadata(metadata, "width"),
      height: getNumberMetadata(metadata, "height"),
    } satisfies TimelineImageItemData,
  };
}

function toTimelineMediaImportResult(result: {
  asset: TimelineWorkbenchAsset<TimelineMediaItemData>;
  cleanup?: () => void;
  revoke?: () => void;
  objectUrl?: string;
}): TimelineMediaImportResolverResult {
  return {
    asset: result.asset,
    cleanup: result.cleanup,
    revoke: result.revoke,
    metadata: result.objectUrl ? { objectUrl: result.objectUrl } : undefined,
  };
}

function getTimelineMediaTypeFromMimeType(mimeType: string | undefined) {
  if (mimeType?.startsWith("audio/")) {
    return "audio";
  }

  if (mimeType?.startsWith("video/")) {
    return "video";
  }

  if (mimeType?.startsWith("image/")) {
    return "image";
  }

  return undefined;
}

function getTimelineMediaTypeFromExtension(input: string | undefined) {
  const extension = getTimelineMediaExtension(input);

  if (!extension) {
    return undefined;
  }

  if (["mp3", "wav", "aac", "m4a", "ogg", "flac"].includes(extension)) {
    return "audio";
  }

  if (["mp4", "mov", "webm", "mkv", "m4v"].includes(extension)) {
    return "video";
  }

  if (["png", "jpg", "jpeg", "webp", "gif", "avif", "svg"].includes(extension)) {
    return "image";
  }

  return undefined;
}

function getTimelineMediaExtension(input: string | undefined) {
  const path = input ? getTimelineMediaPathname(input) : undefined;
  const match = path?.match(/\.([a-z0-9]+)$/i);

  return match?.[1]?.toLowerCase();
}

function getTimelineMediaPathname(input: string) {
  try {
    return new URL(input).pathname;
  } catch {
    return input.split(/[?#]/, 1)[0] ?? input;
  }
}

function getTimelineMediaLabelFromUrl(url: string) {
  const pathname = getTimelineMediaPathname(url);
  const segments = pathname.split("/");

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];

    if (segment) {
      return decodeURIComponent(segment);
    }
  }

  return undefined;
}

function getTimelineMediaMimeTypeFromMetadata(metadata: Record<string, unknown>) {
  return (
    getStringMetadata(metadata, "mimeType") ??
    getStringMetadata(metadata, "contentType") ??
    getStringMetadata(metadata, "type")
  );
}

function createTimelineMediaAssetId(mediaType: ImportableTimelineMediaType, label: string) {
  const slug = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return slug ? `${mediaType}-${slug}` : `${mediaType}-source`;
}

function isImportableTimelineMediaType(
  mediaType: TimelineMediaType | undefined,
): mediaType is ImportableTimelineMediaType {
  return mediaType === "audio" || mediaType === "video" || mediaType === "image";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return typeof value === "string" && value ? value : undefined;
}

function getNumberMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getStringArrayMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;
}

function getTimelineMediaFitMetadata(
  metadata: Record<string, unknown>,
): TimelineMediaFit | undefined {
  const value = getStringMetadata(metadata, "fit");

  return value === "contain" || value === "cover" || value === "fill" || value === "none"
    ? value
    : undefined;
}
