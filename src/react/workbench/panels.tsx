import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";

import {
  EditorPane,
  EditorPaneLayout,
  EditorPaneMain,
  EditorPaneToggle,
  EditorToolbar,
  EditorToolbarGroup,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  WorkbenchCanvas,
  cn,
} from "@moritzbrantner/ui";

import type {
  TimelineWorkbenchPaneId,
  TimelineWorkbenchPaneLayout,
  TimelineWorkbenchPanelLayout,
  TimelineWorkbenchPanelLayoutChangeContext,
  TimelineWorkbenchPanelPresentation,
} from "./types";

export function shouldShowTimelineWorkbenchAssetsPanel(options: {
  showAssetsPanel: boolean;
  assetCount: number;
  hasImporter: boolean;
}): boolean {
  return options.showAssetsPanel && (options.assetCount > 0 || options.hasImporter);
}

export const timelineWorkbenchDefaultNarrowBreakpointPx = 768;

/** Pixel constraints of the side panes. They keep their size while the window resizes. */
export const timelineWorkbenchPaneConstraints: Record<
  TimelineWorkbenchPaneId,
  { label: string; defaultSize: number; minSize: number; maxSize: number }
> = {
  assets: { label: "Assets", defaultSize: 272, minSize: 208, maxSize: 480 },
  inspector: { label: "Inspector", defaultSize: 320, minSize: 240, maxSize: 560 },
};

// Sticky rulers and overlays inside the preview and timeline keep their z-index local, so
// drawers opened over them always stay on top.
const isolatedStackingStyle: CSSProperties = { isolation: "isolate" };

type ResolvedPaneLayout = Required<TimelineWorkbenchPaneLayout>;

function resolvePaneLayout(
  id: TimelineWorkbenchPaneId,
  controlled: TimelineWorkbenchPanelLayout | undefined,
  internal: TimelineWorkbenchPanelLayout,
): ResolvedPaneLayout {
  return {
    size:
      controlled?.[id]?.size ??
      internal[id]?.size ??
      timelineWorkbenchPaneConstraints[id].defaultSize,
    collapsed: controlled?.[id]?.collapsed ?? internal[id]?.collapsed ?? false,
  };
}

/** Tracks whether the workbench itself (not the viewport) is narrower than the breakpoint. */
function useNarrowContainer(breakpoint: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (width: number) => setNarrow(width > 0 && width < breakpoint);
    measure(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [breakpoint]);

  return [ref, narrow] as const;
}

