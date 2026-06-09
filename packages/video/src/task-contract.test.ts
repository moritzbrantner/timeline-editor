import { readFileSync } from "node:fs";

import type { TimelineVideoComputeTask } from "@timeline-editor/compute";
import { describe, expect, test } from "vitest";

import { analyzeTimelineVideoSource } from "./index";

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
) as TimelineComputeTaskFixture<TimelineVideoComputeTask>[];

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

describe("@timeline-editor/video task contract", () => {
  test("emits the shared video analyze task shape", async () => {
    const task = readFixtureTask("video-analyze");
    const { backend, calls } = createRecordingBackend({});

    await analyzeTimelineVideoSource(task.source, { ...task.options, backend });

    expect(calls).toEqual([task]);
  });
});
