import "@moritzbrantner/ui/styles.css";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ActionMenu, Button } from "@moritzbrantner/ui";

import {
  TimelineEditor,
  TimelineWorkbench,
  createTimelineAudioExtension,
  createTimelineAudioFileAsset,
  createTimelineMediaFileSource,
  createTimelineVideoExtension,
  type TimelineEditorDocument,
  type TimelineEditorEditPolicy,
  type TimelineEditorExtension,
  type TimelineEditorSelection,
  type TimelineEditorTrack,
  type TimelineWorkbenchAsset,
  type TimelineWorkbenchImportSource,
  type TimelineWorkbenchSelection,
  type TimelineWorkbenchTransportChangeReason,
  type TimelineWorkbenchTransportState,
} from "@moritzbrantner/timeline-editor";

const previewAudioFixtureFileName = "timeline-preview-fixture.wav";
const previewAudioFixtureUrl = `/${previewAudioFixtureFileName}`;
const previewVideoFixtureUrl = "/timeline-preview-fixture.webm";

type HarnessState = {
  changes: string[];
  document: TimelineEditorDocument;
  frameRate?: number;
  timeMode?: "frames" | "continuous";
  imports: Array<{
    fileName?: string;
    label?: string;
    size?: number;
    type: string;
    mimeType?: string;
    url?: string;
  }>;
  range?: TimelineEditorSelection["range"];
  selectedItemId: string | null;
  selectedItemIds: string[];
  transport?: TimelineWorkbenchTransportState;
  transportChanges: Array<{
    reason: TimelineWorkbenchTransportChangeReason;
    state: TimelineWorkbenchTransportState;
    currentTimeMs: number;
    durationMs: number;
  }>;
};

declare global {
  interface Window {
    __timelineEditorHarness: HarnessState;
  }
}

const createDocument = (): TimelineEditorDocument => ({
  tracks: [
    {
      id: "planning",
      label: "Planning",
      acceptsItemKinds: ["task", "review", "audio"],
      items: [
        {
          id: "brief",
          trackId: "planning",
          label: "Brief",
          kind: "task",
          startMs: 1_000,
          durationMs: 2_000,
          color: "#2563eb",
        },
      ],
    },
    {
      id: "review",
      label: "Review",
      acceptsItemKinds: ["review"],
      items: [],
    },
  ] satisfies TimelineEditorTrack[],
  durationMs: 8_000,
  currentTimeMs: 1_000,
  markers: [{ id: "handoff", timeMs: 4_000, label: "Handoff" }],
});

const createOverlapPreventDocument = (): TimelineEditorDocument => ({
  tracks: [
    {
      id: "planning",
      label: "Planning",
      acceptsItemKinds: ["task", "review"],
      items: [
        {
          id: "first",
          trackId: "planning",
          label: "First",
          kind: "task",
          startMs: 1_000,
          durationMs: 2_000,
          color: "#2563eb",
        },
        {
          id: "second",
          trackId: "planning",
          label: "Second",
          kind: "task",
          startMs: 3_500,
          durationMs: 1_500,
          color: "#15803d",
        },
      ],
    },
  ] satisfies TimelineEditorTrack[],
  durationMs: 8_000,
  currentTimeMs: 1_000,
  markers: [{ id: "handoff", timeMs: 4_000, label: "Handoff" }],
});

const createNoActiveItemsDocument = (): TimelineEditorDocument => ({
  ...createDocument(),
  currentTimeMs: 7_500,
});

const createNoMarkersDocument = (): TimelineEditorDocument => ({
  ...createDocument(),
  markers: [],
});

const createPreviewModesDocument = (): TimelineEditorDocument => ({
  tracks: [
    {
      id: "scene",
      label: "Scene",
      acceptsItemKinds: ["task"],
      items: [
        {
          id: "active-scene",
          trackId: "scene",
          label: "Active Scene",
          kind: "task",
          startMs: 500,
          durationMs: 2_000,
          color: "#2563eb",
        },
        {
          id: "selected-scene",
          trackId: "scene",
          label: "Selected Scene",
          kind: "task",
          startMs: 5_000,
          durationMs: 1_000,
          color: "#15803d",
        },
      ],
    },
    {
      id: "notes",
      label: "Notes",
      items: [],
    },
  ] satisfies TimelineEditorTrack[],
  durationMs: 8_000,
  currentTimeMs: 1_000,
});