export function TimelineWorkbenchShellLayout(props: {
  className?: string;
  style?: CSSProperties;
  toolbar: ReactNode;
  assetsPanel: ReactNode | null;
  inspectorPanel: ReactNode | null;
  previewPanel: ReactNode | null;
  canvasPanel: ReactNode;
  panelLayout?: TimelineWorkbenchPanelLayout;
  defaultPanelLayout?: TimelineWorkbenchPanelLayout;
  onPanelLayoutChange?: (
    layout: TimelineWorkbenchPanelLayout,
    context: TimelineWorkbenchPanelLayoutChangeContext,
  ) => void;
  panelPresentation?: TimelineWorkbenchPanelPresentation;
  panelNarrowBreakpoint?: number;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}): JSX.Element {
  const narrowBreakpoint =
    props.panelNarrowBreakpoint ?? timelineWorkbenchDefaultNarrowBreakpointPx;
  const [rootRef, narrow] = useNarrowContainer(narrowBreakpoint);
  const [internalLayout, setInternalLayout] = useState<TimelineWorkbenchPanelLayout>(
    () => props.defaultPanelLayout ?? {},
  );
  const [overlay, setOverlay] = useState(props.panelPresentation === "overlay");
  const paneIdPrefix = `timeline-workbench-${useId().replaceAll(":", "")}`;
  const paneIds: Record<TimelineWorkbenchPaneId, string> = {
    assets: `${paneIdPrefix}-assets`,
    inspector: `${paneIdPrefix}-inspector`,
  };
  const panes: Array<[TimelineWorkbenchPaneId, ReactNode, "start" | "end"]> = [];
  if (props.assetsPanel) panes.push(["assets", props.assetsPanel, "start"]);
  if (props.inspectorPanel) panes.push(["inspector", props.inspectorPanel, "end"]);

  const updatePane = (
    id: TimelineWorkbenchPaneId,
    patch: TimelineWorkbenchPaneLayout,
    reason: TimelineWorkbenchPanelLayoutChangeContext["reason"],
  ) => {
    const next: TimelineWorkbenchPanelLayout = {};
    for (const [paneId] of panes) {
      next[paneId] = resolvePaneLayout(paneId, props.panelLayout, internalLayout);
    }
    next[id] = { ...resolvePaneLayout(id, props.panelLayout, internalLayout), ...patch };
    setInternalLayout(next);
    props.onPanelLayoutChange?.(next, { paneId: id, reason });
  };

  const renderPane = ([id, content, side]: (typeof panes)[number]) => {
    const constraints = timelineWorkbenchPaneConstraints[id];
    const layout = resolvePaneLayout(id, props.panelLayout, internalLayout);
    return (
      <EditorPane
        key={id}
        id={paneIds[id]}
        side={side}
        label={constraints.label}
        data-timeline-workbench-pane={id}
        size={layout.size}
        defaultSize={constraints.defaultSize}
        minSize={constraints.minSize}
        maxSize={constraints.maxSize}
        collapsed={layout.collapsed}
        // Docked collapsed panes keep a rail; drawers are opened from the toolbar instead so a
        // phone-width timeline keeps its full width.
        rail={!overlay}
        onSizeChange={(size) => updatePane(id, { size }, "resize")}
        onResizeEnd={(size) => updatePane(id, { size }, "resize-end")}
        onCollapsedChange={(collapsed) => updatePane(id, { collapsed }, "collapse")}
      >
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">{content}</div>
      </EditorPane>
    );
  };

  const renderMainArea = (centerPanel: ReactNode) =>
    panes.length > 0 ? (
      <EditorPaneLayout
        orientation="horizontal"
        presentation={props.panelPresentation ?? "auto"}
        narrowBreakpoint={narrowBreakpoint}
        onPresentationChange={(presentation) => setOverlay(presentation === "overlay")}
        // Drawers position against the whole preview/timeline area rather than only this row,
        // so they stay usable when the preview row is short.
        style={overlay ? { position: "static" } : undefined}
      >
        {panes.filter(([, , side]) => side === "start").map(renderPane)}
        <EditorPaneMain className="overflow-hidden">{centerPanel}</EditorPaneMain>
        {panes.filter(([, , side]) => side === "end").map(renderPane)}
      </EditorPaneLayout>
    ) : (
      centerPanel
    );

  const previewMainPanel = props.previewPanel ? (
    <WorkbenchCanvas className="h-full min-h-0 p-0" style={isolatedStackingStyle}>
      {props.previewPanel}
    </WorkbenchCanvas>
  ) : null;
  const canvasPanel = (
    <WorkbenchCanvas
      className="grid h-full min-h-0 p-0"
      style={{ ...isolatedStackingStyle, gridTemplateRows: "auto minmax(0, 1fr)" }}
    >
      {props.canvasPanel}
    </WorkbenchCanvas>
  );

  return (
    <div
      ref={rootRef}
      data-slot="timeline-workbench"
      data-narrow={narrow ? "true" : undefined}
      className={cn(
        "grid min-h-0 w-full overflow-hidden rounded-md border border-border/60 bg-background text-foreground",
        props.className,
      )}
      style={{
        // A grid row (rather than a flex column) gives the nested layout a definite height even
        // when the host only sets a min-height.
        gridTemplateRows: "minmax(0, 1fr)",
        height: "100%",
        minHeight: "34rem",
        ...props.style,
      }}
      onKeyDown={props.onKeyDown}
    >
      {/* The outer layout lets toolbar toggles reach the nested side panes. */}
      <EditorPaneLayout orientation="vertical">
        <div
          data-slot="timeline-workbench-toolbar"
          className="shrink-0 border-b border-border/60 bg-card/75"
        >
          <EditorToolbar
            aria-label="Timeline commands"
            density="compact"
            overflow={narrow ? "scroll" : "wrap"}
            className="rounded-none border-0 bg-transparent px-2 py-1 shadow-none"
          >
            {panes.length > 0 ? (
              <EditorToolbarGroup aria-label="Panels">
                {panes.map(([id]) => (
                  <EditorPaneToggle
                    key={id}
                    paneId={paneIds[id]}
                    size="icon-sm"
                    aria-label={`Toggle ${timelineWorkbenchPaneConstraints[id].label}`}
                    data-timeline-workbench-pane-toggle={id}
                  />
                ))}
              </EditorToolbarGroup>
            ) : null}
            {props.toolbar}
          </EditorToolbar>
        </div>
        <EditorPaneMain className="overflow-hidden">
          <ResizablePanelGroup orientation="vertical" className="h-full min-h-0">
            <ResizablePanel
              defaultSize={previewMainPanel ? 28 : 100}
              minSize={previewMainPanel ? 18 : 42}
            >
              {previewMainPanel ? renderMainArea(previewMainPanel) : renderMainArea(canvasPanel)}
            </ResizablePanel>
            {previewMainPanel ? (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={72} minSize={42}>
                  {canvasPanel}
                </ResizablePanel>
              </>
            ) : null}
          </ResizablePanelGroup>
        </EditorPaneMain>
      </EditorPaneLayout>
    </div>
  );
}
