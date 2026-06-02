import { createTimelineComputeError, createTimelineWorkerHandler } from "@timeline-editor/compute";
import type {
  TimelineAudioComputeTask,
  TimelineComputeProgress,
  TimelineComputeTaskProcessor,
} from "@timeline-editor/compute";

type TimelineAudioWorkerAnalyzeResult = {
  durationMs?: number;
  channels?: number;
  sampleRate?: number;
  waveform?: number[];
  warnings?: string[];
};

export function analyzeTimelineAudioWorkerTask(
  task: TimelineAudioComputeTask,
  context: { onProgress?: (progress: TimelineComputeProgress) => void } = {},
): TimelineAudioWorkerAnalyzeResult {
  context.onProgress?.({ phase: "parse", completed: 0, total: 1 });

  if (task.source.type !== "bytes") {
    return {
      warnings: ["Audio worker only supports PCM WAV byte sources; host fallback should be used."],
    };
  }

  const parsed = parseTimelineAudioWav(task.source.bytes);

  if (!parsed) {
    return {
      warnings: ["Audio worker only supports PCM WAV analysis; host fallback should be used."],
    };
  }

  context.onProgress?.({ phase: "parse", completed: 1, total: 1 });
  context.onProgress?.({ phase: "waveform", completed: 0, total: 1 });

  const waveform = createTimelineAudioWorkerWaveform(parsed, {
    sampleCount: task.options?.sampleCount,
    normalize: task.options?.normalize,
  });

  context.onProgress?.({ phase: "waveform", completed: 1, total: 1 });
  context.onProgress?.({ phase: "complete", completed: 1, total: 1 });

  return {
    durationMs: Math.max(1, Math.round((parsed.frameCount / parsed.sampleRate) * 1_000)),
    channels: parsed.channels,
    sampleRate: parsed.sampleRate,
    waveform,
  };
}

const processAudioWorkerTask: TimelineComputeTaskProcessor = (task, context) => {
  if (task.domain !== "audio") {
    throw createTimelineComputeError({
      code: "unsupported_source",
      message: `Audio worker cannot process ${task.domain} tasks.`,
      recoverable: true,
    });
  }

  return analyzeTimelineAudioWorkerTask(task, context);
};

const timelineAudioWorkerScope = globalThis as typeof globalThis & {
  addEventListener?: unknown;
  postMessage?: unknown;
};

if (
  typeof timelineAudioWorkerScope.addEventListener === "function" &&
  typeof timelineAudioWorkerScope.postMessage === "function"
) {
  createTimelineWorkerHandler({ process: processAudioWorkerTask });
}

type TimelineAudioWavMetadata = {
  audioFormat: number;
  bitsPerSample: number;
  blockAlign: number;
  channels: number;
  dataOffset: number;
  dataSize: number;
  frameCount: number;
  sampleRate: number;
  view: DataView;
};

