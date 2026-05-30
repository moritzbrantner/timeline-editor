import { useState } from "react";

import {
  TimelineWorkbench,
  createTimelineEditorHistory,
  type TimelineEditorClipboard,
  type TimelineEditorDocument,
  type TimelineEditorHistory,
  type TimelineEditorSelection,
  type TimelineEditorViewport,
} from "@moritzbrantner/timeline-editor";
import { applyTimelineEditorCommand } from "@moritzbrantner/timeline-editor/commands";
import {
  createTimelineEditorSnapOptions,
  moveTimelineEditorItem,
} from "@moritzbrantner/timeline-editor/core";
import {
  createTimelineEditorHistory as createSubpathTimelineEditorHistory,
  undoTimelineEditorHistory,
} from "@moritzbrantner/timeline-editor/history";
import {
  getTimelineMediaTypeForKind,
  validateTimelineEditorMediaTypes,
} from "@moritzbrantner/timeline-editor/media-types";
import {
  currentTimelineEditorSchemaVersion,
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
} from "@moritzbrantner/timeline-editor/serialization";
import {
  createTimelineAudioExtension,
  type TimelineAudioItemData,
} from "@moritzbrantner/timeline-editor/audio";
import {
  createTimelineNumericDataExtension,
  type TimelineNumericDataItemData,
} from "@moritzbrantner/timeline-editor/data";
import {
  createTimelineImageExtension,
  type TimelineImageItemData,
} from "@moritzbrantner/timeline-editor/image";
import {
  createTimelineTextExtension,
  createTimelineTextFileAsset,
  type TimelineTextItemData,
} from "@moritzbrantner/timeline-editor/text";
import {
  createTimelineVideoExtension,
  type TimelineVideoItemData,
} from "@moritzbrantner/timeline-editor/video";

type MediaItemData =
  | TimelineAudioItemData
  | TimelineImageItemData
  | TimelineNumericDataItemData
  | TimelineTextItemData
  | TimelineVideoItemData;

const initialDocument: TimelineEditorDocument<Record<string, unknown>, MediaItemData> = {
  durationMs: 8_000,
  currentTimeMs: 1_000,
  tracks: [
    {
      id: "video",
      label: "Video",
      acceptsItemKinds: ["video", "image", "text"],
      items: [
        {
          id: "clip",
          trackId: "video",
          label: "Clip",
          kind: "video",
          startMs: 1_000,
          durationMs: 2_000,
          data: { mediaType: "video" },
        },
      ],
    },
  ],
};

export function ControlledPackageConsumptionExample() {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const [viewport, setViewport] = useState<TimelineEditorViewport>({ pixelsPerSecond: 80 });
  const [clipboard, setClipboard] = useState<TimelineEditorClipboard<MediaItemData>>();
  const [history, setHistory] = useState<
    TimelineEditorHistory<Record<string, unknown>, MediaItemData>
  >(
    () =>
      createTimelineEditorHistory() as TimelineEditorHistory<
        Record<string, unknown>,
        MediaItemData
      >,
  );

  return (
    <TimelineWorkbench
      document={document}
      selection={selection}
      viewport={viewport}
      clipboard={clipboard}
      history={history}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
      onViewportChange={setViewport}
      onClipboardChange={setClipboard}
      onHistoryChange={setHistory}
    />
  );
}

export function exercisePackageSubpaths(document = initialDocument) {
  const mediaExtensions = [
    createTimelineAudioExtension(),
    createTimelineVideoExtension(),
    createTimelineImageExtension(),
    createTimelineTextExtension(),
    createTimelineNumericDataExtension(),
  ] as const;
  const movedTracks = moveTimelineEditorItem(document.tracks, {
    itemId: "clip",
    startMs: 1_500,
  });
  const commandResult = applyTimelineEditorCommand(
    { ...document, tracks: movedTracks },
    { itemIds: ["clip"] },
    { type: "copy-selection" },
  );
  const serialized = serializeTimelineEditorDocument(commandResult.document);
  const parsed = parseTimelineEditorDocument(serialized);
  const history = createSubpathTimelineEditorHistory();

  return {
    history: undoTimelineEditorHistory(history).history,
    mediaIssues: validateTimelineEditorMediaTypes(parsed),
    mediaExtensions,
    mediaType: getTimelineMediaTypeForKind("video"),
    schemaVersion: currentTimelineEditorSchemaVersion,
    snap: createTimelineEditorSnapOptions(100, { enabled: true }),
    textFileAssetFactory: createTimelineTextFileAsset,
  };
}
