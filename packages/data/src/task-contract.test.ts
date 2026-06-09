import { readFileSync } from "node:fs";

import type { TimelineDataComputeTask } from "@timeline-editor/compute";
import { describe, expect, test } from "vitest";

import { analyzeTimelineNumericData } from "./index";

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
) as TimelineComputeTaskFixture<TimelineDataComputeTask>[];

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

describe("@timeline-editor/data task contract", () => {
  test("emits the shared data downsample task shape", async () => {
    const task = readFixtureTask("data-downsample");
    const { backend, calls } = createRecordingBackend({ series: task.series ?? [] });

    await analyzeTimelineNumericData(
      { series: task.series } as Parameters<typeof analyzeTimelineNumericData>[0],
      { ...task.options, backend },
    );

    expect(calls).toEqual([task]);
  });
});
