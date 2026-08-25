# Timeline Editor roadmap

Timeline Editor should remain the time-aligned editing specialization of editor-core. Its next wave should first converge generic editor behavior, then deepen timeline semantics that cannot sensibly live in editor-core.

## 1. Migrate generic editor infrastructure

Use source-first development to adopt current editor-core where semantics match.

Audit and converge:

- commands
- history/transactions
- selection primitives
- serialization and migrations
- persistence/dirty state
- interaction sessions
- shared validation diagnostics

Keep timeline wrappers only when they carry temporal semantics.

### Acceptance criteria

- full source verification passes against the selected editor-core revision
- registry/packed verification remains independently green
- no media-specific behavior moves into editor-core

## 2. Snapping and temporal alignment

Build one coherent snapping model for:

- clip starts/ends
- markers
- playhead
- selected range boundaries
- frame boundaries when frame-rate-aware editing is enabled
- optional grid/beat-like host snap points

Snapping should be headless and deterministic; visual guides are projections of the snap result.

## 3. Editing operations

Deepen timeline-specific operations with explicit semantics and undo transactions:

- trim
- split
- ripple delete/insert where enabled
- roll edit between adjacent clips
- slip source range without moving the clip
- multi-item move/resize
- track-aware duplicate/paste

Do not add operations merely to mimic a video editor vocabulary; each should be justified by at least one supported domain extension.

## 4. Track hierarchy and grouping

Add only the hierarchy needed by real timeline domains:

- stable track ordering
- optional track groups/folders
- lock/visibility/mute-style capabilities through adapters/extensions
- selection and collapse state that remains view state when possible

## 5. Transitions and keyframes

Treat these as later extension foundations, not mandatory core document fields.

- transitions should describe relationships between time-aligned items
- keyframes should be adapter/extension-driven until multiple domains share a stable model
- preview/render engines remain host or domain-extension responsibilities

## 6. Media/editor boundary

Timeline Editor owns time alignment and editing. Audio/video/image/text packages own domain-specific metadata, source probing, and rendering helpers. The editor must not become a media-processing backend.

## 7. Reference scenarios

Dogfood against several shapes before broadening APIs:

- subtitle/text editing
- audio arrangement
- simple video assembly
- generic project/milestone timeline

Use those scenarios to validate keyboard editing, touch behavior, large-timeline performance, and source-first editor-core integration.
