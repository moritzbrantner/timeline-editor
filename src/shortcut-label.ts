export function formatShortcutLabel(shortcut: string) {
  return shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(formatShortcutPart)
    .join("+");
}

function formatShortcutPart(part: string) {
  const normalized = part.toLocaleLowerCase();

  if (normalized === "mod") {
    return "Mod";
  }

  if (normalized === "ctrl" || normalized === "control") {
    return "Ctrl";
  }

  if (normalized === "cmd" || normalized === "command" || normalized === "meta") {
    return "Meta";
  }

  if (normalized === "alt") {
    return "Alt";
  }

  if (normalized === "shift") {
    return "Shift";
  }

  return part.length === 1
    ? part.toLocaleUpperCase()
    : part.charAt(0).toLocaleUpperCase() + part.slice(1);
}
