import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const distDir = path.join(rootDir, "dist");
const forbiddenRuntimeImports = [
  '"react"',
  '"react/jsx-runtime"',
  '"@moritzbrantner/ui"',
  '"@moritzbrantner/ui/labs"',
];

const entryFiles = [
  "index.js",
  "core.js",
  "react.js",
  "commands.js",
  "history.js",
  "serialization.js",
  "extensions.js",
  "media-types.js",
  "text.js",
  "audio.js",
  "video.js",
  "image.js",
  "data.js",
];
const expectedRuntimeExports = {
  "audio.js": [
    "createTimelineAudioExtension",
    "createTimelineAudioFileAsset",
    "createTimelineAudioWaveformFromAudioBuffer",
    "loadTimelineAudioMetadata",
  ],
  "commands.js": ["applyTimelineEditorCommand"],
  "core.js": [
    "addTimelineEditorMarker",
    "addTimelineEditorTrack",
    "addTimelineEditorTrackGroup",
    "addTimelineEditorTracksToGroup",
    "applyTimelineEditorTransformEasing",
    "canPlaceTimelineEditorItemOnTrack",
    "clampTimelineEditorTime",
    "closeTimelineEditorGap",
    "createTimelineEditorClipboard",
    "createTimelineEditorSnapOptions",
    "createTimelineEditorSnapResolver",
    "defaultTimelineEditorEditPolicy",
    "defaultTimelineEditorMinItemDurationMs",
    "defaultTimelineEditorSelection",
    "defaultTimelineEditorSnapMs",
    "defaultTimelineEditorSnapThresholdPx",
    "detectTimelineEditorOverlaps",
    "doesTimelineEditorTrackAcceptItem",
    "duplicateTimelineEditorItem",
    "duplicateTimelineEditorItems",
    "findTimelineEditorItem",
    "formatTimelineEditorTimeMs",
    "getTimelineEditorDurationMs",
    "getTimelineEditorFrameDurationMs",
    "getTimelineEditorGroupedItemIds",
    "getTimelineEditorItemEndMs",
    "getTimelineEditorItemTransformValuesAt",
    "getTimelineEditorSnapTimes",
    "getTimelineEditorTickIntervalMs",
    "getTimelineEditorTicks",
    "getTimelineEditorTransformValuesAt",
    "getTimelineEditorValidationErrors",
    "getTimelineEditorValidationIssueTarget",
    "groupTimelineEditorItems",
    "insertTimelineEditorGap",
    "insertTimelineEditorItem",
    "isTimelineEditorTransformEasing",
    "moveTimelineEditorItem",
    "moveTimelineEditorItems",
    "moveTimelineEditorTrack",
    "moveTimelineEditorTrackInGroup",
    "moveTimelineEditorTransformPoint",
    "normalizeTimelineEditorDocument",
    "normalizeTimelineEditorItemGroups",
    "normalizeTimelineEditorTrack",
    "normalizeTimelineEditorTrackGroups",
    "normalizeTimelineEditorTracks",
    "normalizeTimelineEditorTransform",
    "pasteTimelineEditorClipboard",
    "removeTimelineEditorItem",
    "removeTimelineEditorItems",
    "removeTimelineEditorMarker",
    "removeTimelineEditorRange",
    "removeTimelineEditorTrack",
    "removeTimelineEditorTrackGroup",
    "removeTimelineEditorTracksFromGroup",
    "removeTimelineEditorTransformPoint",
    "resizeTimelineEditorItem",
    "resolveTimelineEditorSnap",
    "rippleDeleteTimelineEditorItems",
    "rippleMoveTimelineEditorItems",
    "setTimelineEditorCurrentTime",
    "setTimelineEditorItemTransform",
    "setTimelineEditorMarkers",
    "sliceTimelineEditorTransform",
    "snapTimelineEditorTime",
    "splitTimelineEditorItem",
    "splitTimelineEditorItems",
    "timelineEditorTransformEasings",
    "trimTimelineEditorItem",
    "ungroupTimelineEditorItems",
    "updateMarker",
    "updateTimelineEditorMarker",
    "updateTimelineEditorTrack",
    "updateTimelineEditorTrackGroup",
    "updateTimelineEditorTransformPoint",
    "upsertTimelineEditorTransformPoint",
    "validateTimelineEditorDocument",
  ],
  "data.js": ["createTimelineNumericDataExtension"],
  "extensions.js": [
    "doesTimelineEditorExtensionMatchItem",
    "findTimelineEditorExtensionForItem",
    "getTimelineEditorDomainForItem",
    "getTimelineEditorItemDataDomain",
  ],
  "history.js": [
    "applyTimelineEditorCommandWithHistory",
    "createTimelineEditorHistory",
    "redoTimelineEditorHistory",
    "undoTimelineEditorHistory",
  ],
  "image.js": ["createTimelineImageExtension"],
  "media-types.js": [
    "assertTimelineMediaKindMatchesData",
    "createTimelineMediaFileSource",
    "createTimelineMediaObjectUrl",
    "createTimelineMediaSourceRegistry",
    "getTimelineMediaSourceKey",
    "getTimelineMediaTypeForAsset",
    "getTimelineMediaTypeForItem",
    "getTimelineMediaTypeForKind",
    "getTimelineMediaTypeFromData",
    "isTimelineMediaType",
    "timelineMediaTypes",
    "validateTimelineEditorMediaTypes",
  ],
  "react.js": [
    "TimelineEditor",
    "TimelineEditorClip",
    "TimelineEditorContent",
    "TimelineEditorLiveRegion",
    "TimelineEditorPlayhead",
    "TimelineEditorProvider",
    "TimelineEditorRangeOverlay",
    "TimelineEditorRoot",
    "TimelineEditorRuler",
    "TimelineEditorSnapFeedback",
    "TimelineEditorSnapGuide",
    "TimelineEditorTrackGrid",
    "TimelineEditorTrackGroupRow",
    "TimelineEditorTrackHeader",
    "TimelineEditorTrackLane",
    "TimelineEditorTrackRow",
    "TimelineEditorTracks",
    "TimelineWorkbench",
    "defaultTimelineEditorHotkeys",
    "defaultTimelineWorkbenchHotkeys",
    "getTimelineEditorDurationForDocument",
    "getTimelineEditorItemStyle",
    "getTimelineEditorTimeFromDelta",
    "getTimelineEditorTimeFromPointer",
    "getTimelineEditorWidthPx",
    "getVisibleTimelineEditorTicks",
    "getVisibleTimelineEditorTicksForRange",
    "timelineEditorMaxPixelsPerSecond",
    "timelineEditorMinPixelsPerSecond",
    "timelineEditorTrackHeaderWidthPx",
    "useTimelineEditor",
  ],
  "serialization.js": [
    "TimelineEditorParseError",
    "currentTimelineEditorSchemaVersion",
    "parseTimelineEditorDocument",
    "readTimelineEditorDocument",
    "serializeTimelineEditorDocument",
  ],
  "text.js": [
    "createTimelineTextExtension",
    "createTimelineTextFileAsset",
    "detectTimelineTextFormat",
    "getTimelineTextCueAt",
    "getTimelineTextCuesAt",
    "getTimelineTextDisplayText",
    "getTimelineTextStyleForCue",
    "parseTimelineAssText",
    "parseTimelineSrtText",
    "parseTimelineText",
    "parseTimelineWebVttText",
  ],
  "video.js": ["createTimelineVideoExtension", "createTimelineVideoFileAsset"],
};
const expectedSplitPackageExports = {
  audio: [
    "analyzeTimelineAudioSource",
    "createTimelineAudioBrowserBackend",
    "createTimelineAudioExtension",
    "createTimelineAudioFileAsset",
    "createTimelineAudioWaveformFromAudioBuffer",
    "loadTimelineAudioMetadata",
  ],
  captions: [
    "createTimelineCaptionExtension",
    "createTimelineCaptionFileAsset",
    "createTimelineCaptionSource",
    "createTimelineCaptionsBrowserBackend",
    "createTimelineCaptionsExtension",
    "createTimelineTextExtension",
    "createTimelineTextFileAsset",
    "detectTimelineCaptionFormat",
    "detectTimelineTextFormat",
    "getTimelineCaptionCueAt",
    "getTimelineCaptionCuesAt",
    "getTimelineCaptionDisplayText",
    "getTimelineCaptionStyleForCue",
    "getTimelineTextCueAt",
    "getTimelineTextCuesAt",
    "getTimelineTextDisplayText",
    "getTimelineTextStyleForCue",
    "parseTimelineAssCaptions",
    "parseTimelineAssText",
    "parseTimelineCaptions",
    "parseTimelineCaptionsSync",
    "parseTimelineSrtCaptions",
    "parseTimelineSrtText",
    "parseTimelineText",
    "parseTimelineWebVttCaptions",
    "parseTimelineWebVttText",
  ],
  compute: [
    "createTimelineAdaptiveBackend",
    "createTimelineBrowserWasmBackend",
    "createTimelineComputeError",
    "createTimelineJsFallbackBackend",
    "createTimelineTauriBackend",
    "createTimelineWorkerHandler",
    "isTimelineComputeError",
    "normalizeTimelineComputeError",
  ],
  data: [
    "analyzeTimelineNumericData",
    "analyzeTimelineNumericDataSync",
    "createTimelineDataBrowserBackend",
    "createTimelineNumericDataExtension",
  ],
  geo: [
    "analyzeTimelineGeoJson",
    "analyzeTimelineGeoJsonSync",
    "createTimelineGeoBrowserBackend",
    "createTimelineGeoExtension",
    "createTimelineGeoJsonAsset",
    "createTimelineGeoJsonSource",
  ],
  image: [
    "analyzeTimelineImageSource",
    "createTimelineImageBrowserBackend",
    "createTimelineImageExtension",
    "createTimelineImageFileAsset",
  ],
  tauri: ["createTimelineTauriBackend"],
  video: [
    "analyzeTimelineVideoSource",
    "createTimelineVideoBrowserBackend",
    "createTimelineVideoExtension",
    "createTimelineVideoFileAsset",
  ],
};

