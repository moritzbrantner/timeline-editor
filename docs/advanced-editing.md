# Advanced editing operations

Timeline Editor now exposes the editing semantics needed for non-linear editing without making media decoding part of the timeline kernel.

## Roll trim

`trimTimelineEditorItem(..., "roll")` moves a shared boundary between two adjacent, unlocked items. The operation changes the left duration and the right start/duration atomically, preserves the outer span, respects snapping, and enforces the configured minimum item duration. If the items are not adjacent or either item/track is locked, the document is left unchanged.

## Slip edit

`slipTimelineEditorItem` keeps `startMs` and `durationMs` fixed while changing which source window is shown. Source-specific storage is delegated to `TimelineEditorSlipAdapter`, which reads and writes source offsets and can report a source duration for clamping.

This keeps video/audio source metadata outside the generic item model while allowing media extensions to provide frame- or sample-aware source offset behavior later.
