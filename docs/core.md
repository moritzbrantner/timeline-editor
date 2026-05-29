# Core Timeline APIs

The core package stays media-agnostic. Items can represent any timed domain
object through `kind` and `data`, while the shared editor owns generic timeline
behavior: selection, ranges, move, resize, split, trim, grouping, markers,
snapping, overlap policies, validation, serialization, and history.

Use pure utilities from `@moritzbrantner/timeline-editor/core` for non-React
state management:

```ts
import {
  moveTimelineEditorItem,
  normalizeTimelineEditorDocument,
} from "@moritzbrantner/timeline-editor/core";

const tracks = moveTimelineEditorItem(document.tracks, {
  itemId: "brief",
  startMs: 1_500,
});

const nextDocument = normalizeTimelineEditorDocument({ ...document, tracks });
```

Operations allow overlaps by default. Set `editPolicy.overlap` to `prevent` or
`push` when a host needs stronger placement rules. Track locking, group locking,
minimum duration, snapping, and document duration limits are enforced by the
operation options that accept them.
