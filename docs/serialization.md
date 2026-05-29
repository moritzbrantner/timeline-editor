# Serialization And Migrations

Use `serializeTimelineEditorDocument(document)` when saving timeline state and
`migrateTimelineEditorDocument(stored).document` when loading it.

```ts
import { migrateTimelineEditorDocument } from "@moritzbrantner/timeline-editor";
import {
  currentTimelineEditorSchemaVersion,
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
} from "@moritzbrantner/timeline-editor/serialization";

const stored = serializeTimelineEditorDocument(document);
const restored = parseTimelineEditorDocument(stored);
const migrated = migrateTimelineEditorDocument(stored).document;
const schemaVersion = currentTimelineEditorSchemaVersion;
```

Serialized documents currently use `schemaVersion: 1`.
`migrateTimelineEditorDocument` accepts raw documents and v1 serialized
documents, preserves custom `data`, and throws `TimelineEditorMigrationError`
for unsupported future schema versions. Custom `data` fields should be
JSON-compatible host data.
