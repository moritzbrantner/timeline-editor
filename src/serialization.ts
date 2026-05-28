import { normalizeTimelineEditorDocument } from "./operations";
import {
  isTimelineEditorTransformEasing,
  timelineEditorTransformEasings,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorItemGroup,
  type TimelineEditorTrack,
  type TimelineEditorTransform,
  type TimelineEditorTransformPoint,
  type TimelineEditorTransformValues,
} from "./types";
import { getTimelineEditorValidationErrors } from "./validation";

export type SerializedTimelineEditorDocument<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
> = {
  schemaVersion: 1;
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData, TTransformValues>;
};

export const currentTimelineEditorSchemaVersion = 1;

export class TimelineEditorParseError extends Error {
  issues: Array<{ path: string; message: string }>;

  constructor(issues: Array<{ path: string; message: string }>) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "TimelineEditorParseError";
    this.issues = issues;
  }
}

export function serializeTimelineEditorDocument<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData, TTransformValues>,
): SerializedTimelineEditorDocument<TTrackData, TItemData, TGroupData, TTransformValues> {
  return {
    schemaVersion: currentTimelineEditorSchemaVersion,
    document: normalizeTimelineEditorDocument(document) as TimelineEditorDocument<
      TTrackData,
      TItemData,
      TGroupData,
      TTransformValues
    >,
  };
}

export function parseTimelineEditorDocument(input: unknown): TimelineEditorDocument {
  const document = readTimelineEditorDocument(input, "");
  const issues = getTimelineEditorValidationErrors(document);

  if (issues.length > 0) {
    throw new TimelineEditorParseError(issues);
  }

  return normalizeTimelineEditorDocument(document);
}

export function readTimelineEditorDocument(input: unknown, path: string): TimelineEditorDocument {
  if (!isRecord(input)) {
    throw new TimelineEditorParseError([{ path, message: "Expected an object." }]);
  }

  const maybeSerialized =
    input.schemaVersion === 1 && isRecord(input.document) ? input.document : input;

  if (!isRecord(maybeSerialized) || !Array.isArray(maybeSerialized.tracks)) {
    throw new TimelineEditorParseError([
      { path: withPath(path, "tracks"), message: "Expected tracks array." },
    ]);
  }

  const document: TimelineEditorDocument = {
    tracks: maybeSerialized.tracks.map((track, index) =>
      readTrack(track, withPath(path, `tracks[${index}]`)),
    ),
    durationMs: optionalNumber(maybeSerialized.durationMs, withPath(path, "durationMs")),
    currentTimeMs: optionalNumber(maybeSerialized.currentTimeMs, withPath(path, "currentTimeMs")),
    markers: Array.isArray(maybeSerialized.markers)
      ? maybeSerialized.markers.map((marker, index) => {
          if (!isRecord(marker)) {
            throw new TimelineEditorParseError([
              { path: withPath(path, `markers[${index}]`), message: "Expected marker object." },
            ]);
          }

          return {
            id: requiredString(marker.id, withPath(path, `markers[${index}].id`)),
            timeMs: requiredNumber(marker.timeMs, withPath(path, `markers[${index}].timeMs`)),
            label: optionalString(marker.label, withPath(path, `markers[${index}].label`)),
            color: optionalString(marker.color, withPath(path, `markers[${index}].color`)),
          };
        })
      : undefined,
  };

  if (Array.isArray(maybeSerialized.groups)) {
    document.groups = maybeSerialized.groups.map((group, index) => {
      if (!isRecord(group)) {
        throw new TimelineEditorParseError([
          { path: withPath(path, `groups[${index}]`), message: "Expected group object." },
        ]);
      }

      return {
        id: requiredString(group.id, withPath(path, `groups[${index}].id`)),
        label: requiredString(group.label, withPath(path, `groups[${index}].label`)),
        trackIds: requiredStringArray(group.trackIds, withPath(path, `groups[${index}].trackIds`)),
        collapsed: optionalBoolean(group.collapsed, withPath(path, `groups[${index}].collapsed`)),
        locked: optionalBoolean(group.locked, withPath(path, `groups[${index}].locked`)),
        data: isRecord(group.data) ? group.data : undefined,
      };
    });
  }

  if (Array.isArray(maybeSerialized.itemGroups)) {
    document.itemGroups = maybeSerialized.itemGroups.map((group, index) =>
      readItemGroup(group, withPath(path, `itemGroups[${index}]`)),
    );
  }

  return document;
}

