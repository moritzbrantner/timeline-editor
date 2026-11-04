import "@moritzbrantner/ui/styles.css";
import "@moritzbrantner/ui/component-sources.css";
import "../timeline-sources.css";
import "@moritzbrantner/input-bindings-react/workbench.css";
import "./styles.css";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createSettingsSession,
  type BrowserSettingsSession,
  type SettingValue,
} from "@moritzbrantner/settings-browser";
import { InputBindingsWorkbench } from "@moritzbrantner/input-bindings-react/workbench";
import { InputRuntimeController } from "@moritzbrantner/input-bindings-runtime";
import { attachKeyboardRuntime } from "@moritzbrantner/input-bindings-web";
import type { Profile } from "@moritzbrantner/input-bindings";

import {
  TimelineWorkbench,
  createTimelineAudioExtension,
  createTimelineVideoExtension,
  formatTimelineEditorTimeMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorSelection,
  type TimelineWorkbenchAsset,
} from "@moritzbrantner/timeline-editor";
import { denseDocument, storyAnimationDocument } from "../scenarios";
import {
  SETTINGS_STORAGE_KEY,
  loadBindingsProfile,
  saveBindingsProfile,
  timelineActions,
  timelineRegistry,
  timelineSettings,
} from "./dogfood";

const previewAudioUrl = `${import.meta.env.BASE_URL}timeline-preview-fixture.wav`;
const previewVideoUrl = `${import.meta.env.BASE_URL}timeline-preview-fixture.webm`;

