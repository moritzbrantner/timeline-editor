"use client";

import { useEffect } from "react";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

import {
  ContextActionMenu,
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  type MenuActionItem,
  type MenuActionRenderContext,
} from "@moritzbrantner/ui";

type TimelineEditorContextActionMenuProps = Pick<
  ComponentProps<typeof ContextActionMenu>,
  "children" | "contentProps" | "items"
>;

export function TimelineEditorContextActionMenu({
  children,
  contentProps,
  items,
}: TimelineEditorContextActionMenuProps) {
  useTimelineEditorContextMenuPointerBridge();

  return (
    <ContextActionMenu
      items={items}
      contentProps={contentProps}
      renderItem={renderTimelineEditorContextMenuItem}
    >
      {children}
    </ContextActionMenu>
  );
}

export function renderTimelineEditorContextMenuItem(
  item: MenuActionItem,
  context: MenuActionRenderContext,
) {
  if (item.type === "separator") {
    return <ContextMenuSeparator key={item.id} />;
  }

  if (item.type === "label") {
    return (
      <ContextMenuLabel key={item.id}>
        <TimelineEditorContextMenuItemContent item={item} />
      </ContextMenuLabel>
    );
  }

  if (item.type === "checkbox") {
    return (
      <ContextMenuCheckboxItem
        key={item.id}
        ref={(element) =>
          registerTimelineEditorContextMenuPointerAction(element, () => {
            item.onCheckedChange?.(!item.checked, item.id, item);
          })
        }
        checked={item.checked}
        disabled={item.disabled}
        data-slot="context-action-menu-item"
        onClick={preventPointerActivatedClick}
        onSelect={(event) => {
          event.preventDefault();

          if (isTimelineEditorContextMenuPointerActivated(event.currentTarget)) {
            return;
          }

          item.onCheckedChange?.(!item.checked, item.id, item);
        }}
      >
        <TimelineEditorContextMenuItemContent item={item} />
      </ContextMenuCheckboxItem>
    );
  }

  if (item.type === "radio-group") {
    return (
      <ContextMenuRadioGroup key={item.id} value={item.value} onValueChange={() => undefined}>
        {item.label ? <ContextMenuLabel>{item.label}</ContextMenuLabel> : null}
        {item.options.map((option) => (
          <ContextMenuRadioItem
            key={option.id}
            ref={(element) =>
              registerTimelineEditorContextMenuPointerAction(element, () => {
                item.onValueChange?.(option.value, item.id, item);
              })
            }
            value={option.value}
            disabled={option.disabled}
            data-slot="context-action-menu-item"
            onClick={preventPointerActivatedClick}
            onSelect={(event) => {
              event.preventDefault();

              if (isTimelineEditorContextMenuPointerActivated(event.currentTarget)) {
                return;
              }

              item.onValueChange?.(option.value, item.id, item);
            }}
          >
            <TimelineEditorContextMenuItemContent item={option} />
          </ContextMenuRadioItem>
        ))}
      </ContextMenuRadioGroup>
    );
  }

  if (item.type === "custom") {
    return <TimelineEditorContextMenuCustomItem key={item.id} item={item} context={context} />;
  }

  return (
    <ContextMenuItem
      key={item.id}
      ref={(element) =>
        registerTimelineEditorContextMenuPointerAction(element, () => {
          item.onSelect?.(item.id, item);

          if (item.closeOnSelect !== false && element) {
            closeTimelineEditorContextMenuFromItem(element);
          }
        })
      }
      disabled={item.disabled}
      variant={item.destructive ? "destructive" : "default"}
      data-slot="context-action-menu-item"
      data-destructive={item.destructive ? "" : undefined}
      onClick={preventPointerActivatedClick}
      onSelect={(event) => {
        if (item.disabled) {
          event.preventDefault();
          return;
        }

        if (isTimelineEditorContextMenuPointerActivated(event.currentTarget)) {
          event.preventDefault();
          return;
        }

        item.onSelect?.(item.id, item);

        if (item.closeOnSelect === false) {
          event.preventDefault();
        }
      }}
    >
      <TimelineEditorContextMenuItemContent item={item} />
    </ContextMenuItem>
  );
}