function readTrack(input: unknown, path: string): TimelineEditorTrack {
  if (!isRecord(input)) {
    throw new TimelineEditorParseError([{ path, message: "Expected track object." }]);
  }

  return {
    id: requiredString(input.id, withPath(path, "id")),
    label: requiredString(input.label, withPath(path, "label")),
    kind: optionalString(input.kind, withPath(path, "kind")),
    items: requiredArray(input.items, withPath(path, "items")).map((item, index) =>
      readItem(item, withPath(path, `items[${index}]`)),
    ),
    acceptsItemKinds: Array.isArray(input.acceptsItemKinds)
      ? input.acceptsItemKinds.map((kind, index) =>
          requiredString(kind, withPath(path, `acceptsItemKinds[${index}]`)),
        )
      : undefined,
    height: optionalNumber(input.height, withPath(path, "height")),
    locked: optionalBoolean(input.locked, withPath(path, "locked")),
    data: isRecord(input.data) ? input.data : undefined,
  };
}

function readItem(input: unknown, path: string): TimelineEditorItem {
  if (!isRecord(input)) {
    throw new TimelineEditorParseError([{ path, message: "Expected item object." }]);
  }

  return {
    id: requiredString(input.id, withPath(path, "id")),
    trackId: requiredString(input.trackId, withPath(path, "trackId")),
    label: requiredString(input.label, withPath(path, "label")),
    startMs: requiredNumber(input.startMs, withPath(path, "startMs")),
    durationMs: requiredNumber(input.durationMs, withPath(path, "durationMs")),
    itemGroupId: optionalString(input.itemGroupId, withPath(path, "itemGroupId")),
    kind: optionalString(input.kind, withPath(path, "kind")),
    color: optionalString(input.color, withPath(path, "color")),
    locked: optionalBoolean(input.locked, withPath(path, "locked")),
    transform: input.transform === undefined ? undefined : readTransform(input.transform, path),
    data: isRecord(input.data) ? input.data : undefined,
  };
}

function readTransform(input: unknown, path: string): TimelineEditorTransform {
  if (!isRecord(input)) {
    throw new TimelineEditorParseError([
      { path: withPath(path, "transform"), message: "Expected transform object." },
    ]);
  }

  return {
    points: requiredArray(input.points, withPath(path, "transform.points")).map((point, index) =>
      readTransformPoint(point, withPath(path, `transform.points[${index}]`)),
    ),
    data: isRecord(input.data) ? input.data : undefined,
  };
}

function readTransformPoint(input: unknown, path: string): TimelineEditorTransformPoint {
  if (!isRecord(input)) {
    throw new TimelineEditorParseError([{ path, message: "Expected transform point object." }]);
  }

  return {
    offsetMs: requiredNumber(input.offsetMs, withPath(path, "offsetMs")),
    values: requiredNumberRecord(input.values, withPath(path, "values")),
    easing: optionalTransformEasing(input.easing, withPath(path, "easing")),
  };
}

function readItemGroup(input: unknown, path: string): TimelineEditorItemGroup {
  if (!isRecord(input)) {
    throw new TimelineEditorParseError([{ path, message: "Expected item group object." }]);
  }

  return {
    id: requiredString(input.id, withPath(path, "id")),
    label: requiredString(input.label, withPath(path, "label")),
    itemIds: requiredStringArray(input.itemIds, withPath(path, "itemIds")),
    data: isRecord(input.data) ? input.data : undefined,
  };
}

function requiredArray(input: unknown, path: string) {
  if (!Array.isArray(input)) {
    throw new TimelineEditorParseError([{ path, message: "Expected array." }]);
  }

  return input;
}

function requiredString(input: unknown, path: string) {
  if (typeof input !== "string" || input.length === 0) {
    throw new TimelineEditorParseError([{ path, message: "Expected non-empty string." }]);
  }

  return input;
}

function optionalString(input: unknown, path: string) {
  if (input === undefined) {
    return undefined;
  }

  return requiredString(input, path);
}

function requiredStringArray(input: unknown, path: string) {
  return requiredArray(input, path).map((value, index) =>
    requiredString(value, `${path}[${index}]`),
  );
}

function requiredNumber(input: unknown, path: string) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    throw new TimelineEditorParseError([{ path, message: "Expected finite number." }]);
  }

  return input;
}

function requiredNumberRecord(input: unknown, path: string) {
  if (!isRecord(input)) {
    throw new TimelineEditorParseError([{ path, message: "Expected number record." }]);
  }

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, requiredNumber(value, withPath(path, key))]),
  );
}

function optionalNumber(input: unknown, path: string) {
  if (input === undefined) {
    return undefined;
  }

  return requiredNumber(input, path);
}

function optionalBoolean(input: unknown, path: string) {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input !== "boolean") {
    throw new TimelineEditorParseError([{ path, message: "Expected boolean." }]);
  }

  return input;
}

function optionalTransformEasing(input: unknown, path: string) {
  if (input === undefined) {
    return undefined;
  }

  if (!isTimelineEditorTransformEasing(input)) {
    throw new TimelineEditorParseError([
      { path, message: `Expected one of: ${timelineEditorTransformEasings.join(", ")}.` },
    ]);
  }

  return input;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function withPath(path: string, child: string) {
  return path ? `${path}.${child}` : child;
}