const initialDocument: TimelineEditorDocument = {
  durationMs: 18_000,
  currentTimeMs: 2_000,
  markers: [
    { id: "intro", timeMs: 2_000, label: "Intro", color: "#2563eb" },
    { id: "review", timeMs: 8_000, label: "Review", color: "#16a34a" },
    { id: "ship", timeMs: 15_000, label: "Ship", color: "#f59e0b" },
  ],
  groups: [{ id: "program", label: "Program", trackIds: ["video", "audio", "notes"] }],
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
          data: {
            mediaType: "video",
            source: {
              label: "timeline-preview-fixture.webm",
              uri: previewVideoUrl,
              mimeType: "video/webm",
            },
            muted: true,
            fit: "contain",
          },
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
          data: {
            mediaType: "audio",
            source: {
              label: "timeline-preview-fixture.wav",
              uri: previewAudioUrl,
              mimeType: "audio/wav",
            },
            muted: true,
            volume: 0.85,
            channels: 2,
            sampleRate: 44_100,
            waveform: [0.12, 0.34, 0.68, 0.92, 0.56, 0.77, 0.42, 0.25],
          },
        },
        {
          id: "music-bed",
          trackId: "audio",
          label: "Music bed",
          kind: "audio",
          startMs: 0,
          durationMs: 16_000,
          color: "#65a30d",
          data: {
            mediaType: "audio",
            volume: 0.35,
            channels: 2,
            sampleRate: 44_100,
            waveform: [0.18, 0.24, 0.32, 0.28, 0.36, 0.3, 0.22, 0.26, 0.34, 0.29],
          },
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
          transform: {
            points: [
              { offsetMs: 0, values: { x: 0, opacity: 1 } },
              { offsetMs: 2_200, values: { x: 120, opacity: 0.75 }, easing: "ease-out" },
            ],
          },
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
    mediaType: "video",
    durationMs: 3_000,
    color: "#0f766e",
    description: "Video insert",
    data: {
      mediaType: "video",
      source: {
        label: "timeline-preview-fixture.webm",
        uri: previewVideoUrl,
        mimeType: "video/webm",
      },
      muted: true,
      fit: "contain",
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
    mediaType: "audio",
    durationMs: 1_200,
    color: "#16a34a",
    description: "Audio cue",
    data: {
      mediaType: "audio",
      source: {
        label: "timeline-preview-fixture.wav",
        uri: previewAudioUrl,
        mimeType: "audio/wav",
      },
      volume: 0.85,
      channels: 2,
      sampleRate: 44_100,
      waveform: [0.2, 0.6, 0.95, 0.45, 0.7, 0.3],
    },
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

type ScenarioId = "media" | "story" | "dense";
type Panel = "settings" | "controls" | null;

const scenarios: readonly { id: ScenarioId; label: string; description: string }[] = [
  {
    id: "media",
    label: "Media editing",
    description: "Video, audio, markers, transforms and asset placement",
  },
  {
    id: "story",
    label: "Story & animation",
    description: "Scenes, narration, character poses and timed effects",
  },
  {
    id: "dense",
    label: "Dense timeline",
    description: "80 tracks and 3,200 clips for scrolling and virtualization",
  },
];

function scenarioDocument(id: ScenarioId): TimelineEditorDocument {
  if (id === "story") return storyAnimationDocument;
  if (id === "dense") return denseDocument;
  return initialDocument;
}

function initialScenario(): ScenarioId {
  const fromUrl = new URLSearchParams(window.location.search).get("scenario");
  return scenarios.find((scenario) => scenario.id === fromUrl)?.id ?? "media";
}

function persistedProfile(): Profile {
  try {
    return loadBindingsProfile(window.localStorage);
  } catch {
    return { id: "timeline-playground-user", patches: [] };
  }
}

function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>(initialScenario);
  const [document, setDocument] = useState(() => scenarioDocument(initialScenario()));
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const [panel, setPanel] = useState<Panel>(null);
  const [settingsSession, setSettingsSession] = useState<BrowserSettingsSession | null>(null);
  const [settingsValues, setSettingsValues] = useState<Record<string, SettingValue>>(() =>
    Object.fromEntries(timelineSettings.map((setting) => [setting.id, setting.default])),
  );
  const [profile, setProfile] = useState<Profile>(persistedProfile);
  const [status, setStatus] = useState("Try dragging a clip or select a different example.");
  const actionsRef = useRef<Readonly<Record<string, () => void>>>({});

  useEffect(() => {
    let cancelled = false;
    let sessionToDispose: BrowserSettingsSession | null = null;
    void createSettingsSession(timelineSettings)
      .then((session) => {
        sessionToDispose = session;
        if (cancelled) {
          session.dispose();
          return;
        }
        try {
          const snapshot = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
          if (snapshot) session.importScope("user", snapshot);
        } catch {
          setStatus("Stored settings could not be restored; using defaults.");
        }
        setSettingsSession(session);
        setSettingsValues(session.effectiveValues());
      })
      .catch((error: unknown) => setStatus(`Settings unavailable: ${String(error)}`));

    return () => {
      cancelled = true;
      sessionToDispose?.dispose();
    };
  }, []);

  const changeSetting = (id: string, value: SettingValue) => {
    if (!settingsSession) return;
    try {
      settingsSession.set(id, value);
      setSettingsValues(settingsSession.effectiveValues());
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, settingsSession.exportScope("user"));
      setStatus(`${id.replace("timeline.", "")} updated through shared settings.`);
    } catch (error) {
      setStatus(`Could not save setting: ${String(error)}`);
    }
  };

  const readOnlyValue = settingsValues["timeline.readOnly"];
  const snapValue = settingsValues["timeline.snapMs"];
  const scaleValue = settingsValues["timeline.pixelsPerSecond"];
  const readOnly = readOnlyValue?.type === "bool" && readOnlyValue.value;
  const snapMs = snapValue?.type === "integer" ? snapValue.value : 100;
  const pixelsPerSecond = scaleValue?.type === "integer" ? scaleValue.value : 84;

  const changeScenario = (next: ScenarioId) => {
    setScenarioId(next);
    setDocument(scenarioDocument(next));
    setSelection({ itemIds: [] });
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", next);
    window.history.replaceState(null, "", url);
    setStatus(`Loaded ${scenarios.find((scenario) => scenario.id === next)?.label}.`);
  };

  const updateDocument = (nextDocument: TimelineEditorDocument) => {
    setDocument(nextDocument);
  };

  const updateSelection = (nextSelection: TimelineEditorSelection) => {
    setSelection(nextSelection);
  };

  const resetDocument = () => {
    setDocument(scenarioDocument(scenarioId));
    setSelection({ itemIds: [] });
    setStatus("Example document reset; settings and bindings preserved.");
  };

  const changeProfile = (nextProfile: Profile) => {
    setProfile(nextProfile);
    try {
      saveBindingsProfile(window.localStorage, nextProfile);
      setStatus("Bindings saved through the shared input-bindings format.");
    } catch {
      setStatus("Bindings active for this session but could not be saved locally.");
    }
  };

  // The input runtime only owns shell commands. Native timeline shortcuts and drag gestures
  // remain with the timeline editor, and the controls editor exclusively owns rebinding input.
  actionsRef.current = {
    [timelineActions.nextScenario]: () => {
      const current = scenarios.findIndex((scenario) => scenario.id === scenarioId);
      changeScenario(scenarios[(current + 1) % scenarios.length]!.id);
    },
    [timelineActions.toggleReadOnly]: () =>
      changeSetting("timeline.readOnly", { type: "bool", value: !readOnly }),
    [timelineActions.resetDocument]: resetDocument,
  };

  useEffect(() => {
    if (panel !== null) return;
    const runtime = new InputRuntimeController({
      registry: timelineRegistry,
      profile,
      getActiveContexts: () => new Set(["timeline"]),
      onDispatch: (event) => {
        if (event.phase === "press") actionsRef.current[event.action]?.();
      },
    });
    return attachKeyboardRuntime(runtime, {
      mode: "logical",
      ignoreTextEntry: true,
      stopPropagation: true,
    });
  }, [profile, panel]);

  return (
    <main className="dev-shell">
      <section className="dev-stage" aria-label="Timeline editor example">
        <header className="dev-header">
          <div>
            <p className="dev-kicker">@moritzbrantner/timeline-editor</p>
            <h1>Timeline Editor Playground</h1>
          </div>
          <div className="dev-header-actions">
            <button
              type="button"
              className="dev-button"
              aria-expanded={panel === "settings"}
              onClick={() => setPanel(panel === "settings" ? null : "settings")}
            >
              Settings
            </button>
            <button
              type="button"
              className="dev-button"
              aria-expanded={panel === "controls"}
              onClick={() => setPanel(panel === "controls" ? null : "controls")}
            >
              Input bindings
            </button>
            <button type="button" className="dev-button" onClick={resetDocument}>
              Reset
            </button>
          </div>
        </header>

        <div className="dev-scenario-bar">
          <label htmlFor="scenario-picker">Try an example</label>
          <select
            id="scenario-picker"
            value={scenarioId}
            onChange={(event) => changeScenario(event.currentTarget.value as ScenarioId)}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.label}
              </option>
            ))}
          </select>
          <span>{scenarios.find((scenario) => scenario.id === scenarioId)?.description}</span>
          <a href="./storybook/">Component stories</a>
        </div>

        {panel === "settings" && (
          <section className="dev-panel dev-settings" aria-label="Timeline preferences">
            <div className="dev-panel-header">
              <div>
                <h2>Editor settings</h2>
                <p>
                  Shared settings session; changes immediately affect the actual editor and survive
                  refresh.
                </p>
              </div>
              <button
                className="dev-button"
                type="button"
                onClick={() => {
                  if (!settingsSession) return;
                  settingsSession.resetAll();
                  setSettingsValues(settingsSession.effectiveValues());
                  window.localStorage.setItem(
                    SETTINGS_STORAGE_KEY,
                    settingsSession.exportScope("user"),
                  );
                  setStatus("Settings restored to defaults.");
                }}
              >
                Reset preferences
              </button>
            </div>
            <label className="dev-setting">
              <span>Read-only</span>
              <input
                type="checkbox"
                checked={readOnly}
                disabled={!settingsSession}
                onChange={(event) =>
                  changeSetting("timeline.readOnly", {
                    type: "bool",
                    value: event.currentTarget.checked,
                  })
                }
              />
            </label>
            <label className="dev-setting">
              <span>
                Snap interval <strong>{snapMs} ms</strong>
              </span>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={snapMs}
                disabled={!settingsSession}
                onChange={(event) =>
                  changeSetting("timeline.snapMs", {
                    type: "integer",
                    value: Number(event.currentTarget.value),
                  })
                }
              />
            </label>
            <label className="dev-setting">
              <span>
                Timeline scale <strong>{pixelsPerSecond} px/s</strong>
              </span>
              <input
                type="range"
                min="30"
                max="240"
                step="1"
                value={pixelsPerSecond}
                disabled={!settingsSession}
                onChange={(event) =>
                  changeSetting("timeline.pixelsPerSecond", {
                    type: "integer",
                    value: Number(event.currentTarget.value),
                  })
                }
              />
            </label>
          </section>
        )}

        {panel === "controls" && (
          <section className="dev-panel dev-controls" aria-label="Input binding editor">
            <InputBindingsWorkbench
              registry={timelineRegistry}
              profile={profile}
              onProfileChange={changeProfile}
              title="Timeline input bindings"
              description="Rebind the playground commands and inspect conflicts. Changes take effect when you close this panel."
              contextScenarios={[
                {
                  id: "timeline",
                  label: "Timeline",
                  activeContexts: ["timeline"],
                  stack: [],
                  defaultKeyboardMode: "logical",
                },
              ]}
            />
          </section>
        )}

        <p className="dev-status" role="status">
          {status}{" "}
          <span>
            Default shell shortcuts: F8 next example · F9 read-only · F10 reset.{" "}
            <a href="https://moritzbrantner.github.io/workflow-editor/">Try Workflow Editor</a>.
          </span>
        </p>

        <div className="dev-workbench-frame">
          <TimelineWorkbench
            className="dev-workbench"
            document={document}
            selection={selection}
            readOnly={readOnly}
            pixelsPerSecond={pixelsPerSecond}
            snapMs={snapMs}
            assets={scenarioId === "media" ? assets : []}
            extensions={[createTimelineAudioExtension(), createTimelineVideoExtension()]}
            inspectorSchema={{
              transformFields: [
                { id: "x", label: "X", step: 1, defaultValue: 0 },
                { id: "opacity", label: "Opacity", min: 0, max: 1, step: 0.1, defaultValue: 1 },
              ],
            }}
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
        </div>
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
