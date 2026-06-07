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

Accelerated split packages are available under `@timeline-editor/*` for hosts
that want browser worker/WASM or Tauri-backed computation:

- `@timeline-editor/compute` for `TimelineComputeBackend`,
  `createTimelineBrowserWasmBackend(...)`, `createTimelineTauriBackend(...)`,
  and `createTimelineAdaptiveBackend(...)`.
- `@timeline-editor/audio`, `@timeline-editor/video`,
  `@timeline-editor/image`, `@timeline-editor/captions`,
  `@timeline-editor/geo`, and `@timeline-editor/data` for domain extension
  factories and async import/analysis helpers.

These packages are optional wrappers. The root package remains lightweight and
does not import them. See [Media Import Adoption](./media-import-adoption.md)
for root-package and split-package import recipes.

`createTimelineAudioExtension()` includes source metadata rendering, centered
waveform clip rendering, compact clip-level mute/volume state badges, editable
mute and volume inspector controls, a selected-item audio metadata inspector,
and synchronized workbench audio preview for items with a playable
`data.source.uri`. If an audio item has no playable source, the preview shows
the available source metadata and a compact `No audio source` state.

Browser file import is still owned by the host workbench integration. Use
`createTimelineAudioFileAsset(file)` from `@moritzbrantner/timeline-editor/audio`
inside `onImportAssets` to create an audio asset from a `File`. The helper
returns an object URL and optional cleanup callback. It best-effort extracts
duration, channels, sample rate, and a compact waveform with browser Web Audio
APIs; pass `generateWaveform: false` to disable decoding, or pass `waveform` to
use host-supplied peaks. `TimelineWorkbench` stores that cleanup when it is
returned from `onImportAssets` and revokes workbench-owned imports on unmount;
hosts that keep sources elsewhere can use `createTimelineMediaSourceRegistry()`
from `@moritzbrantner/timeline-editor/media-types`.
Use `createTimelineVideoFileAsset(file)` from
`@moritzbrantner/timeline-editor/video` for matching video imports with
duration, dimensions, poster, optional thumbnails, and MIME/source metadata.

These foundations do not export renders, apply effects, or implement
transitions. Audio waveform generation in the root package is lightweight and
browser-only; heavy worker, cache, Tauri, and proxy pipelines belong in the
split `@timeline-editor/*` packages or host applications.
