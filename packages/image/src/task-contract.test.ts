import { readFileSync } from "node:fs";

import type { TimelineImageComputeTask } from "@timeline-editor/compute";
import { describe, expect, test } from "vitest";

import { analyzeTimelineImageSource } from "./index";

type TimelineComputeTaskFixture<TTask> = {
  name: string;
  task: TTask;
};

const importMetaUrl = import.meta.url.startsWith("file:")
  ? import.meta.url
  : `file://${import.meta.url}`;

const fixtures = JSON.parse(
  readFileSync(
    new URL("../../../tests/fixtures/compute-task-envelopes.json", importMetaUrl),
    "utf8",
  ),
) as TimelineComputeTaskFixture<TimelineImageComputeTask>[];

const createRecordingBackend = <TResult>(result: TResult) => {
  const calls: unknown[] = [];

  return {
    calls,
    backend: {
      id: "recording",
      kind: "js-fallback" as const,
      supports: () => true,
      run: async <T>(_task: unknown) => {
        calls.push(_task);
        return result as unknown as T;
      },
      dispose: () => {},
    },
  };
};

const readFixtureTask = (name: string) => {
  const fixture = fixtures.find((entry) => entry.name === name);

  if (!fixture) {
    throw new Error(`Missing compute task fixture ${name}.`);
  }

  return fixture.task;
};

describe("@timeline-editor/image task contract", () => {
  test("emits the shared image analyze task shape", async () => {
    const task = readFixtureTask("image-analyze");
    const { backend, calls } = createRecordingBackend({});

    await analyzeTimelineImageSource(task.source, { ...task.options, backend });

    expect(calls).toEqual([task]);
  });
});
