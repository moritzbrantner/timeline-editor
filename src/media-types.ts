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

export type TimelineMediaSourceCleanup = () => void;

export type TimelineMediaSourceLifecycle = {
  source: TimelineMediaSourceRef;
  objectUrl?: string;
  cleanup?: TimelineMediaSourceCleanup;
  revoke?: TimelineMediaSourceCleanup;
};

export type TimelineMediaObjectUrlLifecycle = Omit<TimelineMediaSourceLifecycle, "source">;

export type TimelineMediaSourceLibraryEntry = {
  source: TimelineMediaSourceRef;
  objectUrl?: string;
  refCount: number;
  cleanup?: TimelineMediaSourceCleanup;
};

export type TimelineMediaSourceLibrary = {
  register: (
    source: TimelineMediaSourceRef,
    lifecycle?: TimelineMediaObjectUrlLifecycle,
  ) => TimelineMediaSourceLifecycle;
  retain: (source: TimelineMediaSourceRef | string | undefined) => void;
  release: (source: TimelineMediaSourceRef | string | undefined) => void;
  get: (
    source: TimelineMediaSourceRef | string | undefined,
  ) => TimelineMediaSourceLibraryEntry | undefined;
  dispose: () => void;
};

export type TimelineMediaObjectUrlOptions = {
  createObjectUrl?: (file: File) => string;
  revokeObjectUrl?: (objectUrl: string) => void;
};

export type TimelineMediaFileSourceOptions = TimelineMediaObjectUrlOptions & {
  id?: string;
  label?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  registry?: TimelineMediaSourceRegistry;
};

export type TimelineMediaSourceRegistry = {
  createFileSource: (
    file: File,
    options?: Omit<TimelineMediaFileSourceOptions, "registry">,
  ) => TimelineMediaSourceLifecycle;
  dispose: () => void;
  register: (
    source: TimelineMediaSourceRef,
    lifecycle?: TimelineMediaObjectUrlLifecycle,
  ) => TimelineMediaSourceLifecycle;
  release: (source: TimelineMediaSourceRef | string | undefined) => void;
};

export function createTimelineMediaSourceLibrary(): TimelineMediaSourceLibrary {
  const entries = new Map<string, TimelineMediaSourceLibraryEntry>();

  const library: TimelineMediaSourceLibrary = {
    register(source, lifecycle = {}) {
      const key = getTimelineMediaSourceKey(source);
      const cleanup = createTimelineMediaSourceCleanup(lifecycle.cleanup ?? lifecycle.revoke);
      const entry: TimelineMediaSourceLibraryEntry = {
        source,
        objectUrl: lifecycle.objectUrl,
        refCount: 1,
        cleanup,
      };

      if (!key) {
        return {
          source,
          objectUrl: lifecycle.objectUrl,
          cleanup,
          revoke: cleanup,
        };
      }

      const previousEntry = entries.get(key);

      if (previousEntry) {
        entries.delete(key);
        previousEntry.cleanup?.();
      }

      entries.set(key, entry);

      const release = createTimelineMediaSourceCleanup(() => {
        if (entries.get(key) !== entry) {
          return;
        }

        library.release(key);
      });

      return {
        source,
        objectUrl: lifecycle.objectUrl,
        cleanup: release,
        revoke: release,
      };
    },
    retain(source) {
      const entry = library.get(source);

      if (entry) {
        entry.refCount += 1;
      }
    },
    release(source) {
      const key = typeof source === "string" ? source : getTimelineMediaSourceKey(source);

      if (!key) {
        return;
      }

      const entry = entries.get(key);

      if (!entry) {
        return;
      }

      entry.refCount -= 1;

      if (entry.refCount > 0) {
        return;
      }

      entries.delete(key);
      entry.cleanup?.();
    },
    get(source) {
      const key = typeof source === "string" ? source : getTimelineMediaSourceKey(source);

      return key ? entries.get(key) : undefined;
    },
    dispose() {
      const activeEntries = Array.from(entries.values());

      entries.clear();
      for (const entry of activeEntries) {
        entry.cleanup?.();
      }
    },
  };

  return library;
}

export function createTimelineMediaSourceRegistry(): TimelineMediaSourceRegistry {
  const library = createTimelineMediaSourceLibrary();
  const registry: TimelineMediaSourceRegistry = {
    createFileSource(file, options = {}) {
      return createTimelineMediaFileSource(file, { ...options, registry });
    },
    dispose: library.dispose,
    register: library.register,
    release: library.release,
  };

  return registry;
}

export function createTimelineMediaFileSource(
  file: File,
  options: TimelineMediaFileSourceOptions = {},
): TimelineMediaSourceLifecycle {
  const label = options.label ?? file.name;
  const lifecycle = createTimelineMediaObjectUrl(file, options);
  const source: TimelineMediaSourceRef = {
    id: options.id,
    uri: lifecycle.objectUrl,
    label,
    mimeType: options.mimeType ?? (file.type || undefined),
    metadata: {
      fileName: file.name,
      lastModified: file.lastModified,
      size: file.size,
      ...options.metadata,
    },
  };

  return options.registry ? options.registry.register(source, lifecycle) : { source, ...lifecycle };
}

export function createTimelineMediaObjectUrl(
  file: File,
  options: TimelineMediaObjectUrlOptions = {},
): TimelineMediaObjectUrlLifecycle {
  const createObjectUrl = options.createObjectUrl ?? getDefaultTimelineMediaObjectUrlFactory();
  const objectUrl = createObjectUrl?.(file);
  const revokeObjectUrl = options.revokeObjectUrl ?? getDefaultTimelineMediaObjectUrlRevoker();
  const cleanup = createTimelineMediaSourceCleanup(
    objectUrl && revokeObjectUrl ? () => revokeObjectUrl(objectUrl) : undefined,
  );

  return { objectUrl, cleanup, revoke: cleanup };
}

export function getTimelineMediaSourceKey(source: TimelineMediaSourceRef | undefined) {
  return source?.id ?? source?.uri;
}

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

function getDefaultTimelineMediaObjectUrlFactory() {
  return typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
    ? (source: File) => URL.createObjectURL(source)
    : undefined;
}

function getDefaultTimelineMediaObjectUrlRevoker() {
  return typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function"
    ? (objectUrl: string) => URL.revokeObjectURL(objectUrl)
    : undefined;
}

function createTimelineMediaSourceCleanup(
  cleanup: TimelineMediaSourceCleanup | undefined,
): TimelineMediaSourceCleanup | undefined {
  if (!cleanup) {
    return undefined;
  }

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    cleanup();
  };
}
