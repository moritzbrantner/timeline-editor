import { createTimelineComputeError, createTimelineWorkerHandler } from "@timeline-editor/compute";
import type {
  TimelineComputeTaskProcessor,
  TimelineImageComputeTask,
} from "@timeline-editor/compute";

type TimelineImageWorkerAnalyzeResult = {
  width?: number;
  height?: number;
  thumbnail?: string;
  warnings?: string[];
};

export async function analyzeTimelineImageWorkerTask(
  task: TimelineImageComputeTask,
): Promise<TimelineImageWorkerAnalyzeResult> {
  if (typeof createImageBitmap !== "function") {
    return {
      warnings: [
        "Image worker metadata requires createImageBitmap; browser image fallback should be used.",
      ],
    };
  }

  const blob = await createTimelineImageWorkerBlob(task);

  if (!blob) {
    return {
      warnings: [
        "Image worker only supports byte and URL sources; browser fallback should be used.",
      ],
    };
  }

  const bitmap = await createImageBitmap(blob);

  try {
    const result: TimelineImageWorkerAnalyzeResult = {
      width: bitmap.width > 0 ? Math.round(bitmap.width) : undefined,
      height: bitmap.height > 0 ? Math.round(bitmap.height) : undefined,
    };

    if (task.options?.generateThumbnail) {
      result.thumbnail = await createTimelineImageWorkerThumbnail(bitmap, task).catch(() => {
        result.warnings = [
          ...(result.warnings ?? []),
          "Image worker thumbnail generation failed; source image can still be used.",
        ];
        return undefined;
      });
    }

    return result;
  } finally {
    bitmap.close?.();
  }
}

const processImageWorkerTask: TimelineComputeTaskProcessor = (task) => {
  if (task.domain !== "image") {
    throw createTimelineComputeError({
      code: "unsupported_source",
      message: `Image worker cannot process ${task.domain} tasks.`,
      recoverable: true,
    });
  }

  return analyzeTimelineImageWorkerTask(task);
};

const timelineImageWorkerScope = globalThis as typeof globalThis & {
  addEventListener?: unknown;
  postMessage?: unknown;
};

if (
  typeof timelineImageWorkerScope.addEventListener === "function" &&
  typeof timelineImageWorkerScope.postMessage === "function"
) {
  createTimelineWorkerHandler({ process: processImageWorkerTask });
}

async function createTimelineImageWorkerBlob(task: TimelineImageComputeTask) {
  if (task.source?.type === "bytes") {
    return new Blob([task.source.bytes], { type: task.source.mimeType });
  }

  if (task.source?.type === "url" && typeof fetch === "function") {
    const response = await fetch(task.source.url);

    if (!response.ok) {
      return undefined;
    }

    return response.blob();
  }

  return undefined;
}

async function createTimelineImageWorkerThumbnail(
  bitmap: ImageBitmap,
  task: TimelineImageComputeTask,
) {
  if (typeof OffscreenCanvas === "undefined") {
    return undefined;
  }

  const bounds = {
    width: Math.max(1, Math.round(task.options?.thumbnailWidth ?? 320)),
    height: Math.max(1, Math.round(task.options?.thumbnailHeight ?? 180)),
  };
  const scale = Math.min(bounds.width / bitmap.width, bounds.height / bitmap.height, 1);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    return undefined;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({
    type: task.options?.thumbnailMimeType ?? "image/png",
    quality: task.options?.thumbnailQuality,
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());

  return `data:${blob.type || "image/png"};base64,${encodeTimelineImageWorkerBase64(bytes)}`;
}

function encodeTimelineImageWorkerBase64(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
