"use client";

import { cloneElement, useState } from "react";
import type { ReactElement } from "react";
import { flushSync } from "react-dom";

import type { MenuActionItem } from "@moritzbrantner/ui";

import { TimelineEditorContextActionMenu } from "./context-menu-items";

type TimelineEditorContextMenuTargetProps<TContext> = {
  children: ReactElement<{ onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void }>;
  contentProps?: { [key: `data-${string}`]: string | number | boolean | undefined };
  getContext: (event: React.MouseEvent<HTMLElement>) => TContext;
  getItems?: (context: TContext) => MenuActionItem[];
};

export function TimelineEditorContextMenuTarget<TContext>({
  children,
  contentProps,
  getContext,
  getItems,
}: TimelineEditorContextMenuTargetProps<TContext>) {
  const [items, setItems] = useState<MenuActionItem[]>([]);

  if (!getItems) {
    return children;
  }

  return (
    <TimelineEditorContextActionMenu items={items} contentProps={contentProps}>
      {cloneElement(children, {
        onContextMenu: (event) => {
          children.props.onContextMenu?.(event);

          if (event.defaultPrevented) {
            return;
          }

          const nextItems = getItems(getContext(event));

          if (nextItems.length === 0) {
            event.preventDefault();
            event.stopPropagation();
            flushSync(() => setItems([]));
            return;
          }

          event.stopPropagation();
          flushSync(() => setItems(nextItems));
        },
      })}
    </TimelineEditorContextActionMenu>
  );
}
