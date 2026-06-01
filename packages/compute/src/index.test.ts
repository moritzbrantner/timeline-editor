import { describe, expect, test } from "vitest";

import {
  createTimelineAdaptiveBackend,
  createTimelineJsFallbackBackend,
  createTimelineTauriBackend,
  type TimelineComputeTask,
} from "./index";

const task = {
  domain: "captions",
  operation: "parse",
  input: "hello",
} satisfies TimelineComputeTask;

describe("@timeline-editor/compute", () => {
  test("selects the first supported adaptive backend", async () => {
    const backend = createTimelineAdaptiveBackend({
      tauri: createTimelineJsFallbackBackend({
        id: "first",
        run: () => ({ backend: "first" }),
      }),
      browserWasm: createTimelineJsFallbackBackend({
        id: "second",
        run: () => ({ backend: "second" }),
      }),
    });

    await expect(backend.run(task)).resolves.toEqual({ backend: "first" });
  });

  test("falls through recoverable backend errors", async () => {
    const backend = createTimelineAdaptiveBackend({
      tauri: createTimelineJsFallbackBackend({
        id: "broken",
        run: () => {
          throw { code: "unsupported_source", message: "No", recoverable: true };
        },
      }),
      fallback: createTimelineJsFallbackBackend({
        id: "fallback",
        run: () => ({ ok: true }),
      }),
    });

    await expect(backend.run(task)).resolves.toEqual({ ok: true });
  });

  test("normalizes Tauri invoke responses", async () => {
    const backend = createTimelineTauriBackend({
      invoke: async <T>(_command: string, payload: unknown) => ({ result: payload }) as T,
    });

    await expect(backend.run(task)).resolves.toEqual({ task });
  });
});
