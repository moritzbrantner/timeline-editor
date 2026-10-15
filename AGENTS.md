# Repository Agent Instructions

## Interface layout and interaction

- Interactive workbenches apply the current shared `ui` conventions from `moritzbrantner/coding-agent-conventions`, especially `UI-008`, `UI-012`, and `UI-013`.
- Treat the timeline/media work surface as the primary editor. Selection, scrubbing, moving, trimming, and other temporal operations should happen directly on represented items when practical; exact time/frame fields and keyboard commands provide precision.
- Give each pointer/keyboard interaction one owner. Do not layer duplicate scrubbers, selection rectangles, drag state, or timeline gesture handlers over a lower-level owner.
- Do not add empty instructional panels, placeholder cards, or divs whose only purpose is to tell users obvious information or consume space while waiting for selection.
- Empty states must either expose relevant document state, provide a concrete action, or be omitted.
- Protect browser-dependent timeline geometry, clipping, playhead placement, hit targets, and pointer capture with focused browser evidence.

## Domain and documentation

- This is a generic TypeScript/Rust timeline editor; keep application-specific behavior in extensions or consumers, not the core package.
- Record public API changes in `CHANGELOG.md` under `Unreleased` and update export-contract snapshots with exported API changes.
- `README.md` owns the project overview and the **Deeper Docs** links to existing API/architecture/serialization/extension/workbench contracts; consult only the relevant reference for the work at hand. Do not maintain a duplicate domain-context router or glossary.
- No local convention manifest or installed snapshot exists; apply the current shared coding-agent conventions.