const createLargeDocument = (): TimelineEditorDocument => ({
  durationMs: 10 * 60_000,
  currentTimeMs: 0,
  groups: [
    {
      id: "collapsed-program",
      label: "Collapsed Program",
      trackIds: Array.from({ length: 20 }, (_, index) => `track-${index + 1}`),
      collapsed: true,
    },
    {
      id: "active-program",
      label: "Active Program",
      trackIds: Array.from({ length: 20 }, (_, index) => `track-${index + 21}`),
    },
  ],
  tracks: Array.from({ length: 200 }, (_, trackIndex) => ({
    id: `track-${trackIndex + 1}`,
    label: `Track ${trackIndex + 1}`,
    items: Array.from({ length: 100 }, (_, itemIndex) => ({
      id: `track-${trackIndex + 1}-item-${itemIndex + 1}`,
      trackId: `track-${trackIndex + 1}`,
      label: `Item ${trackIndex + 1}-${itemIndex + 1}`,
      startMs: itemIndex * 5_000,
      durationMs: 1_000,
      color: itemIndex % 2 === 0 ? "#2563eb" : "#15803d",
    })),
  })),
});

const createTransportMediaDocument = (): TimelineEditorDocument => ({
  durationMs: 8_000,
  currentTimeMs: 1_000,
  tracks: [
    {
      id: "visuals",
      label: "Visuals",
      acceptsItemKinds: ["image", "video", "text"],
      items: [
        {
          id: "hero-image",
          trackId: "visuals",
          label: "Hero Image",
          kind: "image",
          startMs: 0,
          durationMs: 4_000,
          color: "#2563eb",
          data: {
            mediaType: "image",
            source: {
              uri: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'%3E%3Crect width='640' height='360' fill='%232563eb'/%3E%3C/svg%3E",
            },
            alt: "Hero image",
            fit: "cover",
          },
        },
        {
          id: "caption",
          trackId: "visuals",
          label: "Caption",
          kind: "text",
          startMs: 0,
          durationMs: 4_000,
          color: "#15803d",
          data: { mediaType: "text", text: "Transport caption" },
        },
      ],
    },
    {
      id: "media",
      label: "Media",
      acceptsItemKinds: ["video", "audio"],
      items: [
        {
          id: "demo-video",
          trackId: "media",
          label: "Demo Video",
          kind: "video",
          startMs: 500,
          durationMs: 7_000,
          color: "#92400e",
          data: {
            mediaType: "video",
            source: {
              uri: previewVideoFixtureUrl,
              label: "timeline-preview-fixture.webm",
              mimeType: "video/webm",
            },
            poster:
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'%3E%3Crect width='640' height='360' fill='%2316a34a'/%3E%3C/svg%3E",
            fit: "contain",
            muted: true,
            volume: 0.4,
            sourceStartMs: 250,
          },
        },
        {
          id: "demo-audio",
          trackId: "media",
          label: "Demo Audio",
          kind: "audio",
          startMs: 500,
          durationMs: 7_000,
          color: "#9333ea",
          data: {
            mediaType: "audio",
            source: {
              uri: previewAudioFixtureUrl,
              label: previewAudioFixtureFileName,
              mimeType: "audio/wav",
            },
            volume: 0.5,
            sourceStartMs: 500,
          },
        },
      ],
    },
  ] satisfies TimelineEditorTrack[],
});

const createTransportEndpointsDocument = (): TimelineEditorDocument => ({
  ...createDocument(),
  durationMs: 8_000,
  currentTimeMs: 0,
});

const createLargeRightEdgeDocument = (): TimelineEditorDocument => ({
  ...createLargeDocument(),
  currentTimeMs: 9 * 60_000,
});

