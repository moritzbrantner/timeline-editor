import type { KeyboardEvent } from "react";
import { describe, expect, test, vi } from "vitest";

import { defaultTimelineWorkbenchHotkeys } from "./hotkeys";
import {
  handleTimelineWorkbenchKeyDown,
  type TimelineWorkbenchKeyboardCommands,
} from "./use-workbench-hotkeys";

function createCommands() {
  return new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get: (target, name: string) => (target[name] ??= vi.fn()),
  }) as unknown as TimelineWorkbenchKeyboardCommands & Record<string, ReturnType<typeof vi.fn>>;
}

function press(init: KeyboardEventInit) {
  const nativeEvent = new KeyboardEvent("keydown", { cancelable: true, ...init });
  const event = {
    altKey: nativeEvent.altKey,
    code: nativeEvent.code,
    ctrlKey: nativeEvent.ctrlKey,
    defaultPrevented: false,
    key: nativeEvent.key,
    metaKey: nativeEvent.metaKey,
    nativeEvent,
    preventDefault: vi.fn(),
    shiftKey: nativeEvent.shiftKey,
    target: document.body,
  };

  return event as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("handleTimelineWorkbenchKeyDown", () => {
  test("the earlier binding wins when two hotkeys collide", () => {
    const commands = createCommands();
    const event = press({ key: "x" });

    handleTimelineWorkbenchKeyDown(
      event,
      { ...defaultTimelineWorkbenchHotkeys, playPause: "X", cut: "X" },
      false,
      commands,
    );

    expect(commands.toggleTransport).toHaveBeenCalledOnce();
    expect(commands.cutItems).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  test("Backspace deletes even when the delete hotkey is rebound", () => {
    const commands = createCommands();

    handleTimelineWorkbenchKeyDown(
      press({ key: "Backspace" }),
      { ...defaultTimelineWorkbenchHotkeys, delete: "Q" },
      false,
      commands,
    );

    expect(commands.deleteItems).toHaveBeenCalledOnce();
  });

  test("read-only ignores everything except the copy hotkey", () => {
    const commands = createCommands();
    const hotkeys = { ...defaultTimelineWorkbenchHotkeys, copy: "X", playPause: "X", cut: "Y" };
    const ignored = press({ key: "y" });

    handleTimelineWorkbenchKeyDown(ignored, hotkeys, true, commands);
    expect(ignored.preventDefault).not.toHaveBeenCalled();
    expect(commands.cutItems).not.toHaveBeenCalled();

    handleTimelineWorkbenchKeyDown(press({ key: "x" }), hotkeys, true, commands);
    expect(commands.toggleTransport).not.toHaveBeenCalled();
    expect(commands.copyItems).toHaveBeenCalledOnce();
  });

  test("falls through to the tool hotkeys after every command", () => {
    const commands = createCommands();

    handleTimelineWorkbenchKeyDown(
      press({ key: "b" }),
      defaultTimelineWorkbenchHotkeys,
      false,
      commands,
    );

    expect(commands.setTool).toHaveBeenCalledWith("blade");
  });
});
