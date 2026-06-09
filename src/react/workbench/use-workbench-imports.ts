import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  TimelineWorkbenchAsset,
  TimelineWorkbenchImportContext,
  TimelineWorkbenchImportResult,
  TimelineWorkbenchImportSource,
  TimelineWorkbenchImportState,
} from "./types";

export type TimelineWorkbenchImportController<TAssetData> = {
  importState: TimelineWorkbenchImportState;
  importedAssets: Array<TimelineWorkbenchAsset<TAssetData>>;
  resolvedAssets: Array<TimelineWorkbenchAsset<TAssetData>>;
  importAssets: (sources: TimelineWorkbenchImportSource[]) => Promise<void>;
  cancelImport: () => void;
  retryImport: () => Promise<void>;
  clearImportState: () => void;
};

export type UseTimelineWorkbenchImportsOptions<TAssetData> = {
  assets: Array<TimelineWorkbenchAsset<TAssetData>>;
  readOnly: boolean;
  onImportAssets?: (
    sources: TimelineWorkbenchImportSource[],
    context?: TimelineWorkbenchImportContext,
  ) =>
    | Promise<Array<TimelineWorkbenchImportResult<TAssetData>>>
    | Array<TimelineWorkbenchImportResult<TAssetData>>;
  onImportCancel?: () => void;
};

export function useTimelineWorkbenchImports<TAssetData>({
  assets,
  readOnly,
  onImportAssets,
  onImportCancel,
}: UseTimelineWorkbenchImportsOptions<TAssetData>): TimelineWorkbenchImportController<TAssetData> {
  const [importedAssets, setImportedAssets] = useState<Array<TimelineWorkbenchAsset<TAssetData>>>(
    [],
  );
  const [importState, setImportState] = useState<TimelineWorkbenchImportState>({
    status: "idle",
  });
  const importedAssetCleanupsRef = useRef<Array<() => void>>([]);
  const importAbortControllerRef = useRef<AbortController | null>(null);
  const retryImportSourcesRef = useRef<TimelineWorkbenchImportSource[]>([]);

  const resolvedAssets = useMemo(() => assets.concat(importedAssets), [assets, importedAssets]);

  useEffect(
    () => () => {
      importAbortControllerRef.current?.abort();
      importAbortControllerRef.current = null;
      const cleanups = importedAssetCleanupsRef.current;
      importedAssetCleanupsRef.current = [];

      for (const cleanup of cleanups) {
        cleanup();
      }
    },
    [],
  );

  const clearImportState = useCallback(() => {
    setImportState({ status: "idle" });
  }, []);

  const importAssets = useCallback(
    async (sources: TimelineWorkbenchImportSource[]) => {
      if (readOnly || sources.length === 0) {
        return;
      }

      retryImportSourcesRef.current = sources;
      const sourceLabel = getTimelineWorkbenchImportSourceLabel(sources);
      const sourceStates = sources.map((source, index) => ({
        id: getTimelineWorkbenchImportSourceStateId(source, index),
        label: source.label ?? source.file?.name ?? source.url ?? `Source ${index + 1}`,
        status: "pending" as const,
        metadata: isTimelineWorkbenchImportSourceMetadata(source.metadata)
          ? source.metadata
          : undefined,
      }));

      if (!onImportAssets) {
        setImportState({
          status: "failed",
          sourceLabel,
          error: "Import is not configured for this workbench.",
          sources: sourceStates.map((source) => ({
            ...source,
            status: "failed",
            error: "Import is not configured for this workbench.",
          })),
        });
        return;
      }

      importAbortControllerRef.current?.abort();
      const abortController = new AbortController();
      importAbortControllerRef.current = abortController;

      setImportState({ status: "importing", sourceLabel, sources: sourceStates, canCancel: true });

      try {
        const results = await onImportAssets(sources, {
          signal: abortController.signal,
          onProgress(sourceId, progress) {
            setImportState((currentState) =>
              updateTimelineWorkbenchImportSourceState(currentState, sourceId, {
                progress,
                status: "importing",
              }),
            );
          },
          onWarning(sourceId, warning) {
            setImportState((currentState) =>
              updateTimelineWorkbenchImportSourceWarning(currentState, sourceId, warning),
            );
          },
        });

        if (abortController.signal.aborted) {
          setImportState({
            status: "cancelled",
            sourceLabel,
            sources: sourceStates.map((source) => ({ ...source, status: "cancelled" })),
            canCancel: false,
          });
          return;
        }

        const resultAssets = results
          .map((result) => result.asset)
          .filter((asset): asset is TimelineWorkbenchAsset<TAssetData> => Boolean(asset));
        const resultCleanups = results
          .map((result) => result.cleanup ?? result.revoke)
          .filter((cleanup): cleanup is () => void => Boolean(cleanup));
        const warnings = results.flatMap((result) => result.warnings ?? []);
        const errors = results.flatMap((result) => result.errors ?? []);

        if (resultAssets.length > 0) {
          importedAssetCleanupsRef.current.push(...resultCleanups);
          setImportedAssets((currentAssets) =>
            currentAssets.concat(
              uniquifyTimelineWorkbenchImportedAssets(assets.concat(currentAssets), resultAssets),
            ),
          );
        }

        setImportState({
          status: resultAssets.length > 0 ? "ready" : "failed",
          sourceLabel,
          warnings: warnings.length > 0 ? warnings : undefined,
          error:
            resultAssets.length === 0
              ? (errors[0] ?? warnings[0] ?? "Import did not return any assets.")
              : undefined,
          sources: sourceStates.map((source, index) => {
            const result = results[index];
            const sourceWarnings = result?.warnings;
            const sourceError = result?.errors?.[0];

            return {
              ...source,
              status: result?.asset ? ("ready" as const) : ("failed" as const),
              warnings: sourceWarnings?.length ? sourceWarnings : undefined,
              error: sourceError,
              metadata: result?.metadata ?? source.metadata,
            };
          }),
          canCancel: false,
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          setImportState({
            status: "cancelled",
            sourceLabel,
            sources: sourceStates.map((source) => ({ ...source, status: "cancelled" })),
            canCancel: false,
          });
          return;
        }

        const errorMessage = getTimelineWorkbenchImportErrorMessage(error);

        setImportState({
          status: "failed",
          sourceLabel,
          error: errorMessage,
          sources: sourceStates.map((source) => ({
            id: source.id,
            label: source.label,
            status: "failed",
            error: errorMessage,
            metadata: source.metadata,
          })),
          canCancel: false,
        });
      } finally {
        if (importAbortControllerRef.current === abortController) {
          importAbortControllerRef.current = null;
        }
      }
    },
    [assets, onImportAssets, readOnly],
  );

  const cancelImport = useCallback(() => {
    importAbortControllerRef.current?.abort();
    onImportCancel?.();
    setImportState((currentState) =>
      currentState.status === "importing"
        ? {
            ...currentState,
            status: "cancelled",
            canCancel: false,
            sources: currentState.sources?.map((source) =>
              source.status === "ready" || source.status === "failed"
                ? source
                : { ...source, status: "cancelled" },
            ),
          }
        : currentState,
    );
  }, [onImportCancel]);

  const retryImport = useCallback(
    () => importAssets(retryImportSourcesRef.current),
    [importAssets],
  );

  return {
    importState,
    importedAssets,
    resolvedAssets,
    importAssets,
    cancelImport,
    retryImport,
    clearImportState,
  };
}

function getTimelineWorkbenchImportSourceLabel(sources: TimelineWorkbenchImportSource[]) {
  if (sources.length !== 1) {
    return `${sources.length} sources`;
  }

  const source = sources[0];

  return source?.label ?? source?.file?.name ?? source?.url ?? "reference";
}

function getTimelineWorkbenchImportErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Import failed.";
}

