import { describe, expect, test } from "vitest";

import { formatShortcutLabel } from "./shortcut-label";

describe("formatShortcutLabel", () => {
  test("formats compact shortcut labels without external keyboard helpers", () => {
    expect(formatShortcutLabel("Mod+A")).toBe("Mod+A");
    expect(formatShortcutLabel("shift+delete")).toBe("Shift+Delete");
  });
});
