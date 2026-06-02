import { useEffect, useMemo, useState } from "react";

import {
  TimelineWorkbench,
  createTimelineAudioExtension,
  createTimelineEditorHistory,
  createTimelineImageExtension,
  createTimelineMediaImportResolver,
  createTimelineMediaSourceLibrary,
  createTimelineTextExtension,
  createTimelineVideoExtension,
  type TimelineEditorClipboard,
  type TimelineEditorDocument,
  type TimelineEditorExtension,
  type TimelineEditorHistory,
  type TimelineEditorSelection,
  type TimelineEditorViewport,
  type TimelineMediaItemData,
  type TimelineWorkbenchImportContext,
  type TimelineWorkbenchImportResult,
  type TimelineWorkbenchImportSource,
} from "@moritzbrantner/timeline-editor";
import {
  createTimelineAudioBrowserBackend,
  createTimelineAudioFileAsset,
} from "@timeline-editor/audio";
import {
  createTimelineImageBrowserBackend,
  createTimelineImageFileAsset,
} from "@timeline-editor/image";
import {
  createTimelineVideoBrowserBackend,
  createTimelineVideoFileAsset,
} from "@timeline-editor/video";

const initialDocument: TimelineEditorDocument<Record<string, unknown>, TimelineMediaItemData> = {
  durationMs: 10_000,
  currentTimeMs: 1_000,
  tracks: [
    {
      id: "media",
      label: "Media",
      acceptsItemKinds: ["audio", "video", "image", "text"],
      items: [],
    },
  ],
};

export function ControlledWorkbenchAdoptionRecipe() {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const [viewport, setViewport] = useState<TimelineEditorViewport>({ pixelsPerSecond: 90 });
  const [clipboard, setClipboard] = useState<TimelineEditorClipboard<TimelineMediaItemData>>();
  const [history, setHistory] = useState<
    TimelineEditorHistory<Record<string, unknown>, TimelineMediaItemData>
  >(
    () =>
      createTimelineEditorHistory() as TimelineEditorHistory<
        Record<string, unknown>,
        TimelineMediaItemData
      >,
  );
  const sourceLibrary = useMemo(() => createTimelineMediaSourceLibrary(), []);
  const importAssets = useMemo(
    () => createTimelineMediaImportResolver({ sourceLibrary, defaultImageDurationMs: 2_000 }),
    [sourceLibrary],
  );

  useEffect(() => () => sourceLibrary.dispose(), [sourceLibrary]);

  return (
    <TimelineWorkbench
      document={document}
      selection={selection}
      viewport={viewport}
      clipboard={clipboard}
      history={history}
      acceptedImportTypes={["audio/*", "video/*", "image/*"]}
      allowUrlImport
      extensions={createHostMediaExtensions()}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
      onViewportChange={setViewport}
      onClipboardChange={setClipboard}
      onHistoryChange={setHistory}
      onImportAssets={importAssets}
    />
  );
}

export function createHostMediaExtensions(): Array<TimelineEditorExtension<TimelineMediaItemData>> {
  return [
    createTimelineAudioExtension() as unknown as TimelineEditorExtension<TimelineMediaItemData>,
    createTimelineVideoExtension() as unknown as TimelineEditorExtension<TimelineMediaItemData>,
    createTimelineImageExtension() as unknown as TimelineEditorExtension<TimelineMediaItemData>,
    createTimelineTextExtension() as unknown as TimelineEditorExtension<TimelineMediaItemData>,
  ];
}

export function createSplitPackageImportResolver() {
  const audioBackend = createTimelineAudioBrowserBackend();
  const imageBackend = createTimelineImageBrowserBackend();
  const videoBackend = createTimelineVideoBrowserBackend();

  const dispose = () => {
    audioBackend.dispose();
    imageBackend.dispose();
    videoBackend.dispose();
  };

  const importAssets = async (
    sources: TimelineWorkbenchImportSource[],
    context?: TimelineWorkbenchImportContext,
  ): Promise<Array<TimelineWorkbenchImportResult<TimelineMediaItemData>>> =>
    Promise.all(
      sources.map(async (source, index) => {
        const sourceId = source.label ?? source.file?.name ?? source.url ?? `source-${index + 1}`;
        const file = source.file;

        context?.onProgress(sourceId, { phase: "probing", completed: 0, total: 1 });

        if (!file) {
          return { errors: ["Only file imports use the split compute backends."] };
        }

        if (file.type.startsWith("audio/")) {
          return (await createTimelineAudioFileAsset(file, {
            backend: audioBackend,
            signal: context?.signal,
            onProgress: (progress) => context?.onProgress(sourceId, progress),
          })) as TimelineWorkbenchImportResult<TimelineMediaItemData>;
        }

        if (file.type.startsWith("image/")) {
          return (await createTimelineImageFileAsset(file, {
            backend: imageBackend,
            signal: context?.signal,
            generateThumbnail: true,
            onProgress: (progress) => context?.onProgress(sourceId, progress),
          })) as TimelineWorkbenchImportResult<TimelineMediaItemData>;
        }

        if (file.type.startsWith("video/")) {
          return (await createTimelineVideoFileAsset(file, {
            backend: videoBackend,
            signal: context?.signal,
            thumbnailCount: 4,
            onProgress: (progress) => context?.onProgress(sourceId, progress),
          })) as TimelineWorkbenchImportResult<TimelineMediaItemData>;
        }

        context?.onWarning(sourceId, `${file.name} is not an audio, image, or video file.`);
        return { errors: [`Unsupported media file: ${file.name}.`] };
      }),
    );

  return { importAssets, dispose };
}
