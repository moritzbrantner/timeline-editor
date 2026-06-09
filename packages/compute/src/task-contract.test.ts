import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { createTimelineTauriBackend, type TimelineComputeTask } from "./index";

type TimelineComputeTaskFixture = {
  name: string;
  task: TimelineComputeTask;
};

const acceptTask = (task: TimelineComputeTask) => task;
const importMetaUrl = import.meta.url.startsWith("file:")
  ? import.meta.url
  : `file://${import.meta.url}`;

const fixtures = JSON.parse(
  readFileSync(
    new URL("../../../tests/fixtures/compute-task-envelopes.json", importMetaUrl),
    "utf8",
  ),
) as TimelineComputeTaskFixture[];

describe("timeline compute task contract", () => {
  test.each(fixtures)("passes $name through the Tauri task envelope", async ({ task }) => {
    const acceptedTask = acceptTask(task);
    const invokedPayloads: unknown[] = [];
    const backend = createTimelineTauriBackend({
      invoke: async <T>(_command: string, payload: unknown) => {
        invokedPayloads.push(payload);
        return { result: { ok: true } } as T;
      },
    });

    await expect(backend.run(acceptedTask)).resolves.toEqual({ ok: true });
    expect(invokedPayloads).toEqual([{ task }]);
  });
});
