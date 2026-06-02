import { describe, expect, test } from "vitest";

import { createTimelineJsFallbackBackend } from "@timeline-editor/compute";
import { createTimelineAudioFileAsset } from "./index";
import { analyzeTimelineAudioWorkerTask } from "./worker";

describe("@timeline-editor/audio", () => {
  test("uses backend metadata when creating file assets", async () => {
    const backend = createTimelineJsFallbackBackend({
      run: () => ({
        durationMs: 2_500,
        channels: 2,
        sampleRate: 48_000,
        waveform: [0, 1],
      }),
    });
    const file = new File([new Uint8Array([1, 2, 3])], "clip.wav", { type: "audio/wav" });
    const result = await createTimelineAudioFileAsset(file, { backend });

    expect(result.asset.durationMs).toBe(2_500);
    expect(result.asset.data?.channels).toBe(2);
    expect(result.asset.data?.sampleRate).toBe(48_000);
    expect(result.asset.data?.waveform).toEqual([0, 1]);
  });

  test("worker parses PCM WAV metadata and waveform", () => {
    const progress: string[] = [];
    const bytes = createTestWav({
      channels: 1,
      sampleRate: 8_000,
      samples: [0, 16_384, -16_384, 32_767],
    });
    const result = analyzeTimelineAudioWorkerTask(
      {
        domain: "audio",
        operation: "analyze",
        source: { type: "bytes", bytes, mimeType: "audio/wav" },
        options: { sampleCount: 2 },
      },
      { onProgress: (nextProgress) => progress.push(nextProgress.phase) },
    );

    expect(result.durationMs).toBe(1);
    expect(result.channels).toBe(1);
    expect(result.sampleRate).toBe(8_000);
    expect(result.waveform).toHaveLength(2);
    expect(result.waveform?.[1]).toBe(1);
    expect(progress).toEqual(["parse", "parse", "waveform", "waveform", "complete"]);
  });

  test("worker returns a recoverable warning for non-WAV bytes", () => {
    const result = analyzeTimelineAudioWorkerTask({
      domain: "audio",
      operation: "analyze",
      source: { type: "bytes", bytes: new Uint8Array([1, 2, 3]).buffer },
    });

    expect(result.warnings?.[0]).toContain("PCM WAV");
  });
});

function createTestWav({
  channels,
  sampleRate,
  samples,
}: {
  channels: number;
  sampleRate: number;
  samples: number[];
}) {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  samples.forEach((sample, index) => {
    view.setInt16(44 + index * bytesPerSample, sample, true);
  });

  return bytes;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
