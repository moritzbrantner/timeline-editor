import { describe, expect, it } from "vitest";
import {
  validateCompiledRegistry,
  compileActionRegistry,
  type Profile,
} from "@moritzbrantner/input-bindings";
import {
  BINDINGS_STORAGE_KEY,
  loadBindingsProfile,
  saveBindingsProfile,
  timelineRegistry,
  timelineSettings,
} from "./dogfood";

describe("hosted timeline editor uses shared preferences and bindings", () => {
  it("declares distinct, valid shell shortcuts without taking core editor gestures", () => {
    const result = validateCompiledRegistry(compileActionRegistry(timelineRegistry));
    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.effectiveBindings).toHaveLength(3);
    expect(result.effectiveBindings.every((binding) => binding.when?.op === "context")).toBe(true);
    expect(timelineSettings.map((setting) => setting.id)).toEqual([
      "timeline.readOnly",
      "timeline.snapMs",
      "timeline.pixelsPerSecond",
    ]);
  });

  it("preserves a remapped key through the shared portable persistence contract", () => {
    const replaced = timelineRegistry.actions[0]!.defaults![0]!;
    const profile: Profile = {
      id: "timeline-test",
      patches: [
        {
          op: "replace",
          bindingId: replaced.id,
          binding: {
            ...replaced,
            sequence: [{ key: { kind: "logical", value: "F7" } }],
          },
        },
      ],
    };
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };
    saveBindingsProfile(mockStorage, profile);
    expect(JSON.parse(storage.get(BINDINGS_STORAGE_KEY)!)).toMatchObject({ registryVersion: 1 });
    expect(loadBindingsProfile(mockStorage)).toEqual(profile);
  });

  it("falls back to defaults for invalid or corrupt stored profiles", () => {
    const profile = loadBindingsProfile({ getItem: () => "{invalid" });
    expect(profile.patches).toEqual([]);
  });
});
