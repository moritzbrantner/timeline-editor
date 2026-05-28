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
    { id: "review", label: "Review", timeMs: 6_000, color: "#16a34a" },
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
          color: "#0891b2",
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
          color: "#16a34a",
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
          color: "#7c3aed",
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
      color: itemIndex % 2 === 0 ? "#2563eb" : "#16a34a",
    })),
  })),
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
    await expect(canvas.getByText("Video")).toBeVisible();
    await expect(canvas.getByLabelText("Opening shot")).toBeVisible();
  },
};

export const ReadOnly: Story = {
  args: {
    document: baseDocument,
    readOnly: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Product demo")).toBeVisible();
  },
};

export const WithMarkersAndRange: Story = {
  args: {
    document: baseDocument,
    selection: { itemIds: ["lower-third"], range: { startMs: 2_000, endMs: 4_000 } },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByLabelText("Lower third")).toBeVisible();
    await expect(canvasElement.querySelector('[title="Review"]')).not.toBeNull();
  },
};

export const DenseVirtualized: Story = {
  args: {
    document: denseDocument,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Track 1")).toBeVisible();
    await expect(canvas.getByLabelText("Item 1-1")).toBeVisible();
  },
};
