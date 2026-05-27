import "@moritzbrantner/ui/styles.css";
import "./styles.css";

import { useState } from "react";
import { createRoot } from "react-dom/client";

import {
  TimelineWorkbench,
  formatTimelineEditorTimeMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorSelection,
  type TimelineWorkbenchAsset,
} from "@moritzbrantner/timeline-editor";

const initialDocument: TimelineEditorDocument = {
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

const assets = [
  {
    id: "b-roll",
    label: "B-roll clip",
    kind: "video",
    durationMs: 3_000,
    color: "#0f766e",
    description: "Video insert",
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

function App() {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const [readOnly, setReadOnly] = useState(false);

  const updateDocument = (nextDocument: TimelineEditorDocument) => {
    setDocument(nextDocument);
  };

  const updateSelection = (nextSelection: TimelineEditorSelection) => {
    setSelection(nextSelection);
  };

  const resetDocument = () => {
    setDocument(initialDocument);
    setSelection({ itemIds: [] });
  };

  return (
    <main className="dev-shell">
      <section className="dev-stage" aria-label="Timeline editor example">
        <header className="dev-header">
          <div>
            <p className="dev-kicker">@moritzbrantner/timeline-editor</p>
            <h1>Development Workbench</h1>
          </div>
          <div className="dev-header-actions">
            <label className="dev-toggle">
              <input
                type="checkbox"
                checked={readOnly}
                onChange={(event) => setReadOnly(event.currentTarget.checked)}
              />
              Read-only
            </label>
            <button type="button" className="dev-button" onClick={resetDocument}>
              Reset
            </button>
          </div>
        </header>

        <TimelineWorkbench
          className="dev-workbench"
          document={document}
          selection={selection}
          readOnly={readOnly}
          pixelsPerSecond={84}
          snapMs={100}
          assets={assets}
          onDocumentChange={updateDocument}
          onSelectionChange={updateSelection}
          renderAsset={(asset) => (
            <div className="dev-asset">
              <span className="dev-swatch" style={{ background: asset.color }} />
              <span>
                <strong>{asset.label}</strong>
                <small>
                  {asset.description} - {formatTimelineEditorTimeMs(asset.durationMs)}
                </small>
              </span>
            </div>
          )}
          renderTimelineItem={(context) => <TimelineItemPreview item={context.item} />}
          getItemContextMenuItems={(context) => [
            {
              id: "lock",
              label: context.item.locked ? "Unlock item" : "Lock item",
              disabled: context.readOnly,
              onSelect: () => {
                context.updateItem(context.item.id, { locked: !context.item.locked });
              },
            },
          ]}
        />
      </section>
    </main>
  );
}

function TimelineItemPreview({ item }: { item: TimelineEditorItem }) {
  return (
    <div className="dev-timeline-item">
      <span>{item.label}</span>
      <small>{item.kind ?? "item"}</small>
    </div>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(<App />);
