import {
  createTimelineImageExtension as createBaseTimelineImageExtension,
  type TimelineImageItemData,
} from "@moritzbrantner/timeline-editor/image";
import {
  createTimelineMediaObjectUrl,
  type TimelineMediaFit,
  type TimelineMediaSourceCleanup,
  type TimelineMediaSourceRef,
  type TimelineMediaSourceRegistry,
} from "@moritzbrantner/timeline-editor/media-types";
import type {
  TimelineEditorExtension,
  TimelineWorkbenchAsset,
} from "@moritzbrantner/timeline-editor";
import {
  createTimelineBrowserWasmBackend,
  type TimelineComputeBackend,
  type TimelineComputeProgress,
  type TimelineComputeSource,
} from "@timeline-editor/compute";

export type { TimelineImageItemData, TimelineMediaFit, TimelineMediaSourceRef };

export type TimelineImageMetadata = {
  width?: number;
  height?: number;
  orientation?: number;
  thumbnail?: string;
  dominantColor?: string;
  warnings?: string[];
};

export type TimelineImageExtensionOptions = {
  backend?: TimelineComputeBackend;
};

export type TimelineImageFileAssetOptions = {
  id?: string;
  label?: string;
  durationMs?: number;
  color?: string;
  alt?: string;
  fit?: TimelineMediaFit;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  createObjectUrl?: (file: File) => string;
  sourceRegistry?: TimelineMediaSourceRegistry;
  backend?: TimelineComputeBackend;
  signal?: AbortSignal;
  onProgress?: (progress: TimelineComputeProgress) => void;
  generateThumbnail?: boolean;
};

export type TimelineImageFileAssetResult = {
  asset: TimelineWorkbenchAsset<TimelineImageItemData>;
  objectUrl?: string;
  cleanup?: TimelineMediaSourceCleanup;
  revoke?: TimelineMediaSourceCleanup;
  warnings?: string[];
};

export function createTimelineImageExtension(
  _options: TimelineImageExtensionOptions = {},
): TimelineEditorExtension<TimelineImageItemData> {
  return createBaseTimelineImageExtension();
}

export async function createTimelineImageFileAsset(
  file: File,
  options: TimelineImageFileAssetOptions = {},
): Promise<TimelineImageFileAssetResult> {
  const sourceLifecycle = createTimelineMediaObjectUrl(file, {
    createObjectUrl: options.createObjectUrl,
  });
  const objectUrl = sourceLifecycle.objectUrl;
  const label = options.label ?? file.name;
  const metadata = await analyzeTimelineImageSource(await createTimelineImageFileSource(file), {
    backend: options.backend,
    signal: options.signal,
    onProgress: options.onProgress,
    generateThumbnail: options.generateThumbnail,
  }).catch((): TimelineImageMetadata => ({}));
  const browserMetadata =
    metadata.width === undefined && objectUrl
      ? await loadTimelineImageElementMetadata(objectUrl).catch((): TimelineImageMetadata => ({}))
      : {};
  const width = metadata.width ?? browserMetadata.width;
  const height = metadata.height ?? browserMetadata.height;
  const source: TimelineMediaSourceRef = {
    id: options.sourceId,
    uri: objectUrl,
    label,
    mimeType: file.type || undefined,
    metadata: {
      fileName: file.name,
      lastModified: file.lastModified,
      size: file.size,
      width,
      height,
      orientation: metadata.orientation,
      dominantColor: metadata.dominantColor,
      ...options.metadata,
    },
  };
  const registeredSource = options.sourceRegistry
    ? options.sourceRegistry.register(source, sourceLifecycle)
    : undefined;
  const cleanup = registeredSource?.cleanup ?? sourceLifecycle.cleanup;

  return {
    asset: {
      id: options.id ?? createTimelineImageFileAssetId(label),
      label,
      kind: "image",
      mediaType: "image",
      durationMs: Math.max(1, options.durationMs ?? 1_000),
      color: options.color,
      description: file.type || "Image file",
      data: {
        mediaType: "image",
        source,
        src: objectUrl,
        alt: options.alt ?? label,
        fit: options.fit,
        thumbnail: metadata.thumbnail ?? objectUrl,
        width,
        height,
      },
    },
    objectUrl,
    cleanup,
    revoke: cleanup,
    warnings: metadata.warnings,
  };
}

export async function analyzeTimelineImageSource(
  source: TimelineComputeSource,
  options: {
    backend?: TimelineComputeBackend;
    signal?: AbortSignal;
    onProgress?: (progress: TimelineComputeProgress) => void;
    generateThumbnail?: boolean;
  } = {},
): Promise<TimelineImageMetadata> {
  const task = {
    domain: "image",
    operation: "analyze",
    source,
    options: {
      generateThumbnail: options.generateThumbnail,
    },
  } as const;

  if (!options.backend?.supports(task)) {
    return {
      warnings: ["No image compute backend is available; using browser image fallback metadata."],
    };
  }

  return options.backend.run<TimelineImageMetadata>(task, {
    signal: options.signal,
    onProgress: options.onProgress,
  });
}

export function createTimelineImageBrowserBackend(options: { workerUrl?: URL | string } = {}) {
  return createTimelineBrowserWasmBackend({
    worker: () =>
      new Worker(options.workerUrl ?? new URL("./worker.js", import.meta.url), {
        type: "module",
      }),
  });
}

async function createTimelineImageFileSource(file: File): Promise<TimelineComputeSource> {
  return {
    type: "bytes",
    bytes: await file.arrayBuffer(),
    label: file.name,
    mimeType: file.type || undefined,
  };
}

function loadTimelineImageElementMetadata(uri: string): Promise<TimelineImageMetadata> {
  if (typeof Image === "undefined") {
    return Promise.resolve({});
  }

  return new Promise((resolve) => {
    const image = new Image();
    const settle = () => {
      resolve({
        width:
          Number.isFinite(image.naturalWidth) && image.naturalWidth > 0
            ? image.naturalWidth
            : undefined,
        height:
          Number.isFinite(image.naturalHeight) && image.naturalHeight > 0
            ? image.naturalHeight
            : undefined,
      });
    };

    image.onload = settle;
    image.onerror = () => resolve({});
    image.src = uri;
  });
}

function createTimelineImageFileAssetId(label: string) {
  const slug = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return slug ? `image-${slug}` : "image-file";
}
