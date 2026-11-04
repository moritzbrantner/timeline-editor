import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import {
  TimelineEditor,
  type TimelineEditorDocument,
  type TimelineEditorSelection,
} from "@moritzbrantner/timeline-editor";

const baseDocument: TimelineEditorDocument = {
  durationMs: 12_000,
  currentTimeMs: 1_500,
  markers: [
    { id: "intro", label: "Intro", timeMs: 1_000, color: "#2563eb" },
    { id: "review", label: "Review", timeMs: 6_000, color: "#15803d" },
  ],
  tracks: [
    {
      id: "video",
      label: "Video",
      acceptsItemKinds: ["video", "overlay"],
      items: [
        {
          id: "opening-shot",
          trackId: "video",
          label: "Opening shot",
          kind: "video",
          startMs: 0,
          durationMs: 3_200,
          color: "#2563eb",
        },
        {
          id: "product-demo",
          trackId: "video",
          label: "Product demo",
          kind: "video",
          startMs: 4_000,
          durationMs: 4_200,
          color: "#0e7490",
        },
      ],
    },
    {
      id: "audio",
      label: "Audio",
      acceptsItemKinds: ["audio"],
      items: [
        {
          id: "voiceover",
          trackId: "audio",
          label: "Voiceover",
          kind: "audio",
          startMs: 600,
          durationMs: 6_800,
          color: "#15803d",
        },
      ],
    },
    {
      id: "graphics",
      label: "Graphics",
      acceptsItemKinds: ["overlay"],
      items: [
        {
          id: "lower-third",
          trackId: "graphics",
          label: "Lower third",
          kind: "overlay",
          startMs: 2_000,
          durationMs: 1_800,
          color: "#6d28d9",
        },
      ],
    },
  ],
};

const denseDocument: TimelineEditorDocument = {
  durationMs: 10 * 60_000,
  currentTimeMs: 0,
  tracks: Array.from({ length: 80 }, (_, trackIndex) => ({
    id: `track-${trackIndex + 1}`,
    label: `Track ${trackIndex + 1}`,
    items: Array.from({ length: 40 }, (_, itemIndex) => ({
      id: `track-${trackIndex + 1}-item-${itemIndex + 1}`,
      trackId: `track-${trackIndex + 1}`,
      label: `Item ${trackIndex + 1}-${itemIndex + 1}`,
      startMs: itemIndex * 4_000,
      durationMs: 1_200,
      color: itemIndex % 2 === 0 ? "#2563eb" : "#15803d",
    })),
  })),
};

// A domain-neutral projection of the kinds of lanes used by story and vector-animation editors.
const authoredSequenceDocument: TimelineEditorDocument = {
  durationMs: 20_000,
  currentTimeMs: 5_000,
  groups: [
    { id: "narrative", label: "Narrative", trackIds: ["scenes", "narration"] },
    { id: "animation", label: "Animation", trackIds: ["poses", "effects"] },
  ],
  markers: [{ id: "reveal", label: "Reveal", timeMs: 10_000 }],
  tracks: [
    {
      id: "scenes",
      label: "Scenes",
      kind: "scene",
      acceptsItemKinds: ["scene"],
      items: [
        {
          id: "opening",
          trackId: "scenes",
          label: "Opening scene",
          kind: "scene",
          startMs: 0,
          durationMs: 9_000,
          color: "#2563eb",
        },
        {
          id: "reveal-scene",
          trackId: "scenes",
          label: "Reveal scene",
          kind: "scene",
          startMs: 10_000,
          durationMs: 8_000,
          color: "#0e7490",
        },
      ],
    },
    {
      id: "narration",
      label: "Narration",
      kind: "dialogue",
      items: [
        {
          id: "voiceover",
          trackId: "narration",
          label: "The story begins",
          kind: "dialogue",
          startMs: 1_500,
          durationMs: 8_000,
          color: "#15803d",
        },
      ],
    },
    {
      id: "poses",
      label: "Character pose",
      kind: "animation",
      items: [
        {
          id: "gesture",
          trackId: "poses",
          label: "Wave and turn",
          kind: "animation",
          startMs: 2_000,
          durationMs: 9_000,
          color: "#7c3aed",
          transform: {
            points: [
              { offsetMs: 0, values: { rotation: 0 }, easing: "ease-in-out" },
              { offsetMs: 2_500, values: { rotation: 20 }, easing: "ease-out" },
              { offsetMs: 5_000, values: { rotation: -8 }, easing: "linear" },
              { offsetMs: 9_000, values: { rotation: 0 }, easing: "ease-in-out" },
            ],
          },
        },
      ],
    },
    {
      id: "effects",
      label: "Effects",
      kind: "effect",
      items: [
        {
          id: "fade",
          trackId: "effects",
          label: "Fade to reveal",
          kind: "effect",
          startMs: 8_000,
          durationMs: 4_000,
          color: "#d97706",
          transform: {
            points: [
              { offsetMs: 0, values: { opacity: 0 } },
              { offsetMs: 4_000, values: { opacity: 1 } },
            ],
          },
        },
      ],
    },
  ],
};

type TimelineEditorStoryProps = {
  document: TimelineEditorDocument;
  readOnly?: boolean;
  selection?: TimelineEditorSelection;
};

function TimelineEditorStory({
  document: initialDocument,
  readOnly,
  selection,
}: TimelineEditorStoryProps) {
  const [document, setDocument] = useState(initialDocument);
  const [currentSelection, setCurrentSelection] = useState<TimelineEditorSelection>(
    selection ?? { itemIds: [] },
  );

  return (
    <div style={{ height: 520, padding: 16 }}>
      <TimelineEditor
        className="h-full"
        document={document}
        selection={currentSelection}
        readOnly={readOnly}
        viewport={{ pixelsPerSecond: 88 }}
        virtualization={{ rows: "auto", rowOverscanPx: 80 }}
        onDocumentChange={setDocument}
        onSelectionChange={setCurrentSelection}
      />
    </div>
  );
}

const meta = {
  title: "TimelineEditor/TimelineEditor",
  component: TimelineEditor,
  tags: ["autodocs", "test"],
  render: (args) => <TimelineEditorStory {...args} />,
} satisfies Meta<typeof TimelineEditorStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    document: baseDocument,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Video" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Opening shot" })).toBeVisible();
  },
};

export const ReadOnly: Story = {
  args: {
    document: baseDocument,
    readOnly: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Product demo" })).toBeVisible();
  },
};

export const WithMarkersAndRange: Story = {
  args: {
    document: baseDocument,
    selection: { itemIds: ["lower-third"], range: { startMs: 2_000, endMs: 4_000 } },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("button", { name: "Lower third" })).toBeVisible();
    await expect(canvasElement.querySelector('[title="Review"]')).not.toBeNull();
  },
};

export const DenseVirtualized: Story = {
  args: {
    document: denseDocument,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Track 1" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Item 1-1" })).toBeVisible();
  },
};

export const StoryAndAnimationTracks: Story = {
  args: { document: authoredSequenceDocument },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("button", { name: "Collapse Narrative" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Wave and turn" })).toBeVisible();
    await expect(
      canvasElement.querySelector("[data-slot='timeline-editor-clip-keyframes'][data-count='4']"),
    ).not.toBeNull();
  },
};
