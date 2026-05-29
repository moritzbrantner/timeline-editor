# Extensions

Media-specific behavior belongs in extensions rather than the generic core. An
extension can contribute item rendering, preview rendering, inspector sections,
toolbar actions, context menu items, timeline context menu items, and pure
operations.

`TimelineWorkbench` resolves item renderers by exact `extension.itemKinds`
first, then by normalized `extension.mediaTypes`, then by the consumer
`renderTimelineItem` fallback.

Built-in display-only media foundations are available from these subpaths:

- `@moritzbrantner/timeline-editor/media-types`
- `@moritzbrantner/timeline-editor/text`
- `@moritzbrantner/timeline-editor/audio`
- `@moritzbrantner/timeline-editor/video`
- `@moritzbrantner/timeline-editor/image`
- `@moritzbrantner/timeline-editor/data`

These foundations describe item data for display. They do not decode media,
generate waveforms or thumbnails, play audio/video, export renders, apply
effects, or implement transitions.
