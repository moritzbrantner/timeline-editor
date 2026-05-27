import {
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
  type SerializedTimelineEditorDocument,
} from "./serialization";

export class TimelineEditorMigrationError extends Error {
  schemaVersion: number | string | undefined;

  constructor(schemaVersion: number | string | undefined) {
    super(
      schemaVersion === undefined
        ? "Cannot migrate a timeline editor document without a schema version."
        : `Unsupported timeline editor schema version: ${schemaVersion}.`,
    );
    this.name = "TimelineEditorMigrationError";
    this.schemaVersion = schemaVersion;
  }
}

export function migrateTimelineEditorDocument(input: unknown): SerializedTimelineEditorDocument {
  if (!isRecord(input) || input.schemaVersion === undefined) {
    return serializeTimelineEditorDocument(parseTimelineEditorDocument(input));
  }

  if (input.schemaVersion === 1) {
    return serializeTimelineEditorDocument(parseTimelineEditorDocument(input));
  }

  throw new TimelineEditorMigrationError(
    typeof input.schemaVersion === "number" || typeof input.schemaVersion === "string"
      ? input.schemaVersion
      : undefined,
  );
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
