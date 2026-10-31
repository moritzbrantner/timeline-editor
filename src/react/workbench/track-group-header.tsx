"use client";

import { Button } from "@moritzbrantner/ui";

import type { TimelineEditorTrackGroup } from "../../core";

export function TimelineWorkbenchTrackGroupHeader({
  context,
  readOnly,
  updateTrackGroup,
  renameTrackGroup,
  removeTrackGroup,
}: {
  context: { group: TimelineEditorTrackGroup; locked: boolean };
  readOnly: boolean;
  updateTrackGroup: (
    groupId: string,
    patch: Pick<TimelineEditorTrackGroup, "collapsed"> | Pick<TimelineEditorTrackGroup, "locked">,
  ) => void;
  renameTrackGroup: (groupId: string) => void;
  removeTrackGroup: (groupId: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate">{context.group.label}</div>
        <div className="text-[10px] font-normal text-muted-foreground">
          {context.group.trackIds.length} tracks
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={readOnly}
          onClick={(event) => {
            event.stopPropagation();
            updateTrackGroup(context.group.id, { collapsed: !context.group.collapsed });
          }}
        >
          {context.group.collapsed ? "Expand" : "Collapse"}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={readOnly}
          onClick={(event) => {
            event.stopPropagation();
            updateTrackGroup(context.group.id, { locked: !context.group.locked });
          }}
        >
          {context.locked ? "Unlock" : "Lock"}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={readOnly}
          onClick={(event) => {
            event.stopPropagation();
            renameTrackGroup(context.group.id);
          }}
        >
          Rename
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={readOnly}
          onClick={(event) => {
            event.stopPropagation();
            removeTrackGroup(context.group.id);
          }}
        >
          Dissolve
        </Button>
      </div>
    </div>
  );
}
