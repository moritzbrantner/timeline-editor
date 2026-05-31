# Architecture

`@moritzbrantner/timeline-editor` is a domain-neutral temporal editing
foundation. It owns the document model and generic editing workbench, but it is
not a map editor, story editor, subtitle editor, or video editor.

The package should stay useful for any workflow that edits timed items:

- timeline document model
- tracks, items, item kinds, item data, groups, and markers
- current time, playhead, selections, and selected ranges
- snapping and overlap policy
- move, resize, split, duplicate, delete, ripple, gap, and transform commands
- history, undo, redo, serialization, migration, and validation
- React workbench shell
- extension registration
- generic inspector, toolbar, action, menu, preview, compositor, and asset insertion hooks
- lightweight built-in foundations for common item families such as text, audio,
  video, image, and data

## Intended Layering

```txt
timeline-editor
  -> generic temporal editing

timeline-map
  -> temporal GeoJSON/map/camera/style editing

timeline-story
  -> timed story structures and storytelling-library integration

timeline-subtitles
  -> subtitle/caption editing and format import/export

media-editor-core
  -> video/audio/image/text composition model

media-editor-browser
  -> browser File APIs, workers, WASM, previews, proxies, thumbnails

media-editor-react
  -> React editor UI built on TimelineWorkbench

media-editor-renderer
  -> export/render pipeline, Rust/FFmpeg/native/server integration
```

## Package Responsibilities

`timeline-editor` owns generic temporal editing. It should not know about
GeoJSON internals, story graphs, subtitle format fidelity, codecs, effects,
transitions, proxy generation, decoding, encoding, or export.

`timeline-map` should own map domain types and behaviors: GeoJSON, map layers,
camera positions, styles, routes, spatial annotations, map preview rendering,
and map-specific inspectors or operations.

`timeline-story` should own story structures: scenes, beats, chapters,
narration, dialogue, visual story elements, story IDs, characters, locations,
and storytelling-library adapters.

`timeline-subtitles` should own subtitle and caption tooling: cue editing,
syncing, import/export formats, format-specific validation, preview fidelity,
speaker/language workflows, and advanced timed-text behavior.

`media-editor-core` should own the media composition model: projects, assets,
clips, render plans, effects, transitions, and validation specific to
video/audio/image/text composition.

`media-editor-browser` should own browser integration: File APIs, workers,
WebCodecs where appropriate, WASM loading, preview caches, proxies, thumbnails,
and waveform pipelines.

`media-editor-react` should own media-editor UI built on `TimelineWorkbench`:
media inspectors, preview compositors, toolbars, panels, and editing workflows.

`media-editor-renderer` should own export and render pipelines: render-plan to
FFmpeg conversion, Rust/native/server render backends, export jobs, and long
render workflows.

## Dependency Rules

- Domain packages may import `@moritzbrantner/timeline-editor`.
- `@moritzbrantner/timeline-editor` must not import map, story, subtitle, or
  media-editor packages.
- Rust/WASM packages must not leak into the generic core unless they are hidden
  behind small, optional, domain-neutral interfaces.
- Browser-only code must not be required by pure core packages.
- React code must not be required by pure core packages.
- Renderer and export logic must not be required by editor UI packages.
- FFmpeg, WebCodecs, demuxing, muxing, rendering, proxies, caching, and heavy
  processing do not belong in `timeline-editor` core.

## Extension Boundary

Domain behavior should enter the workbench through `TimelineEditorExtension`.
Extensions can match by exact `item.kind`, an explicit `matchItem` predicate,
`data.domain`, or `data.mediaType`. The generic editor does not need a registry
of every possible domain.

The matching priority is:

1. exact item kind
2. explicit `matchItem`
3. `data.domain`
4. normalized media type

This lets a future app compose independent packages:

```tsx
<TimelineWorkbench
  document={document}
  extensions={[
    createMapTimelineExtension(),
    createStoryTimelineExtension(),
    createSubtitleTimelineExtension(),
    createMediaEditorExtension(),
  ]}
/>
```

## Media Editor Path

Phase 1:

- keep `timeline-editor` generic
- improve extension API
- add examples for map, story, subtitle, and media domains
- keep existing audio, video, image, text, and data foundations lightweight

Phase 2:

- create app-local media editor modules
- add a media project model
- add import pipeline
- add preview compositor
- add subtitle, story, and map tracks as first-class domain examples

Phase 3:

- extract media editor packages
- add Rust/WASM workers for heavy operations
- add proxy, thumbnail, waveform, and cache pipelines
- add render-plan generation

Phase 4:

- add native/server renderer
- add FFmpeg/Rust export backend
- support full project export, transitions, effects, and long-video workflows
