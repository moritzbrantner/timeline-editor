# Extensions

Media-specific behavior belongs in extensions rather than the generic core. An
extension can contribute item rendering, preview rendering, inspector sections,
toolbar actions, context menu items, timeline context menu items, and pure
operations.

For the long-term multi-domain package boundaries, see
[Architecture](./architecture.md) and [Domain Extensions](./domain-extensions.md).

`TimelineWorkbench` resolves item renderers by exact `extension.itemKinds`
first, then by explicit `extension.matchItem`, then by `extension.domains`, then
by normalized `extension.mediaTypes`, then by the consumer `renderTimelineItem`
fallback.

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
returns an object URL and optional cleanup callback. `TimelineWorkbench` stores
that cleanup when it is returned from `onImportAssets` and revokes
workbench-owned imports on unmount; hosts that keep sources elsewhere can use
`createTimelineMediaSourceRegistry()` from `@moritzbrantner/timeline-editor/media-types`.
Use `createTimelineVideoFileAsset(file)` from
`@moritzbrantner/timeline-editor/video` for matching video imports with
duration, dimensions, poster, optional thumbnails, and MIME/source metadata.

These foundations do not generate audio waveforms, export renders, apply
effects, or implement transitions. Audio preview uses browser media controls
rather than a synchronized timeline transport.
