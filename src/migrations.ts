import {
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
  type SerializedTimelineEditorDocument,
} from "./serialization";

export function migrateTimelineEditorDocument(input: unknown): SerializedTimelineEditorDocument {
  return serializeTimelineEditorDocument(parseTimelineEditorDocument(input));
}
