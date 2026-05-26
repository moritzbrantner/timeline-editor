import "@moritzbrantner/ui/styles.css";
import "./styles.css";

import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  TimelineWorkbench,
  detectTimelineEditorOverlaps,
  formatTimelineEditorTimeMs,
  getTimelineEditorDurationMs,
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorSelection,
  type TimelineWorkbenchAsset,
} from "@moritzbrantner/timeline-editor";

type DevEvent = {
  id: string;
  label: string;
};

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
  const [events, setEvents] = useState<DevEvent[]>([]);
  const [snapshot, setSnapshot] = useState(() => serializeTimelineEditorDocument(initialDocument));
  const selectedItems = useMemo(
    () =>
      document.tracks.flatMap((track) =>
        track.items.filter((item) => selection.itemIds.includes(item.id)),
      ),
    [document.tracks, selection.itemIds],
  );
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 0);
  const overlaps = useMemo(() => detectTimelineEditorOverlaps(document.tracks), [document.tracks]);

  const recordEvent = (label: string) => {
    setEvents((current) => [{ id: `${Date.now()}-${label}`, label }, ...current].slice(0, 6));
  };

  const updateDocument = (nextDocument: TimelineEditorDocument) => {
    setDocument(nextDocument);
    setSnapshot(serializeTimelineEditorDocument(nextDocument));
    recordEvent("Document changed");
  };

  const updateSelection = (nextSelection: TimelineEditorSelection) => {
    setSelection(nextSelection);
    recordEvent(
      nextSelection.itemIds.length > 0
        ? `Selected ${nextSelection.itemIds.join(", ")}`
        : "Selection cleared",
    );
  };

  const resetDocument = () => {
    setDocument(initialDocument);
    setSelection({ itemIds: [] });
    setSnapshot(serializeTimelineEditorDocument(initialDocument));
    recordEvent("Example reset");
  };

  const restoreSnapshot = () => {
    try {
      const nextDocument = parseTimelineEditorDocument(snapshot);
      setDocument(nextDocument);
      setSelection({ itemIds: [] });
      recordEvent("Snapshot restored");
    } catch (error) {
      recordEvent(error instanceof Error ? error.message : "Snapshot restore failed");
    }
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
                onChange={(event) => {
                  setReadOnly(event.currentTarget.checked);
                  recordEvent(
                    event.currentTarget.checked ? "Read-only enabled" : "Editing enabled",
                  );
                }}
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
          onCurrentTimeChange={(timeMs) => {
            recordEvent(`Playhead ${formatTimelineEditorTimeMs(timeMs)}`);
          }}
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
                recordEvent(`${context.item.locked ? "Unlocked" : "Locked"} ${context.item.label}`);
              },
            },
          ]}
        />
      </section>

      <aside className="dev-sidebar" aria-label="Example state">
        <section className="dev-panel">
          <h2>Document</h2>
          <dl className="dev-stats">
            <div>
              <dt>Duration</dt>
              <dd>{formatTimelineEditorTimeMs(durationMs)}</dd>
            </div>
            <div>
              <dt>Tracks</dt>
              <dd>{document.tracks.length}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>{document.tracks.reduce((count, track) => count + track.items.length, 0)}</dd>
            </div>
            <div>
              <dt>Overlaps</dt>
              <dd>{overlaps.length}</dd>
            </div>
          </dl>
        </section>

        <section className="dev-panel">
          <h2>Selection</h2>
          {selectedItems.length > 0 ? (
            <div className="dev-selection-list">
              {selectedItems.map((item) => (
                <div key={item.id} className="dev-selection-item">
                  <span className="dev-swatch" style={{ background: item.color }} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>
                      {formatTimelineEditorTimeMs(item.startMs)} -{" "}
                      {formatTimelineEditorTimeMs(item.durationMs)}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dev-muted">No timeline items selected.</p>
          )}
        </section>

        <section className="dev-panel">
          <div className="dev-panel-header">
            <h2>Serialized</h2>
            <button
              type="button"
              className="dev-button dev-button-compact"
              onClick={restoreSnapshot}
            >
              Restore
            </button>
          </div>
          <textarea
            className="dev-snapshot"
            value={snapshot}
            spellCheck={false}
            onChange={(event) => setSnapshot(event.currentTarget.value)}
          />
        </section>

        <section className="dev-panel">
          <h2>Events</h2>
          {events.length > 0 ? (
            <ol className="dev-events">
              {events.map((event) => (
                <li key={event.id}>{event.label}</li>
              ))}
            </ol>
          ) : (
            <p className="dev-muted">Interact with the timeline to see events.</p>
          )}
        </section>
      </aside>
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
