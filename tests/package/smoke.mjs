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
  "media-types.js",
  "text.js",
  "audio.js",
  "video.js",
  "image.js",
  "data.js",
];
const expectedRuntimeExports = {
  "audio.js": ["createTimelineAudioExtension", "createTimelineAudioFileAsset"],
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
  "history.js": [
    "applyTimelineEditorCommandWithHistory",
    "createTimelineEditorHistory",
    "redoTimelineEditorHistory",
    "undoTimelineEditorHistory",
  ],
  "image.js": ["createTimelineImageExtension"],
  "media-types.js": [
    "assertTimelineMediaKindMatchesData",
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
  "video.js": ["createTimelineVideoExtension"],
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
]) {
  assert(
    packageJson.name !== privatePackageName,
    `Private package ${privatePackageName} must not be published from the root package`,
  );
}

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