for (const entryFile of entryFiles) {
  const entryPath = path.join(distDir, entryFile);

  assert(existsSync(entryPath), `Missing built entry: ${entryFile}`);
}

const importedEntries = Object.fromEntries(
  await Promise.all(
    entryFiles.map(async (entryFile) => [
      entryFile,
      await import(pathToFileURL(path.join(distDir, entryFile)).href),
    ]),
  ),
);
const expectedIndexExports = [
  ...new Set([
    ...Object.values(expectedRuntimeExports).flat(),
    "TimelineEditorMigrationError",
    "migrateTimelineEditorDocument",
  ]),
];

assertSetEqual(
  Object.keys(importedEntries["index.js"] ?? {}).sort(),
  expectedIndexExports,
  "index.js runtime exports changed",
);

for (const [entryFile, expectedExports] of Object.entries(expectedRuntimeExports)) {
  assertSetEqual(
    Object.keys(importedEntries[entryFile] ?? {}).sort(),
    expectedExports,
    `${entryFile} runtime exports changed`,
  );
}

for (const exportTarget of Object.values(packageJson.exports)) {
  for (const relativePath of Object.values(exportTarget)) {
    assert(
      existsSync(path.join(rootDir, relativePath)),
      `Package export target does not exist: ${relativePath}`,
    );
  }
}

