"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { Badge, Button, Input, cn } from "@moritzbrantner/ui";

import {
  formatTimelineEditorTimeMs,
  type TimelineEditorItem,
  type TimelineEditorTrack,
} from "../../core";
import {
  getTimelineMediaTypeForAsset,
  isTimelineMediaType,
  type TimelineMediaType,
} from "../../media-types";
import { createTimelineWorkbenchItemId } from "./ids";
import type {
  TimelineWorkbenchAsset,
  TimelineWorkbenchImportSource,
  TimelineWorkbenchImportState,
} from "./types";

export const timelineWorkbenchAssetDragDataType = "application/x-timeline-workbench-asset-id";

export function canPlaceTimelineWorkbenchAssetOnTrack<TTrackData, TItemData, TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  track: TimelineEditorTrack<TTrackData, TItemData>,
) {
  if (track.locked) {
    return false;
  }

  if (track.kind) {
    return asset.kind === track.kind;
  }

  return !track.acceptsItemKinds || !asset.kind || track.acceptsItemKinds.includes(asset.kind);
}

export function getTimelineWorkbenchAssetBrowserItems<TAssetData>(
  assets: Array<TimelineWorkbenchAsset<TAssetData>>,
) {
  return assets.map((asset) => {
    const mediaType = getTimelineMediaTypeForAsset(asset);

    return {
      id: asset.id,
      name: asset.label,
      type: "file",
      description: asset.description ?? mediaType ?? asset.kind,
      metadata: {
        Duration: formatTimelineEditorTimeMs(asset.durationMs),
        Kind: asset.kind ?? "item",
        ...(mediaType ? { "Media Type": mediaType } : {}),
      },
    };
  });
}

export function createTimelineWorkbenchItemFromAsset<TItemData, TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  placement: { trackId: string; timeMs: number },
  options: {
    createItemId?: (asset: TimelineWorkbenchAsset<TAssetData>) => string;
  } = {},
): TimelineEditorItem<TItemData> {
  const mediaType = isTimelineMediaType(asset.mediaType) ? asset.mediaType : undefined;

  return {
    id: createTimelineWorkbenchItemId(asset, options.createItemId),
    trackId: placement.trackId,
    label: asset.label,
    startMs: placement.timeMs,
    durationMs: asset.durationMs,
    kind: asset.kind,
    color: asset.color,
    data: getTimelineWorkbenchAssetData<TItemData, TAssetData>(asset, mediaType),
  };
}

function getTimelineWorkbenchAssetData<TItemData, TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  mediaType?: TimelineMediaType,
): TItemData | undefined {
  if (asset.data !== undefined) {
    return asset.data as unknown as TItemData;
  }

  return mediaType ? ({ mediaType } as TItemData) : undefined;
}

type TimelineWorkbenchAssetsPanelProps<TAssetData> = {
  assets: Array<TimelineWorkbenchAsset<TAssetData>>;
  className?: string;
  tracks: Array<TimelineEditorTrack<Record<string, unknown>, unknown>>;
  selectedTrack?: TimelineEditorTrack<Record<string, unknown>, unknown>;
  readOnly: boolean;
  acceptedImportTypes?: string[];
  allowUrlImport?: boolean;
  importState?: TimelineWorkbenchImportState;
  renderAsset?: (asset: TimelineWorkbenchAsset<TAssetData>) => ReactNode;
  onMinimize?: () => void;
  onImportAssets?: (sources: TimelineWorkbenchImportSource[]) => void | Promise<void>;
  onImportStateClear?: () => void;
  onInsertAsset: (asset: TimelineWorkbenchAsset<TAssetData>) => void;
  onAssetDragEnd?: () => void;
  onAssetDragStart?: (asset: TimelineWorkbenchAsset<TAssetData>) => void;
};

