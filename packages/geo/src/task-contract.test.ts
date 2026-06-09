import { readFileSync } from "node:fs";

import type { TimelineGeoComputeTask } from "@timeline-editor/compute";
import { describe, expect, test } from "vitest";

import { analyzeTimelineGeoJson } from "./index";

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
) as TimelineComputeTaskFixture<TimelineGeoComputeTask>[];

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

describe("@timeline-editor/geo task contract", () => {
  test("emits the shared geo analyze task shape exposed by the package API", async () => {
    const task = readFixtureTask("geo-analyze");
    const { backend, calls } = createRecordingBackend({});

    await analyzeTimelineGeoJson(task.geojson, { backend });

    expect(calls).toEqual([
      {
        domain: "geo",
        operation: "analyze",
        geojson: task.geojson,
      },
    ]);
  });
});
