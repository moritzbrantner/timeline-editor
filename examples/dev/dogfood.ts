import {
  portableConfigurationFromProfile,
  profileFromPortableConfiguration,
  resolvePortableConfiguration,
  serializePortableConfiguration,
  type ActionRegistry,
  type Binding,
  type PortableConfigurationV1,
  type Profile,
} from "@moritzbrantner/input-bindings";
import type { SettingDefinition } from "@moritzbrantner/settings-browser";

// The editor owns the meaning of these actions; input-bindings owns how they are assigned.
const shortcut = (action: string, key: string): Binding => ({
  id: `${action}.default`,
  action,
  sequence: [{ key: { kind: "logical", value: key } }],
  when: { op: "context", id: "timeline" },
  priority: 0,
});

export const timelineActions = {
  nextScenario: "timeline.nextScenario",
  toggleReadOnly: "timeline.toggleReadOnly",
  resetDocument: "timeline.resetDocument",
} as const;

export const timelineRegistry: ActionRegistry = {
  actions: [
    {
      id: timelineActions.nextScenario,
      title: "Next example",
      description: "Switch to the next editing workload.",
      categoryPath: ["Timeline playground"],
      repeatPolicy: "never",
      allowedDevices: ["keyboard"],
      defaults: [shortcut(timelineActions.nextScenario, "F8")],
    },
    {
      id: timelineActions.toggleReadOnly,
      title: "Toggle read-only",
      description: "Change the shared settings value that controls editor interaction.",
      categoryPath: ["Timeline playground"],
      repeatPolicy: "never",
      allowedDevices: ["keyboard"],
      defaults: [shortcut(timelineActions.toggleReadOnly, "F9")],
    },
    {
      id: timelineActions.resetDocument,
      title: "Reset example",
      description: "Restore the current document without resetting preferences.",
      categoryPath: ["Timeline playground"],
      repeatPolicy: "never",
      allowedDevices: ["keyboard"],
      defaults: [shortcut(timelineActions.resetDocument, "F10")],
    },
  ],
};

export const timelineSettings: readonly SettingDefinition[] = [
  {
    id: "timeline.readOnly",
    kind: { type: "bool" },
    default: { type: "bool", value: false },
    scope: "user",
    apply_mode: "immediate",
  },
  {
    id: "timeline.snapMs",
    kind: { type: "integer", min: 0, max: 1_000 },
    default: { type: "integer", value: 100 },
    scope: "user",
    apply_mode: "immediate",
  },
  {
    id: "timeline.pixelsPerSecond",
    kind: { type: "integer", min: 30, max: 240 },
    default: { type: "integer", value: 84 },
    scope: "user",
    apply_mode: "immediate",
  },
];

export const SETTINGS_STORAGE_KEY = "timeline-editor.pages.settings.v1";
export const BINDINGS_STORAGE_KEY = "timeline-editor.pages.bindings.v1";
const PROFILE_ID = "timeline-playground-user";
const REGISTRY_VERSION = 1;
const defaultBindings = timelineRegistry.actions.flatMap((action) => action.defaults ?? []);

const emptyProfile = (): Profile => ({ id: PROFILE_ID, patches: [] });

export function loadBindingsProfile(storage: Pick<Storage, "getItem">): Profile {
  try {
    const raw = storage.getItem(BINDINGS_STORAGE_KEY);
    if (!raw) return emptyProfile();
    const report = resolvePortableConfiguration(JSON.parse(raw) as PortableConfigurationV1, {
      registry: timelineRegistry,
      currentRegistryVersion: REGISTRY_VERSION,
    });
    if (report.valid && report.configuration) {
      return profileFromPortableConfiguration(report.configuration);
    }
  } catch {
    // Corrupt or outdated profiles must not disable the example.
  }
  return emptyProfile();
}

export function saveBindingsProfile(storage: Pick<Storage, "setItem">, profile: Profile): void {
  const { configuration } = portableConfigurationFromProfile(
    profile,
    defaultBindings,
    REGISTRY_VERSION,
  );
  storage.setItem(BINDINGS_STORAGE_KEY, serializePortableConfiguration(configuration));
}
