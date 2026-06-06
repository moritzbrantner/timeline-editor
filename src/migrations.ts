import { isEditorRecord } from "@moritzbrantner/editor-core/json";
import { EditorMigrationError } from "@moritzbrantner/editor-core/serialization";

import {
  currentTimelineEditorSchemaVersion,
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
  type SerializedTimelineEditorDocument,
} from "./serialization";

const timelineEditorDocumentFormat = "@moritzbrantner/timeline-editor/document";

export class TimelineEditorMigrationError extends EditorMigrationError {
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
  if (!isEditorRecord(input) || input.schemaVersion === undefined) {
    return serializeTimelineEditorDocument(parseTimelineEditorDocument(input));
  }

  if (
    input.schemaVersion === currentTimelineEditorSchemaVersion &&
    (input.format === undefined || input.format === timelineEditorDocumentFormat)
  ) {
    return serializeTimelineEditorDocument(parseTimelineEditorDocument(input));
  }

  throw new TimelineEditorMigrationError(
    typeof input.schemaVersion === "number" || typeof input.schemaVersion === "string"
      ? input.schemaVersion
      : undefined,
  );
}
