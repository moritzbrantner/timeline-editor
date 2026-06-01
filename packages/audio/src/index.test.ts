import { describe, expect, test } from "vitest";

import { createTimelineJsFallbackBackend } from "@timeline-editor/compute";
import { createTimelineAudioFileAsset } from "./index";

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
});