for (const [subpath, exportTarget] of Object.entries(packageJson.exports)) {
  assert("types" in exportTarget, `Package export ${subpath} is missing a types target`);
  assert(
    existsSync(path.join(rootDir, exportTarget.types)),
    `Package export ${subpath} types target does not exist: ${exportTarget.types}`,
  );
}

assert(
  packageJson.peerDependencies?.react === "^19.0.0" &&
    packageJson.peerDependencies?.["react-dom"] === "^19.0.0",
  "React peer dependency contract changed",
);

assertSetEqual(packageJson.files ?? [], ["dist"], "Published files should stay limited to dist");

for (const privatePackageName of [
  "@timeline-editor/audio",
  "@timeline-editor/video",
  "@timeline-editor/captions",
  "@timeline-editor/compute",
  "@timeline-editor/image",
  "@timeline-editor/geo",
  "@timeline-editor/data",
  "@timeline-editor/tauri",
]) {
  assert(
    packageJson.name !== privatePackageName,
    `Private package ${privatePackageName} must not be published from the root package`,
  );
}

await Promise.all(
  Object.entries(expectedSplitPackageExports).map(async ([packageDirectory, expectedExports]) => {
    const splitPackageDir = path.join(rootDir, "packages", packageDirectory);
    const splitPackageJson = JSON.parse(
      readFileSync(path.join(splitPackageDir, "package.json"), "utf8"),
    );
    const packageName = `@timeline-editor/${packageDirectory}`;

    assert(splitPackageJson.name === packageName, `${packageName} package name changed`);
    assert(splitPackageJson.private === false, `${packageName} should be publishable`);
    assert(splitPackageJson.exports?.["."], `${packageName} is missing a root export`);

    for (const exportTarget of Object.values(splitPackageJson.exports)) {
      for (const relativePath of Object.values(exportTarget)) {
        assert(
          existsSync(path.join(splitPackageDir, relativePath)),
          `${packageName} export target does not exist: ${relativePath}`,
        );
      }
    }

    const runtime = await import(pathToFileURL(path.join(splitPackageDir, "dist/index.js")).href);
    assertSetEqual(Object.keys(runtime).sort(), expectedExports, `${packageName} exports changed`);
  }),
);

for (const [subpath, exportTarget] of Object.entries(packageJson.exports)) {
  assert("import" in exportTarget, `Package export ${subpath} is missing an import target`);
}

for (const entryFile of ["core.js", "commands.js", "history.js", "serialization.js"]) {
  const visited = new Set();
  const queue = [entryFile];

  while (queue.length > 0) {
    const file = queue.shift();

    if (!file || visited.has(file)) {
      continue;
    }

    visited.add(file);
    const filePath = path.join(distDir, file);
    const source = readFileSync(filePath, "utf8");

    for (const forbiddenImport of forbiddenRuntimeImports) {
      assert(
        !source.includes(forbiddenImport),
        `${entryFile} runtime graph unexpectedly imports ${forbiddenImport} through ${file}`,
      );
    }

    for (const importedFile of source.matchAll(
      /from\s+"\.\/([^"]+\.js)"|import\s+"\.\/([^"]+\.js)"/g,
    )) {
      queue.push(importedFile[1] ?? importedFile[2]);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSetEqual(actual, expected, message) {
  const sortedExpected = [...expected].sort();

  assert(
    actual.length === sortedExpected.length &&
      actual.every((value, index) => value === sortedExpected[index]),
    `${message}.\nExpected: ${sortedExpected.join(", ")}\nActual: ${actual.join(", ")}`,
  );
}
