import { describe, expect, test } from "vitest";

import { createTimelineTauriBackend } from "./index";

describe("@timeline-editor/tauri", () => {
  test("uses the default Tauri command contract", async () => {
    const backend = createTimelineTauriBackend({
      invoke: async <T>(command: string, payload: unknown) =>
        ({ result: { command, payload } }) as T,
    });

    await expect(
      backend.run({
        domain: "captions",
        operation: "parse",
        input: "hello",
      }),
    ).resolves.toEqual({
      command: "timeline_editor_process",
      payload: {
        task: {
          domain: "captions",
          operation: "parse",
          input: "hello",
        },
      },
    });
  });
});
