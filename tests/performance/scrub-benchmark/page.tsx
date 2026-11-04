// oxlint-disable no-await-in-loop -- ticks are measured one frame at a time.
import "@moritzbrantner/ui/styles.css";
import "@moritzbrantner/ui/component-sources.css";

import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import {
  TimelineEditor,
  TimelineWorkbench,
  type TimelineEditorDocument,
  type TimelineEditorSelection,
} from "@scrub-benchmark-source/index.ts";
import { createTimelineEditorDocumentIndex } from "@scrub-benchmark-source/document-index.ts";
import { detectTimelineEditorOverlaps } from "@scrub-benchmark-source/operations/overlaps.ts";

// Scrub benchmark page. The runner (`tests/performance/scrub-benchmark.mjs`) loads it in
// Chromium and drives `window.timelineScrubBenchmark.run()`. Every tick changes only
// `document.currentTimeMs`, exactly as a controlled host does while scrubbing or playing.

type Surface = "editor" | "workbench";

type TickSample = {
  // flushSync render + commit, plus a forced style/layout read.
  commitMs: number;
  // Time from the update until the next animation frame callback (includes paint scheduling).
  frameMs: number;
};

type BenchmarkResult = {
  surface: Surface;
  mountedClips: number;
  samples: TickSample[];
  indexBuildMs: number;
};

declare global {
  interface Window {
    timelineScrubBenchmark?: {
      ready: boolean;
      mountedClips: () => number;
      run: (options: { warmupTicks: number; ticks: number }) => Promise<BenchmarkResult>;
    };
  }
}

const params = new URLSearchParams(window.location.search);
const surface: Surface = params.get("surface") === "editor" ? "editor" : "workbench";
const trackCount = Number(params.get("tracks") ?? 40);
const clipsPerTrack = Number(params.get("clipsPerTrack") ?? 50);
const clipPeriodMs = 1_000;
const pixelsPerSecond = Number(params.get("pps") ?? 24);
const palette = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c"];

function createBenchmarkDocument(): TimelineEditorDocument {
  return {
    durationMs: clipsPerTrack * clipPeriodMs,
    currentTimeMs: 0,
    tracks: Array.from({ length: trackCount }, (_, trackIndex) => {
      const trackId = `track-${trackIndex}`;

      return {
        id: trackId,
        label: `Track ${trackIndex + 1}`,
        items: Array.from({ length: clipsPerTrack }, (_, clipIndex) => ({
          id: `${trackId}-clip-${clipIndex}`,
          trackId,
          label: `Clip ${trackIndex + 1}.${clipIndex + 1}`,
          kind: "task",
          startMs: clipIndex * clipPeriodMs,
          durationMs: clipPeriodMs - 100,
          color: palette[(trackIndex + clipIndex) % palette.length],
        })),
      };
    }),
  };
}

const initialDocument = createBenchmarkDocument();
const viewport = { pixelsPerSecond, scrollLeftMs: 0 };
const virtualization = { rows: false } as const;
let setBenchmarkDocument: ((document: TimelineEditorDocument) => void) | undefined;
let latestDocument = initialDocument;

function BenchmarkApp() {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({
    itemIds: ["track-0-clip-0"],
    anchorItemId: "track-0-clip-0",
  });

  setBenchmarkDocument = (nextDocument) => {
    latestDocument = nextDocument;
    setDocument(nextDocument);
  };

  if (surface === "editor") {
    return (
      <TimelineEditor
        className="h-screen"
        document={document}
        selection={selection}
        viewport={viewport}
        minPixelsPerSecond={1}
        virtualization={virtualization}
        onDocumentChange={setDocument}
        onSelectionChange={setSelection}
        // Inline on purpose: typical hosts recreate menu builders on every render.
        getItemContextMenuItems={({ item }) => [
          { id: `rename-${item.id}`, label: `Rename ${item.label}` },
          { id: `delete-${item.id}`, label: "Delete" },
        ]}
      />
    );
  }

  return (
    <TimelineWorkbench
      className="h-screen"
      document={document}
      selection={selection}
      viewport={viewport}
      minPixelsPerSecond={1}
      virtualization={virtualization}
      showAssetsPanel={false}
      showInspectorPanel={false}
      showPreviewPanel={false}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
    />
  );
}

function mountedClips() {
  return window.document.querySelectorAll("[data-slot='timeline-editor-clip']").length;
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function tick(timeMs: number): TickSample {
  const startedAt = performance.now();
  flushSync(() => setBenchmarkDocument?.({ ...latestDocument, currentTimeMs: timeMs }));
  void window.document.body.getBoundingClientRect();
  return { commitMs: performance.now() - startedAt, frameMs: 0 };
}

function measureIndexBuild() {
  const runs = 20;
  const startedAt = performance.now();

  for (let run = 0; run < runs; run += 1) {
    createTimelineEditorDocumentIndex(latestDocument);
    detectTimelineEditorOverlaps(latestDocument.tracks);
  }

  return (performance.now() - startedAt) / runs;
}

window.timelineScrubBenchmark = {
  ready: false,
  mountedClips,
  async run({ warmupTicks, ticks }) {
    const durationMs = latestDocument.durationMs ?? 1;
    const stepMs = durationMs / (warmupTicks + ticks + 1);
    const samples: TickSample[] = [];

    for (let index = 0; index < warmupTicks + ticks; index += 1) {
      const updateStartedAt = performance.now();
      const sample = tick((index + 1) * stepMs);
      await nextFrame();
      sample.frameMs = performance.now() - updateStartedAt;

      if (index >= warmupTicks) {
        samples.push(sample);
      }
    }

    return { surface, mountedClips: mountedClips(), samples, indexBuildMs: measureIndexBuild() };
  },
};

createRoot(window.document.getElementById("root")!).render(<BenchmarkApp />);

void (async () => {
  while (mountedClips() === 0) {
    await nextFrame();
  }
  await nextFrame();
  window.timelineScrubBenchmark!.ready = true;
})();