function uniquifyTimelineWorkbenchImportedAssets<TAssetData>(
  existingAssets: Array<TimelineWorkbenchAsset<TAssetData>>,
  importedAssets: Array<TimelineWorkbenchAsset<TAssetData>>,
) {
  const usedIds = new Set(existingAssets.map((asset) => asset.id));

  return importedAssets.map((asset) => {
    if (!usedIds.has(asset.id)) {
      usedIds.add(asset.id);
      return asset;
    }

    let index = 2;
    let id = `${asset.id}-import-${index}`;

    while (usedIds.has(id)) {
      index += 1;
      id = `${asset.id}-import-${index}`;
    }

    usedIds.add(id);
    return { ...asset, id };
  });
}

function getTimelineWorkbenchImportSourceStateId(
  source: TimelineWorkbenchImportSource,
  index: number,
) {
  return source.label ?? source.file?.name ?? source.url ?? `source-${index + 1}`;
}

function updateTimelineWorkbenchImportSourceState(
  state: TimelineWorkbenchImportState,
  sourceId: string,
  patch: Partial<NonNullable<TimelineWorkbenchImportState["sources"]>[number]>,
): TimelineWorkbenchImportState {
  const sources = state.sources?.map((source) =>
    source.id === sourceId ? { ...source, ...patch } : source,
  );

  return {
    ...state,
    progress: patch.progress ?? state.progress,
    sources,
  };
}

function updateTimelineWorkbenchImportSourceWarning(
  state: TimelineWorkbenchImportState,
  sourceId: string,
  warning: string,
): TimelineWorkbenchImportState {
  const sources = state.sources?.map((source) =>
    source.id === sourceId
      ? { ...source, warnings: [...(source.warnings ?? []), warning] }
      : source,
  );

  return {
    ...state,
    warnings: [...(state.warnings ?? []), warning],
    sources,
  };
}

function isTimelineWorkbenchImportSourceMetadata(
  metadata: unknown,
): metadata is Record<string, unknown> {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata));
}
