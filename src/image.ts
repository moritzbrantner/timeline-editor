import { createElement } from "react";

import type { TimelineEditorExtension } from "./react/workbench/types";
import type { TimelineWorkbenchAsset } from "./react/workbench/types";
import {
  createTimelineMediaObjectUrl,
  type TimelineMediaFit,
  type TimelineMediaSize,
  type TimelineMediaSourceCleanup,
  type TimelineMediaSourceLibrary,
  type TimelineMediaSourceRef,
  type TimelineMediaSourceRegistry,
} from "./media-types";

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
  sourceLibrary?: TimelineMediaSourceLibrary;
};

export type TimelineImageFileAssetResult = {
  asset: TimelineWorkbenchAsset<TimelineImageItemData>;
  objectUrl?: string;
  cleanup?: TimelineMediaSourceCleanup;
  revoke?: TimelineMediaSourceCleanup;
};

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

export async function createTimelineImageFileAsset(
  file: File,
  options: TimelineImageFileAssetOptions = {},
): Promise<TimelineImageFileAssetResult> {
  const sourceLifecycle = createTimelineMediaObjectUrl(file, {
    createObjectUrl: options.createObjectUrl,
  });
  const objectUrl = sourceLifecycle.objectUrl;
  const label = options.label ?? file.name;
  const dimensions: TimelineMediaSize = objectUrl
    ? await loadTimelineImageDimensions(objectUrl).catch((): TimelineMediaSize => ({}))
    : {};
  const durationMs = Math.max(1, options.durationMs ?? 1_000);
  const source: TimelineMediaSourceRef = {
    id: options.sourceId,
    uri: objectUrl,
    label,
    mimeType: file.type || undefined,
    metadata: {
      fileName: file.name,
      lastModified: file.lastModified,
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
      ...options.metadata,
    },
  };
  const registeredSource = options.sourceLibrary
    ? options.sourceLibrary.register(source, sourceLifecycle)
    : options.sourceRegistry
      ? options.sourceRegistry.register(source, sourceLifecycle)
      : undefined;
  const cleanup = registeredSource?.cleanup ?? sourceLifecycle.cleanup;

  return {
    asset: {
      id: options.id ?? createTimelineImageFileAssetId(label),
      label,
      kind: "image",
      mediaType: "image",
      durationMs,
      color: options.color,
      description: file.type || "Image file",
      data: {
        mediaType: "image",
        source,
        src: objectUrl,
        thumbnail: objectUrl,
        alt: options.alt ?? label,
        fit: options.fit,
        width: dimensions.width,
        height: dimensions.height,
      },
    },
    objectUrl,
    cleanup,
    revoke: cleanup,
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

function createTimelineImageFileAssetId(label: string) {
  const slug = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return slug ? `image-${slug}` : "image-file";
}

function loadTimelineImageDimensions(uri: string) {
  if (typeof Image === "undefined") {
    return Promise.resolve({});
  }

  return new Promise<TimelineMediaSize>((resolve) => {
    const image = new Image();
    let settled = false;
    const timeout = globalThis.setTimeout(() => settle({}), 4_000);
    const settle = (dimensions: TimelineMediaSize) => {
      if (settled) {
        return;
      }

      settled = true;
      globalThis.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(dimensions);
    };

    image.onload = () =>
      settle({
        width:
          Number.isFinite(image.naturalWidth) && image.naturalWidth > 0
            ? Math.round(image.naturalWidth)
            : undefined,
        height:
          Number.isFinite(image.naturalHeight) && image.naturalHeight > 0
            ? Math.round(image.naturalHeight)
            : undefined,
      });
    image.onerror = () => settle({});
    image.src = uri;
  });
}
