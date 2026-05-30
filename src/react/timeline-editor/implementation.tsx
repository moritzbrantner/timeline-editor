"use client";

import { TimelineEditorContent } from "./content";
import { TimelineEditorSnapFeedback, TimelineEditorLiveRegion } from "./overlays";
import { TimelineEditorProvider } from "./provider";
import { TimelineEditorRoot } from "./root";
import { TimelineEditorRuler } from "./ruler";
import { TimelineEditorTracks } from "./tracks";
import type { TimelineEditorProps, TimelineEditorProviderProps } from "./types";

export type {
  TimelineEditorClipPublicProps,
  TimelineEditorComponents,
  TimelineEditorContentProps,
  TimelineEditorContextValue,
  TimelineEditorFollowCurrentTime,
  TimelineEditorHotkeys,
  TimelineEditorItemContextMenuContext,
  TimelineEditorItemContextMenuItems,
  TimelineEditorItemRenderContext,
  TimelineEditorLiveRegionProps,
  TimelineEditorPlayheadProps,
  TimelineEditorProps,
  TimelineEditorProviderProps,
  TimelineEditorRangeOverlayProps,
  TimelineEditorRootProps,
  TimelineEditorRulerPublicProps,
  TimelineEditorSnapFeedbackProps,
  TimelineEditorSnapGuideProps,
  TimelineEditorTimelineContextMenuContext,
  TimelineEditorTimelineContextMenuItems,
  TimelineEditorTimelineContextMenuSource,
  TimelineEditorTrackContextMenuContext,
  TimelineEditorTrackContextMenuItems,
  TimelineEditorTrackEntry,
  TimelineEditorTrackGridProps,
  TimelineEditorTrackGroupRenderContext,
  TimelineEditorTrackGroupRowProps,
  TimelineEditorTrackHeaderProps,
  TimelineEditorTrackLaneProps,
  TimelineEditorTrackRenderContext,
  TimelineEditorTrackRowModel,
  TimelineEditorTrackRowProps,
  TimelineEditorTracksProps,
  TimelineEditorVirtualizationOptions,
} from "./types";
export {
  defaultTimelineEditorHotkeys,
  timelineEditorMaxPixelsPerSecond,
  timelineEditorMinPixelsPerSecond,
  timelineEditorTrackHeaderWidthPx,
} from "./constants";

export function TimelineEditor<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>({
  document,
  selection,
  viewport,
  readOnly,
  frameRate,
  tool,
  minItemDurationMs,
  editPolicy,
  snap,
  hotkeys,
  virtualization,
  followCurrentTime,
  onDocumentChange,
  onSelectionChange,
  onViewportChange,
  onCurrentTimeChange,
  renderItem,
  renderTrackHeader,
  renderTrackGroupHeader,
  getItemContextMenuItems,
  getTrackContextMenuItems,
  getTimelineContextMenuItems,
  ...rootProps
}: TimelineEditorProps<TTrackData, TItemData>) {
  const providerProps = {
    document,
    editPolicy,
    followCurrentTime,
    frameRate,
    getItemContextMenuItems,
    getTimelineContextMenuItems,
    getTrackContextMenuItems,
    hotkeys,
    minItemDurationMs,
    onCurrentTimeChange,
    onDocumentChange,
    onSelectionChange,
    onViewportChange,
    readOnly,
    renderItem,
    renderTrackGroupHeader,
    renderTrackHeader,
    selection,
    snap,
    tool,
    viewport,
    virtualization,
  } satisfies Omit<TimelineEditorProviderProps<TTrackData, TItemData>, "children">;

  return (
    <TimelineEditorProvider {...providerProps}>
      <TimelineEditorRoot {...rootProps}>
        <TimelineEditorContent>
          <TimelineEditorRuler />
          <TimelineEditorTracks />
          <TimelineEditorSnapFeedback />
          <TimelineEditorLiveRegion />
        </TimelineEditorContent>
      </TimelineEditorRoot>
    </TimelineEditorProvider>
  );
}