function TimelineEditorContextMenuCustomItem({
  context,
  item,
}: {
  context: MenuActionRenderContext;
  item: Extract<MenuActionItem, { type: "custom" }>;
}) {
  return <>{item.render(context)}</>;
}

function TimelineEditorContextMenuItemContent({
  item,
}: {
  item: Extract<MenuActionItem, { label: ReactNode }>;
}) {
  return (
    <>
      {"icon" in item && item.icon ? (
        <span data-slot="context-action-menu-item-icon" className="shrink-0 text-muted-foreground">
          {item.icon}
        </span>
      ) : null}
      <span data-slot="context-action-menu-item-content" className="min-w-0 flex-1">
        <span className="block truncate">{item.label}</span>
        {"description" in item && item.description ? (
          <span
            data-slot="context-action-menu-item-description"
            className="mt-0.5 block whitespace-normal text-xs leading-snug text-muted-foreground"
          >
            {item.description}
          </span>
        ) : null}
      </span>
      {"shortcut" in item && item.shortcut ? (
        <span
          data-slot="context-action-menu-item-shortcut"
          className="ml-auto shrink-0 text-xs tracking-widest text-muted-foreground"
        >
          {item.shortcut}
        </span>
      ) : null}
    </>
  );
}

function preventPointerActivatedClick(event: MouseEvent<HTMLElement>) {
  const element = event.currentTarget;

  if (element.dataset["timelineEditorPointerActivated"] !== "true") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  window.setTimeout(() => {
    delete element.dataset["timelineEditorPointerActivated"];
  }, 0);
}

const timelineEditorContextMenuPointerActions = new WeakMap<HTMLElement, () => void>();
let timelineEditorContextMenuPointerBridgeSubscribers = 0;
let teardownTimelineEditorContextMenuPointerBridge: (() => void) | null = null;

function registerTimelineEditorContextMenuPointerAction(
  element: HTMLElement | null,
  action: () => void,
) {
  if (!element) {
    return;
  }

  element.dataset["timelineEditorContextMenuPointerAction"] = "true";
  timelineEditorContextMenuPointerActions.set(element, action);
}

function useTimelineEditorContextMenuPointerBridge() {
  useEffect(() => {
    timelineEditorContextMenuPointerBridgeSubscribers += 1;

    if (!teardownTimelineEditorContextMenuPointerBridge) {
      teardownTimelineEditorContextMenuPointerBridge =
        installTimelineEditorContextMenuPointerBridge();
    }

    return () => {
      timelineEditorContextMenuPointerBridgeSubscribers -= 1;

      if (
        timelineEditorContextMenuPointerBridgeSubscribers === 0 &&
        teardownTimelineEditorContextMenuPointerBridge
      ) {
        teardownTimelineEditorContextMenuPointerBridge();
        teardownTimelineEditorContextMenuPointerBridge = null;
      }
    };
  }, []);
}

function installTimelineEditorContextMenuPointerBridge() {
  const handlePointerDown = (event: globalThis.PointerEvent) => {
    const target = event.target;
    const actionTarget =
      target instanceof Element
        ? target.closest<HTMLElement>("[data-timeline-editor-context-menu-pointer-action='true']")
        : null;

    if (
      !actionTarget ||
      event.button !== 0 ||
      actionTarget.getAttribute("aria-disabled") === "true" ||
      actionTarget.hasAttribute("data-disabled")
    ) {
      return;
    }

    const action = timelineEditorContextMenuPointerActions.get(actionTarget);

    if (!action) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    actionTarget.dataset["timelineEditorPointerActivated"] = "true";
    action();
    window.setTimeout(() => {
      delete actionTarget.dataset["timelineEditorPointerActivated"];
    }, 250);
  };

  document.addEventListener("pointerdown", handlePointerDown, true);

  return () => {
    document.removeEventListener("pointerdown", handlePointerDown, true);
  };
}

function closeTimelineEditorContextMenuFromItem(element: HTMLElement) {
  element.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Escape",
      key: "Escape",
    }),
  );
}

function isTimelineEditorContextMenuPointerActivated(element: EventTarget | null) {
  return (
    element instanceof HTMLElement && element.dataset["timelineEditorPointerActivated"] === "true"
  );
}
