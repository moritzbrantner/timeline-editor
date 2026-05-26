# @moritzbrantner/timeline-editor

Generic timeline document utilities and a React workbench for editing time-aligned items.

## Install

```sh
bun add @moritzbrantner/timeline-editor
```

The React workbench expects `react` as a peer dependency and consumes
`@moritzbrantner/ui@^0.8.0`.

## Main APIs

- `TimelineWorkbench` for a controlled React timeline editor built on `@moritzbrantner/ui`.
- `normalizeTimelineEditorTracks(...)`, `moveTimelineEditorItem(...)`, `resizeTimelineEditorItem(...)`, `splitTimelineEditorItem(...)`, and `duplicateTimelineEditorItem(...)`.
- `detectTimelineEditorOverlaps(...)`, `getTimelineEditorDurationMs(...)`, and UI adapter helpers.

## Notes

- The package also exposes `@moritzbrantner/timeline-editor/core` and `@moritzbrantner/timeline-editor/react` subpaths.
- Use this package for generic timeline workflows. Media-specific editing stays in `@moritzbrantner/media-editor`.

## Enhancement Roadmap

- Undo/redo transaction history for item operations.
- Multi-select item movement and deletion.
- Ripple edit and gap-closing operations.
- Snapping to markers, item edges, playhead, and custom intervals.
- Track grouping and collapsible track lanes.
- Item trimming modes with locked-edge behavior.
- Interactive timeline zoom controls.
- Keyboard nudging through public commands.
- Serialization helpers for timeline documents.
- Examples for project planning, media sequencing, subtitles, and annotation timelines.
