# Extensions

Media-specific behavior belongs in extensions rather than the generic core. An
extension can contribute item rendering, preview rendering, inspector sections,
toolbar actions, context menu items, timeline context menu items, and pure
operations.

`TimelineWorkbench` resolves item renderers by exact `extension.itemKinds`
first, then by normalized `extension.mediaTypes`, then by the consumer
`renderTimelineItem` fallback.

Built-in media foundations are available from these subpaths:

- `@moritzbrantner/timeline-editor/media-types`
- `@moritzbrantner/timeline-editor/text`
- `@moritzbrantner/timeline-editor/audio`
- `@moritzbrantner/timeline-editor/video`
- `@moritzbrantner/timeline-editor/image`
- `@moritzbrantner/timeline-editor/data`

`createTimelineAudioExtension()` includes a default browser audio preview. It
renders native audio controls for selected or active audio items when the item
data includes a playable `data.source.uri`; otherwise it shows the available
source metadata and a compact `No audio source` state.

Browser file import is still owned by the host workbench integration. Use
`createTimelineAudioFileAsset(file)` from `@moritzbrantner/timeline-editor/audio`
inside `onImportAssets` to create an audio asset from a `File`. The helper
returns an object URL and optional cleanup callback, so hosts remain responsible
for revoking object URLs when imported assets or related items are no longer
needed.

These foundations do not decode media, generate waveforms or thumbnails, export
renders, apply effects, or implement transitions. Audio preview uses browser
media controls rather than a synchronized timeline transport.