export function TimelineWorkbenchAssetsPanel<TAssetData>({
  assets,
  className,
  tracks,
  selectedTrack,
  readOnly,
  acceptedImportTypes,
  allowUrlImport = false,
  importState = { status: "idle" },
  renderAsset,
  onMinimize,
  onImportAssets,
  onImportStateClear,
  onInsertAsset,
  onAssetDragEnd,
  onAssetDragStart,
}: TimelineWorkbenchAssetsPanelProps<TAssetData>) {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("");
  const [compatibleOnly, setCompatibleOnly] = useState(false);
  const [urlImportValue, setUrlImportValue] = useState("");
  const [urlImportError, setUrlImportError] = useState("");
  const panelContentRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const suppressAssetActivationUntilRef = useRef(0);
  const filterOptions = useMemo(
    () => ({
      kinds: [...new Set(assets.map((asset) => asset.kind).filter(Boolean))].sort(),
      mediaTypes: [
        ...new Set(assets.map((asset) => getTimelineMediaTypeForAsset(asset)).filter(Boolean)),
      ].sort(),
    }),
    [assets],
  );
  const filteredAssets = assets.filter((asset) => {
    const mediaType = getTimelineMediaTypeForAsset(asset);
    const status = getTimelineWorkbenchAssetCompatibility(asset, tracks, selectedTrack);
    const queryText = [asset.label, asset.description, asset.kind, mediaType]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!query.trim() || queryText.includes(query.trim().toLowerCase())) &&
      (!kindFilter || asset.kind === kindFilter) &&
      (!mediaTypeFilter || mediaType === mediaTypeFilter) &&
      (!compatibleOnly ||
        (selectedTrack
          ? canPlaceTimelineWorkbenchAssetOnTrack(asset, selectedTrack)
          : status.compatible))
    );
  });
  const assetBrowserItems = getTimelineWorkbenchAssetBrowserItems(filteredAssets);
  const assetBrowserItemLookup = new Map(assetBrowserItems.map((item) => [item.id, item]));
  const clearFilters = () => {
    setQuery("");
    setKindFilter("");
    setMediaTypeFilter("");
    setCompatibleOnly(false);
  };
  const handleFileImport = (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);

    if (selectedFiles.length === 0 || !onImportAssets) {
      return;
    }

    void onImportAssets(
      selectedFiles.map((file) => ({
        type: "file",
        file,
        label: file.name,
        metadata: {
          lastModified: file.lastModified,
          mimeType: file.type,
          size: file.size,
        },
      })),
    );
  };
  const handleUrlImport = async () => {
    const trimmedValue = urlImportValue.trim();

    if (!trimmedValue || !onImportAssets) {
      return;
    }

    let url: URL;

    try {
      url = new URL(trimmedValue);
    } catch {
      setUrlImportError("Enter a valid URL.");
      return;
    }

    const pathLabel = decodeURIComponent(url.pathname).split("/").slice().reverse().find(Boolean);
    const label = pathLabel || url.hostname || url.href;

    setUrlImportError("");
    await onImportAssets([
      {
        type: "url",
        url: url.href,
        label,
        metadata: {
          hostname: url.hostname,
          protocol: url.protocol,
        },
      },
    ]);
    setUrlImportValue("");
  };
  useEffect(() => {
    const ownerDocument = panelContentRef.current?.ownerDocument ?? document;
    const suppressClickThrough = (event: Event) => {
      const target = event.target;

      if (
        !(target instanceof Element) ||
        panelContentRef.current?.contains(target) ||
        !isTimelineWorkbenchAssetOverlayTarget(target)
      ) {
        return;
      }

      suppressAssetActivationUntilRef.current = Date.now() + 700;
    };

    ownerDocument.addEventListener("pointerdown", suppressClickThrough, true);
    ownerDocument.addEventListener("mousedown", suppressClickThrough, true);

    return () => {
      ownerDocument.removeEventListener("pointerdown", suppressClickThrough, true);
      ownerDocument.removeEventListener("mousedown", suppressClickThrough, true);
    };
  }, []);
  const isAssetActivationSuppressed = () => Date.now() < suppressAssetActivationUntilRef.current;

  return (
    <div data-slot="timeline-workbench-assets" className={cn("min-w-64", className)}>
      <div ref={panelContentRef} className="grid gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Assets</div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{assets.length}</Badge>
            {onMinimize ? (
              <Button type="button" size="sm" variant="ghost" onClick={onMinimize}>
                Minimize
              </Button>
            ) : null}
          </div>
        </div>
        {onImportAssets ? (
          <div className="grid gap-2">
            <input
              ref={fileInputRef}
              data-slot="timeline-workbench-file-import"
              hidden
              type="file"
              multiple
              disabled={readOnly || importState.status === "importing"}
              accept={acceptedImportTypes?.join(",")}
              onChange={(event) => {
                handleFileImport(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={readOnly || importState.status === "importing"}
                onClick={() => fileInputRef.current?.click()}
              >
                {importState.status === "importing" ? "Importing..." : "Import files"}
              </Button>
              {importState.status === "ready" && importState.sourceLabel ? (
                <span className="truncate text-xs text-muted-foreground">
                  Imported {importState.sourceLabel}
                </span>
              ) : null}
            </div>
            {allowUrlImport && !readOnly ? (
              <form
                className="grid gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleUrlImport();
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Input
                    data-slot="timeline-workbench-url-import"
                    aria-label="Import asset URL"
                    placeholder="https://example.com/media.mp4"
                    value={urlImportValue}
                    disabled={importState.status === "importing"}
                    onChange={(event) => {
                      setUrlImportValue(event.currentTarget.value);
                      if (urlImportError) {
                        setUrlImportError("");
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={!urlImportValue.trim() || importState.status === "importing"}
                  >
                    Import URL
                  </Button>
                </div>
                {urlImportError ? (
                  <div className="text-xs text-destructive">{urlImportError}</div>
                ) : null}
              </form>
            ) : null}
            {importState.status === "failed" ? (
              <div className="flex items-center justify-between gap-2 rounded border border-destructive/40 bg-background px-2 py-1 text-xs text-destructive">
                <span className="min-w-0 truncate">{importState.error ?? "Import failed."}</span>
                {onImportStateClear ? (
                  <Button type="button" size="sm" variant="ghost" onClick={onImportStateClear}>
                    Clear
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {assets.length > 0 ? (
          <div className="grid gap-2">
            <Input
              value={query}
              aria-label="Search assets"
              placeholder="Search assets"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                data-slot="timeline-workbench-asset-kind-filter"
                aria-label="Filter assets by kind"
                className="h-8 rounded border bg-background px-2 text-xs"
                value={kindFilter}
                onChange={(event) => setKindFilter(event.currentTarget.value)}
              >
                <option value="">All kinds</option>
                {filterOptions.kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <select
                data-slot="timeline-workbench-asset-media-filter"
                aria-label="Filter assets by media type"
                className="h-8 rounded border bg-background px-2 text-xs"
                value={mediaTypeFilter}
                onChange={(event) => setMediaTypeFilter(event.currentTarget.value)}
              >
                <option value="">All media</option>
                {filterOptions.mediaTypes.map((mediaType) => (
                  <option key={mediaType} value={mediaType}>
                    {mediaType}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              Compatible with selected track
              <input
                type="checkbox"
                checked={compatibleOnly}
                onChange={(event) => setCompatibleOnly(event.currentTarget.checked)}
              />
            </label>
            {filteredAssets.length === 0 ? (
              <div className="grid gap-2 rounded border border-border bg-background p-3 text-sm">
                <div className="text-muted-foreground">
                  0 of {assets.length} assets match filters
                </div>
                <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : null}
            {filteredAssets.map((asset) => {
              const assetBrowserItem = assetBrowserItemLookup.get(asset.id);
              const compatibility = getTimelineWorkbenchAssetCompatibility(
                asset,
                tracks,
                selectedTrack,
              );
              const startAssetDrag = (event: DragEvent<HTMLElement>) => {
                if (isTimelineWorkbenchAssetInteractiveTarget(event.target, event.currentTarget)) {
                  event.preventDefault();
                  return;
                }

                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(timelineWorkbenchAssetDragDataType, asset.id);
                event.dataTransfer.setData("text/plain", asset.label);
                onAssetDragStart?.(asset);
              };
              const prepareAssetDrag = (event: MouseEvent<HTMLElement>) => {
                if (
                  event.button === 0 &&
                  !readOnly &&
                  compatibility.compatible &&
                  !isTimelineWorkbenchAssetInteractiveTarget(event.target, event.currentTarget)
                ) {
                  onAssetDragStart?.(asset);
                }
              };
              const insertAsset = () => {
                if (!readOnly && compatibility.compatible && !isAssetActivationSuppressed()) {
                  onInsertAsset(asset);
                  onAssetDragEnd?.();
                }
              };
              const handleAssetClick = (event: MouseEvent<HTMLElement>) => {
                if (isTimelineWorkbenchAssetInteractiveTarget(event.target, event.currentTarget)) {
                  return;
                }

                insertAsset();
              };
              const handleAssetKeyDown = (event: KeyboardEvent<HTMLElement>) => {
                if (
                  event.defaultPrevented ||
                  isTimelineWorkbenchAssetInteractiveTarget(event.target, event.currentTarget) ||
                  (event.key !== "Enter" && event.key !== " ")
                ) {
                  return;
                }

                event.preventDefault();
                insertAsset();
              };

              return (
                <div
                  key={asset.id}
                  role="button"
                  tabIndex={readOnly || !compatibility.compatible ? -1 : 0}
                  aria-disabled={readOnly || !compatibility.compatible}
                  aria-label={asset.label}
                  className={cn(
                    "inline-flex h-auto w-full items-center justify-start rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors",
                    readOnly || !compatibility.compatible
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                  draggable={!readOnly && compatibility.compatible}
                  onClick={handleAssetClick}
                  onKeyDown={handleAssetKeyDown}
                  onMouseDown={prepareAssetDrag}
                  onDragStart={startAssetDrag}
                  onDragStartCapture={startAssetDrag}
                  onDragEnd={onAssetDragEnd}
                >
                  <div className="grid gap-1">
                    {renderAsset ? (
                      renderAsset(asset)
                    ) : (
                      <>
                        <span className="font-medium">{assetBrowserItem?.name ?? asset.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {assetBrowserItem?.description ?? asset.kind ?? "item"} ·{" "}
                          {formatTimelineEditorTimeMs(asset.durationMs)}
                        </span>
                      </>
                    )}
                    <span className="text-[10px] text-muted-foreground">{compatibility.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            0 assets · {tracks.length} timeline {tracks.length === 1 ? "track" : "tracks"}
          </div>
        )}
      </div>
    </div>
  );
}

function getTimelineWorkbenchAssetCompatibility<TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  tracks: Array<TimelineEditorTrack<Record<string, unknown>, unknown>>,
  selectedTrack?: TimelineEditorTrack<Record<string, unknown>, unknown>,
) {
  const selectedTrackCompatible = selectedTrack
    ? canPlaceTimelineWorkbenchAssetOnTrack(asset, selectedTrack)
    : false;
  const compatibleTrack = tracks.find((track) =>
    canPlaceTimelineWorkbenchAssetOnTrack(asset, track),
  );

  if (selectedTrackCompatible) {
    return { compatible: true, label: "Fits selected track" };
  }

  if (compatibleTrack) {
    return { compatible: true, label: "Compatible with another track" };
  }

  return { compatible: false, label: "No compatible track" };
}

function isTimelineWorkbenchAssetInteractiveTarget(
  target: EventTarget | null,
  currentTarget: EventTarget,
) {
  if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
    return false;
  }

  const interactiveTarget = target.closest(
    "a,button,input,select,textarea,[role='button'],[role='menuitem'],[role='option'],[data-timeline-workbench-asset-action]",
  );

  return (
    Boolean(interactiveTarget) &&
    interactiveTarget !== currentTarget &&
    currentTarget.contains(interactiveTarget)
  );
}

function isTimelineWorkbenchAssetOverlayTarget(target: Element) {
  return Boolean(
    target.closest(
      [
        "[role='menu']",
        "[role='menuitem']",
        "[role='option']",
        "[role='listbox']",
        "[role='dialog']",
        "[data-radix-popper-content-wrapper]",
        "[data-slot='dropdown-menu-content']",
        "[data-slot='context-menu-content']",
        "[data-slot='popover-content']",
      ].join(","),
    ),
  );
}
