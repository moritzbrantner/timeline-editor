import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import {
  TimelineEditorClip,
  TimelineEditorContent,
  TimelineEditorLiveRegion,
  TimelineEditorProvider,
  TimelineEditorRoot,
  TimelineEditorRuler,
  TimelineEditorTracks,
  type TimelineEditorDocument,
  type TimelineEditorTrack,
} from "@moritzbrantner/timeline-editor";

const componentDocument: TimelineEditorDocument = {
  durationMs: 6_000,
  currentTimeMs: 1_500,
  groups: [{ id: "program", label: "Program", trackIds: ["planning", "review"] }],
  markers: [{ id: "handoff", label: "Handoff", timeMs: 4_000, color: "#92400e" }],
  tracks: [
    {
      id: "planning",
      label: "Planning",
      acceptsItemKinds: ["task", "review"],
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
};

function TimelineEditorComponentPartsStory() {
  return (
    <div style={{ height: 420, padding: 16 }}>
      <TimelineEditorProvider
        document={componentDocument}
        selection={{
          itemIds: ["brief"],
          anchorItemId: "brief",
          range: { startMs: 500, endMs: 2_500 },
          trackIds: ["planning"],
        }}
        viewport={{ pixelsPerSecond: 100 }}
      >
        <TimelineEditorRoot className="h-full">
          <TimelineEditorContent>
            <TimelineEditorRuler />
            <TimelineEditorTracks />
            <TimelineEditorLiveRegion />
          </TimelineEditorContent>
        </TimelineEditorRoot>
      </TimelineEditorProvider>
    </div>
  );
}

function StandaloneClipStory() {
  const item = componentDocument.tracks[0]!.items[0]!;

  return (
    <div style={{ display: "grid", gap: 12, padding: 16 }}>
      <div style={{ height: 48, position: "relative" }}>
        <TimelineEditorClip
          item={{ ...item, id: "minimal", startMs: 0, durationMs: 500 }}
          durationMs={6_000}
          timelineWidthPx={600}
        />
      </div>
      <div style={{ height: 48, position: "relative" }}>
        <TimelineEditorClip
          item={{ ...item, id: "compact", startMs: 0, durationMs: 1_000 }}
          durationMs={6_000}
          timelineWidthPx={600}
        />
      </div>
      <div style={{ height: 48, position: "relative" }}>
        <TimelineEditorClip item={item} selected durationMs={6_000} timelineWidthPx={600} />
      </div>
      <div style={{ height: 48, position: "relative" }}>
        <TimelineEditorClip
          item={{
            ...item,
            id: "stateful",
            itemGroupId: "group-a",
            locked: true,
            transform: {
              points: [
                { offsetMs: 0, values: { opacity: 1 } },
                { offsetMs: 2_000, values: { opacity: 0.5 } },
              ],
            },
          }}
          durationMs={6_000}
          timelineWidthPx={600}
        />
      </div>
    </div>
  );
}

function SelectedStandaloneClipStory() {
  return (
    <div style={{ height: 72, padding: 16, position: "relative" }}>
      <TimelineEditorClip
        item={componentDocument.tracks[0]!.items[0]!}
        selected
        durationMs={6_000}
        timelineWidthPx={600}
      />
    </div>
  );
}

const meta = {
  title: "TimelineEditor/Component Parts",
  tags: ["autodocs", "test"],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ProviderRootContentRulerAndTracks: Story = {
  render: () => <TimelineEditorComponentPartsStory />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Program")).toBeVisible();
    await expect(canvas.getByText("Planning")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Brief" })).toBeVisible();
    await expect(
      canvasElement.querySelector("[data-slot='timeline-editor-range-overlay']"),
    ).not.toBeNull();
  },
};

export const Clip: Story = {
  render: () => <StandaloneClipStory />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole("button", { name: /Brief/ })[0]).toBeVisible();
    await expect(
      canvasElement.querySelector("[data-slot='timeline-editor-clip'][data-density='minimal']"),
    ).not.toBeNull();
    await expect(
      canvasElement.querySelector("[data-slot='timeline-editor-clip'][data-density='compact']"),
    ).not.toBeNull();
    await expect(
      canvasElement.querySelector("[data-slot='timeline-editor-clip'][data-density='full']"),
    ).not.toBeNull();
  },
};

export const SelectedClip: Story = {
  render: () => <SelectedStandaloneClipStory />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /Brief/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