function parseTimelineAudioWav(bytes: ArrayBuffer): TimelineAudioWavMetadata | undefined {
  const view = new DataView(bytes);

  if (view.byteLength < 44 || readTimelineAudioAscii(view, 0, 4) !== "RIFF") {
    return undefined;
  }

  if (readTimelineAudioAscii(view, 8, 4) !== "WAVE") {
    return undefined;
  }

  let offset = 12;
  let audioFormat: number | undefined;
  let bitsPerSample: number | undefined;
  let blockAlign: number | undefined;
  let channels: number | undefined;
  let sampleRate: number | undefined;
  let dataOffset: number | undefined;
  let dataSize: number | undefined;

  while (offset + 8 <= view.byteLength) {
    const chunkId = readTimelineAudioAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkDataOffset + chunkSize > view.byteLength) {
      return undefined;
    }

    if (chunkId === "fmt " && chunkSize >= 16) {
      audioFormat = view.getUint16(chunkDataOffset, true);
      channels = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      blockAlign = view.getUint16(chunkDataOffset + 12, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    }

    if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (
    audioFormat === undefined ||
    bitsPerSample === undefined ||
    blockAlign === undefined ||
    channels === undefined ||
    sampleRate === undefined ||
    dataOffset === undefined ||
    dataSize === undefined ||
    channels <= 0 ||
    sampleRate <= 0 ||
    blockAlign <= 0 ||
    !isTimelineAudioWorkerSupportedWavFormat(audioFormat, bitsPerSample)
  ) {
    return undefined;
  }

  return {
    audioFormat,
    bitsPerSample,
    blockAlign,
    channels,
    dataOffset,
    dataSize,
    frameCount: Math.floor(dataSize / blockAlign),
    sampleRate,
    view,
  };
}

function isTimelineAudioWorkerSupportedWavFormat(audioFormat: number, bitsPerSample: number) {
  return (
    (audioFormat === 1 && [8, 16, 24, 32].includes(bitsPerSample)) ||
    (audioFormat === 3 && bitsPerSample === 32)
  );
}

function createTimelineAudioWorkerWaveform(
  metadata: TimelineAudioWavMetadata,
  options: { sampleCount?: number; normalize?: boolean },
) {
  const sampleCount = Math.max(1, Math.round(options.sampleCount ?? 96));
  const waveform = Array.from({ length: sampleCount }, () => 0);

  if (metadata.frameCount <= 0) {
    return waveform;
  }

  for (let bucketIndex = 0; bucketIndex < sampleCount; bucketIndex += 1) {
    const startFrame = Math.floor((bucketIndex / sampleCount) * metadata.frameCount);
    const endFrame = Math.max(
      startFrame + 1,
      Math.floor(((bucketIndex + 1) / sampleCount) * metadata.frameCount),
    );
    let peak = 0;

    for (let frameIndex = startFrame; frameIndex < endFrame; frameIndex += 1) {
      for (let channelIndex = 0; channelIndex < metadata.channels; channelIndex += 1) {
        const sample = Math.abs(readTimelineAudioWorkerSample(metadata, frameIndex, channelIndex));

        if (Number.isFinite(sample) && sample > peak) {
          peak = sample;
        }
      }
    }

    waveform[bucketIndex] = clampTimelineAudioWorkerWaveformValue(peak);
  }

  if (options.normalize !== false) {
    const maxPeak = Math.max(...waveform);

    if (maxPeak > 0) {
      return waveform.map((value) => clampTimelineAudioWorkerWaveformValue(value / maxPeak));
    }
  }

  return waveform;
}

function readTimelineAudioWorkerSample(
  metadata: TimelineAudioWavMetadata,
  frameIndex: number,
  channelIndex: number,
) {
  const bytesPerSample = metadata.bitsPerSample / 8;
  const sampleOffset =
    metadata.dataOffset + frameIndex * metadata.blockAlign + channelIndex * bytesPerSample;

  if (sampleOffset + bytesPerSample > metadata.view.byteLength) {
    return 0;
  }

  if (metadata.audioFormat === 3) {
    return metadata.view.getFloat32(sampleOffset, true);
  }

  switch (metadata.bitsPerSample) {
    case 8:
      return (metadata.view.getUint8(sampleOffset) - 128) / 128;
    case 16:
      return metadata.view.getInt16(sampleOffset, true) / 32_768;
    case 24:
      return readTimelineAudioWorkerInt24(metadata.view, sampleOffset) / 8_388_608;
    case 32:
      return metadata.view.getInt32(sampleOffset, true) / 2_147_483_648;
    default:
      return 0;
  }
}

function readTimelineAudioWorkerInt24(view: DataView, offset: number) {
  const value =
    view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);

  return value & 0x80_0000 ? value | 0xff00_0000 : value;
}

function readTimelineAudioAscii(view: DataView, offset: number, length: number) {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }

  return value;
}

function clampTimelineAudioWorkerWaveformValue(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
