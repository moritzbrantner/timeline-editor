import type { CSSProperties, JSX, KeyboardEventHandler, ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  WorkbenchCanvas,
  WorkbenchPanel,
  WorkbenchToolbar,
  cn,
} from "@moritzbrantner/ui";

export function shouldShowTimelineWorkbenchAssetsPanel(options: {
  showAssetsPanel: boolean;
  assetCount: number;
  hasImporter: boolean;
}): boolean {
  return options.showAssetsPanel && (options.assetCount > 0 || options.hasImporter);
}

export function TimelineWorkbenchShellLayout(props: {
  className?: string;
  style?: CSSProperties;
  toolbar: ReactNode;
  assetsPanel: ReactNode | null;
  inspectorPanel: ReactNode | null;
  previewPanel: ReactNode | null;
  canvasPanel: ReactNode;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}): JSX.Element {
  const sidePanelsVisible = Boolean(props.assetsPanel || props.inspectorPanel);
  const mainPanelDefaultSize = 100 - (props.assetsPanel ? 20 : 0) - (props.inspectorPanel ? 24 : 0);

  const renderMainArea = (centerPanel: ReactNode) =>
    sidePanelsVisible ? (
      <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
        {props.assetsPanel ? (
          <>
            <ResizablePanel defaultSize={20} minSize={16} collapsible>
              <WorkbenchPanel side="left" className="h-full min-h-0 border-r-0">
                {props.assetsPanel}
              </WorkbenchPanel>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        ) : null}
        <ResizablePanel defaultSize={mainPanelDefaultSize} minSize={36}>
          {centerPanel}
        </ResizablePanel>
        {props.inspectorPanel ? (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={24} minSize={18} collapsible>
              <WorkbenchPanel side="right" className="h-full min-h-0 border-l-0">
                {props.inspectorPanel}
              </WorkbenchPanel>
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    ) : (
      centerPanel
    );

  const previewMainPanel = props.previewPanel ? (
    <WorkbenchCanvas className="h-full min-h-0 p-0">{props.previewPanel}</WorkbenchCanvas>
  ) : null;
  const canvasPanel = (
    <WorkbenchCanvas
      className="grid h-full min-h-0 p-0"
      style={{ gridTemplateRows: "auto minmax(0, 1fr)" }}
    >
      {props.canvasPanel}
    </WorkbenchCanvas>
  );

  return (
    <div
      data-slot="timeline-workbench"
      className={cn(
        "grid min-h-0 w-full overflow-hidden rounded-md border border-border/60 bg-background text-foreground",
        props.className,
      )}
      style={{
        gridTemplateRows: "auto minmax(0, 1fr)",
        height: "100%",
        minHeight: "34rem",
        ...props.style,
      }}
      onKeyDown={props.onKeyDown}
    >
      <WorkbenchToolbar>{props.toolbar}</WorkbenchToolbar>
      <ResizablePanelGroup orientation="vertical" className="min-h-0">
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
    </div>
  );
}
