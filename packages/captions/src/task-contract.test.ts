import { readFileSync } from "node:fs";

import type { TimelineCaptionsComputeTask } from "@timeline-editor/compute";
import { describe, expect, test } from "vitest";

import { parseTimelineCaptions } from "./index";

type TimelineCaptionsFixtureOptions = Parameters<typeof parseTimelineCaptions>[1];

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
) as TimelineComputeTaskFixture<TimelineCaptionsComputeTask>[];

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

describe("@timeline-editor/captions task contract", () => {
  test("emits the shared captions parse task shape", async () => {
    const task = readFixtureTask("captions-parse");
    const { backend, calls } = createRecordingBackend({ format: "srt" as const, cues: [] });

    await parseTimelineCaptions(task.input as string, {
      ...(task.options as TimelineCaptionsFixtureOptions),
      backend,
    });

    expect(calls).toEqual([task]);
  });
});
