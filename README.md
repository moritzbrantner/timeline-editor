# @moritzbrantner/timeline-editor

Generic timeline document utilities and a React workbench for editing time-aligned items.

## Main APIs

- `TimelineWorkbench` for a controlled React timeline editor built on `@moritzbrantner/ui`.
- `normalizeTimelineEditorTracks(...)`, `moveTimelineEditorItem(...)`, `resizeTimelineEditorItem(...)`, `splitTimelineEditorItem(...)`, and `duplicateTimelineEditorItem(...)`.
- `detectTimelineEditorOverlaps(...)`, `getTimelineEditorDurationMs(...)`, and UI adapter helpers.

## Notes

- The package also exposes `@moritzbrantner/timeline-editor/core` and `@moritzbrantner/timeline-editor/react` subpaths.
- Use this package for generic timeline workflows. Media-specific editing stays in `@moritzbrantner/media-editor`.