const timelineAssets = [
  {
    id: "prototype",
    label: "Prototype",
    kind: "review",
    durationMs: 1_000,
    color: "#15803d",
    description: "Review pass",
  },
  {
    id: "handoff-task",
    label: "Handoff task",
    kind: "task",
    durationMs: 1_500,
    color: "#9333ea",
    description: "Planning task",
  },
] satisfies TimelineWorkbenchAsset[];

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const readOnly = searchParams.get("readOnly") === "true";
  const fixture = searchParams.get("fixture") ?? "basic";
  const largeFixture = fixture === "large";
  const timelineMenuFixture = searchParams.get("timelineMenu") === "true";
  const importAssetsFixture = searchParams.get("importAssets") === "true";
  const importMode = searchParams.get("importMode");
  const allowUrlImport = searchParams.get("allowUrlImport") === "true";
  const assetActionsFixture = searchParams.get("assetActions") === "true";
  const emptyAssetsFixture = searchParams.get("assets") === "none";
  const transformInspectorFixture = searchParams.get("transformInspector") === "true";
  const editPolicy: Partial<TimelineEditorEditPolicy> | undefined =
    searchParams.get("editPolicy") === "prevent"
      ? { overlap: "prevent", ripple: false }
      : undefined;
  const frameRateParam = searchParams.get("frameRate");
  const initialFrameRate = frameRateParam ? Number(frameRateParam) : undefined;
  const [frameRate, setFrameRate] = useState<number | undefined>(initialFrameRate);
  const timeMode = searchParams.get("timeMode") === "continuous" ? "continuous" : undefined;
  const [document, setDocument] = useState(() => {
    const fixtureDocument = createFixtureDocument(fixture);
    const initialTime = searchParams.get("initialTimeMs");
    const initialTimeMs = initialTime === null ? undefined : Number(initialTime);

    return Number.isFinite(initialTimeMs)
      ? { ...fixtureDocument, currentTimeMs: initialTimeMs }
      : fixtureDocument;
  });
  const [selection, setSelection] = useState<TimelineEditorSelection>(() => ({
    itemIds: [],
    range: parseInitialRange(searchParams.get("initialRange")),
  }));
  const changes = useRef<string[]>([]);
  const imports = useRef<HarnessState["imports"]>([]);
  const transport = useRef<TimelineWorkbenchTransportState | undefined>(undefined);
  const transportChanges = useRef<HarnessState["transportChanges"]>([]);

  useEffect(() => {
    if (searchParams.get("mockMedia") !== "true") {
      return;
    }

    const play = HTMLMediaElement.prototype.play;
    const pause = HTMLMediaElement.prototype.pause;
    const pausedDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "paused");
    const pausedState = new WeakMap<HTMLMediaElement, boolean>();
    const getCount = (element: HTMLMediaElement, key: "playCount" | "pauseCount") =>
      Number.parseInt(element.dataset[key] ?? "0", 10) || 0;

    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get() {
        return pausedState.get(this) ?? true;
      },
    });

    HTMLMediaElement.prototype.play = function mockPlay() {
      pausedState.set(this, false);
      this.dataset["playState"] = "playing";
      this.dataset["playCount"] = String(getCount(this, "playCount") + 1);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function mockPause() {
      const wasPaused = pausedState.get(this) ?? this.dataset["playState"] !== "playing";

      pausedState.set(this, true);
      this.dataset["playState"] = "paused";
      if (!wasPaused) {
        this.dataset["pauseCount"] = String(getCount(this, "pauseCount") + 1);
      }
    };

    return () => {
      HTMLMediaElement.prototype.play = play;
      HTMLMediaElement.prototype.pause = pause;
      if (pausedDescriptor) {
        Object.defineProperty(HTMLMediaElement.prototype, "paused", pausedDescriptor);
      } else {
        delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>)["paused"];
      }
    };
  }, [searchParams]);

  useEffect(() => {
    window["__timelineEditorHarness"] = {
      changes: changes.current,
      document,
      frameRate,
      timeMode: timeMode ?? (frameRate ? "frames" : "continuous"),
      imports: imports.current,
      range: selection.range,
      selectedItemId: selection.itemIds[0] ?? null,
      selectedItemIds: selection.itemIds,
      transport: transport.current,
      transportChanges: transportChanges.current,
    };
  }, [document, frameRate, selection, timeMode]);

  const recordChange = (change: string) => {
    const nextChanges = [...changes.current, change];
    changes.current = nextChanges;

    if (window["__timelineEditorHarness"]) {
      window["__timelineEditorHarness"].changes = nextChanges;
    }
  };

  const handleDocumentChange = (nextDocument: TimelineEditorDocument) => {
    recordChange("document");
    setDocument(nextDocument);
  };

  const handleCurrentTimeChange = (timeMs: number) => {
    recordChange(`current-time:${timeMs}`);
  };

  const handleSelectionChange = (nextSelection: TimelineEditorSelection) => {
    recordChange(`selection:${nextSelection.itemIds.join(",")}`);
    setSelection(nextSelection);
  };

  const handleSelectedItemChange = (selection: TimelineWorkbenchSelection) => {
    recordChange(`selected:${selection.itemId ?? ""}`);
  };

  const handleTransportStateChange = (
    state: TimelineWorkbenchTransportState,
    context: {
      reason: TimelineWorkbenchTransportChangeReason;
      currentTimeMs: number;
      durationMs: number;
    },
  ) => {
    transport.current = state;
    transportChanges.current = [
      ...transportChanges.current,
      {
        reason: context.reason,
        state,
        currentTimeMs: context.currentTimeMs,
        durationMs: context.durationMs,
      },
    ];

    if (window["__timelineEditorHarness"]) {
      window["__timelineEditorHarness"].transport = transport.current;
      window["__timelineEditorHarness"].transportChanges = transportChanges.current;
    }

    recordChange(`transport:${context.reason}:${state.status}:${state.playbackRate}`);
  };

  const handleImportAssets = async (sources: TimelineWorkbenchImportSource[]) => {
    const previousImportCount = imports.current.length;
    const nextImports = sources.map((source) => ({
      type: source.type,
      label: source.label,
      fileName: source.file?.name,
      size: source.file?.size,
      mimeType: source.file?.type,
      url: source.url,
    }));
    imports.current = [...imports.current, ...nextImports];

    if (window["__timelineEditorHarness"]) {
      window["__timelineEditorHarness"].imports = imports.current;
    }

    recordChange(
      `import:${nextImports.map((source) => source.fileName ?? source.label).join(",")}`,
    );

    if (importMode === "fail") {
      return sources.map((source) => ({
        errors: [`Could not import ${source.label ?? source.file?.name ?? source.url}.`],
        metadata: source.metadata,
      }));
    }

    if (importMode === "retry" && previousImportCount === 0) {
      return sources.map((source) => ({
        errors: [`Temporary failure for ${source.label ?? source.file?.name ?? source.url}.`],
        metadata: source.metadata,
      }));
    }

    if (importMode === "warnings") {
      return sources.map((source, index) => {
        const label = source.label ?? source.file?.name ?? source.url ?? "Imported asset";

        return {
          asset: {
            id: `warning-${index}-${label
              .toLowerCase()
              .replaceAll(/[^a-z0-9]+/g, "-")
              .replaceAll(/^-|-$/g, "")}`,
            label,
            kind: "task",
            mediaType: "video",
            durationMs: 750,
            description: "Imported with warnings",
          } satisfies TimelineWorkbenchAsset,
          warnings: [`Recovered ${label} with fallback metadata.`],
          metadata: source.metadata,
        };
      });
    }

    return Promise.all(
      sources.map(async (source) => {
        const label = source.label ?? source.file?.name ?? source.url ?? "Imported asset";

        if (source.file?.type.startsWith("audio/")) {
          return createTimelineAudioFileAsset(source.file, {
            durationMs: 750,
            color: "#15803d",
            waveform: [0.2, 0.6, 0.95, 0.45, 0.7, 0.3],
          });
        }

        const fileSource = source.file
          ? createTimelineMediaFileSource(source.file, { label })
          : undefined;

        return {
          asset: {
            id: `imported-${label
              .toLowerCase()
              .replaceAll(/[^a-z0-9]+/g, "-")
              .replaceAll(/^-|-$/g, "")}`,
            label,
            kind: "task",
            mediaType: "video",
            durationMs: 750,
            color: "#92400e",
            description: "Imported file",
            data: {
              fileName: source.file?.name,
              source: source.url ? { uri: source.url, label } : fileSource?.source,
              imported: true,
              mediaType: "video",
            },
          } satisfies TimelineWorkbenchAsset,
        };
      }),
    );
  };

  if (largeFixture && searchParams.get("surface") !== "workbench") {
    return (
      <div className="p-4">
        <TimelineEditor
          className="h-[360px]"
          document={document}
          selection={selection}
          readOnly={readOnly}
          editPolicy={editPolicy}
          viewport={{ pixelsPerSecond: 80 }}
          virtualization={{ rows: true, rowOverscanPx: 80 }}
          onDocumentChange={handleDocumentChange}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    );
  }

  return (
    <TimelineWorkbench
      document={document}
      selection={selection}
      readOnly={readOnly}
      editPolicy={editPolicy}
      virtualization={largeFixture ? { rows: true, rowOverscanPx: 80 } : undefined}
      pixelsPerSecond={80}
      frameRate={frameRate}
      timeMode={timeMode}
      snapMs={100}
      assets={emptyAssetsFixture ? [] : timelineAssets}
      acceptedImportTypes={["audio/*", "video/*"]}
      inspectorSchema={
        transformInspectorFixture
          ? {
              transformFields: [
                { id: "x", label: "X", step: 1, defaultValue: 0 },
                { id: "opacity", label: "Opacity", min: 0, max: 1, step: 0.1, defaultValue: 1 },
              ],
            }
          : undefined
      }
      showAssetsPanel={searchParams.get("showAssetsPanel") !== "false"}
      showPreviewPanel={searchParams.get("showPreviewPanel") !== "false"}
      showInspectorPanel={searchParams.get("showInspectorPanel") !== "false"}
      onImportAssets={importAssetsFixture ? handleImportAssets : undefined}
      allowUrlImport={allowUrlImport}
      onDocumentChange={handleDocumentChange}
      onCurrentTimeChange={handleCurrentTimeChange}
      onSelectionChange={handleSelectionChange}
      onSelectedItemChange={handleSelectedItemChange}
      onTransportStateChange={handleTransportStateChange}
      onSnapChange={(nextSnap) => recordChange(`snap:${JSON.stringify(nextSnap)}`)}
      extensions={[
        createTimelineAudioExtension() as unknown as TimelineEditorExtension,
        createTimelineVideoExtension() as unknown as TimelineEditorExtension,
      ]}
      getTimelineContextMenuItems={
        timelineMenuFixture
          ? (context) => [
              {
                id: "record-timeline-time",
                label: "Record timeline time",
                onSelect: () =>
                  recordChange(`timeline-menu:${context.snappedTimeMs}:${context.track?.id ?? ""}`),
              },
              {
                id: "frame-rate",
                type: "radio-group",
                label: "Frame rate",
                value: String(frameRate ?? ""),
                options: [24, 25, 30, 50, 60].map((fps) => ({
                  id: `fps-${fps}`,
                  value: String(fps),
                  label: `${fps} fps`,
                })),
                onValueChange: (value) => {
                  const nextFrameRate = Number(value);
                  setFrameRate(nextFrameRate);
                  recordChange(`frame-rate:${nextFrameRate}`);
                },
              },
            ]
          : undefined
      }
      renderAsset={(asset) =>
        assetActionsFixture ? (
          <div className="flex w-full items-center justify-between gap-2">
            <div className="min-w-0">
              <div>{asset.label}</div>
              <div className="text-xs text-muted-foreground">{asset.description}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Delete ${asset.label}`}
                data-timeline-workbench-asset-action=""
                onClick={() => recordChange(`asset-action:delete:${asset.id}`)}
              >
                Delete
              </Button>
              <ActionMenu
                label={`${asset.label} actions`}
                trigger={
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`${asset.label} menu`}
                    data-timeline-workbench-asset-action=""
                  >
                    More
                  </Button>
                }
                items={[
                  {
                    id: `delete-${asset.id}`,
                    label: `Delete ${asset.label} from menu`,
                    onSelect: () => recordChange(`asset-action:delete-menu:${asset.id}`),
                  },
                ]}
              />
            </div>
          </div>
        ) : (
          <div>
            <div>{asset.label}</div>
            <div className="text-xs text-muted-foreground">{asset.description}</div>
          </div>
        )
      }
    />
  );
}

function createFixtureDocument(fixture: string): TimelineEditorDocument {
  if (fixture === "large") {
    return createLargeDocument();
  }

  if (fixture === "large-right-edge") {
    return createLargeRightEdgeDocument();
  }

  if (fixture === "overlap-prevent") {
    return createOverlapPreventDocument();
  }

  if (fixture === "no-active") {
    return createNoActiveItemsDocument();
  }

  if (fixture === "no-markers") {
    return createNoMarkersDocument();
  }

  if (fixture === "preview-modes") {
    return createPreviewModesDocument();
  }

  if (fixture === "transport-media") {
    return createTransportMediaDocument();
  }

  if (fixture === "transport-endpoints") {
    return createTransportEndpointsDocument();
  }

  return createDocument();
}

function parseInitialRange(value: string | null): TimelineEditorSelection["range"] {
  if (!value) {
    return undefined;
  }

  const match = /^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/.exec(value);

  if (!match) {
    return undefined;
  }

  const startMs = Number(match[1]);
  const endMs = Number(match[2]);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return undefined;
  }

  return { startMs, endMs };
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(<App />);
