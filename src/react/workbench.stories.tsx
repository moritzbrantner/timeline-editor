import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import {
  TimelineWorkbench,
  type TimelineEditorDocument,
  type TimelineEditorEditPolicy,
  type TimelineEditorSelection,
  type TimelineWorkbenchAsset,
  type TimelineWorkbenchImportSource,
} from "@moritzbrantner/timeline-editor";

const editingDocument: TimelineEditorDocument = {
  durationMs: 18_000,
  currentTimeMs: 2_000,
  markers: [
    { id: "intro", timeMs: 2_000, label: "Intro", color: "#2563eb" },
    { id: "review", timeMs: 8_000, label: "Review", color: "#16a34a" },
    { id: "ship", timeMs: 15_000, label: "Ship", color: "#f59e0b" },
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
          durationMs: 4_200,
          color: "#2563eb",
        },
        {
          id: "product-demo",
          trackId: "video",
          label: "Product demo",
          kind: "video",
          startMs: 5_000,
          durationMs: 5_500,
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
          startMs: 800,
          durationMs: 9_000,
          color: "#16a34a",
        },
        {
          id: "music-bed",
          trackId: "audio",
          label: "Music bed",
          kind: "audio",
          startMs: 0,
          durationMs: 16_000,
          color: "#65a30d",
        },
      ],
    },
    {
      id: "notes",
      label: "Notes",
      acceptsItemKinds: ["note", "overlay"],
      items: [
        {
          id: "lower-third",
          trackId: "notes",
          label: "Lower third",
          kind: "overlay",
          startMs: 2_300,
          durationMs: 2_200,
          color: "#7c3aed",
        },
        {
          id: "review-note",
          trackId: "notes",
          label: "Review note",
          kind: "note",
          startMs: 8_000,
          durationMs: 2_000,
          color: "#f59e0b",
        },
      ],
    },
  ],
};

const overlapDocument: TimelineEditorDocument = {
  durationMs: 8_000,
  currentTimeMs: 1_000,
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
          color: "#16a34a",
        },
      ],
    },
  ],
};

const assets = [
  {
    id: "b-roll",
    label: "B-roll clip",
    kind: "video",
    mediaType: "video",
    durationMs: 3_000,
    color: "#0f766e",
    description: "Video insert",
    data: {
      mediaType: "video",
      source: { label: "b-roll.mp4", mimeType: "video/mp4" },
    },
  },
  {
    id: "caption",
    label: "Caption",
    kind: "overlay",
    durationMs: 1_800,
    color: "#7c3aed",
    description: "Timed text",
  },
  {
    id: "sound-effect",
    label: "Sound effect",
    kind: "audio",
    durationMs: 1_200,
    color: "#16a34a",
    description: "Audio cue",
  },
  {
    id: "annotation",
    label: "Annotation",
    kind: "note",
    durationMs: 2_400,
    color: "#f59e0b",
    description: "Review marker",
  },
] satisfies TimelineWorkbenchAsset[];

type TimelineWorkbenchStoryProps = {
  acceptedImportTypes?: string[];
  assets?: TimelineWorkbenchAsset[];
  document: TimelineEditorDocument;
  editPolicy?: Partial<TimelineEditorEditPolicy>;
  importAssets?: boolean;
  readOnly?: boolean;
};

function TimelineWorkbenchStory({
  acceptedImportTypes,
  assets: initialAssets = assets,
  document: initialDocument,
  editPolicy,
  importAssets,
  readOnly,
}: TimelineWorkbenchStoryProps) {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const [importedAssets, setImportedAssets] = useState<TimelineWorkbenchAsset[]>([]);
  const resolvedAssets = initialAssets.concat(importedAssets);

  const handleImportAssets = (sources: TimelineWorkbenchImportSource[]) => {
    const nextAssets = sources.map((source) => ({
      id: `imported-${source.label ?? source.file?.name ?? "asset"}`,
      label: source.label ?? source.file?.name ?? "Imported asset",
      kind: "video",
      mediaType: "video",
      durationMs: 1_000,
      color: "#f59e0b",
      description: "Imported file",
    })) satisfies TimelineWorkbenchAsset[];

    setImportedAssets((currentAssets) => currentAssets.concat(nextAssets));

    return nextAssets.map((asset) => ({ asset }));
  };

  return (
    <div style={{ height: 720 }}>
      <TimelineWorkbench
        document={document}
        selection={selection}
        readOnly={readOnly}
        editPolicy={editPolicy}
        pixelsPerSecond={84}
        snapMs={100}
        assets={resolvedAssets}
        acceptedImportTypes={acceptedImportTypes}
        onImportAssets={importAssets ? handleImportAssets : undefined}
        onDocumentChange={setDocument}
        onSelectionChange={setSelection}
      />
    </div>
  );
}

const meta = {
  title: "TimelineEditor/TimelineWorkbench",
  component: TimelineWorkbench,
  tags: ["autodocs", "test"],
  render: (args) => <TimelineWorkbenchStory {...args} />,
} satisfies Meta<typeof TimelineWorkbenchStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EditingWorkbench: Story = {
  args: {
    document: editingDocument,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Assets")).toBeVisible();
    await expect(canvas.getByLabelText("Opening shot")).toBeVisible();
  },
};

export const ReadOnlyWorkbench: Story = {
  args: {
    document: editingDocument,
    readOnly: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Product demo")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Add Track" })).toBeDisabled();
  },
};

export const AssetImport: Story = {
  args: {
    acceptedImportTypes: ["video/*"],
    document: editingDocument,
    importAssets: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Import files" })).toBeVisible();
    await expect(canvas.getByLabelText("B-roll clip")).toBeVisible();
  },
};

export const OverlapPrevention: Story = {
  args: {
    document: overlapDocument,
    editPolicy: { overlap: "prevent", ripple: false },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("First")).toBeVisible();
    await expect(canvas.getByLabelText("Second")).toBeVisible();
  },
};
