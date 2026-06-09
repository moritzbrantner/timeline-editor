# Architecture-First Improvement Plan

## Purpose And Scope

This file is the canonical improvement roadmap for future work in this repository.
It turns the existing architecture documents into ordered implementation work, with
verification and acceptance checks attached to each stream.

The primary goal is architectural health: keep the root timeline editor generic,
keep optional domain and compute work in split packages, and make the workbench
easier to evolve without destabilizing public APIs.

## Current Findings

- `bun run verify:quick` previously reached the Playwright regression stage after
  unit, package, and Rust tests passed.
- The regression harness failed with an invalid React hook call from
  `@moritzbrantner/editor-core/dist/react.js`, which indicates duplicate React or
  mismatched source/package resolution in the Playwright Vite app.
- The Playwright harness is architecture-critical because it validates real
  workbench behavior. Its Vite aliases must resolve React, `editor-core`, and
  timeline-editor entrypoints consistently with the Vitest config.
- The intended layering is already documented in `docs/architecture.md`,
  `docs/extensions.md`, and `docs/release-readiness.md`; this file is the
  execution plan.

## Architecture Principles

- The root `@moritzbrantner/timeline-editor` package owns generic temporal
  editing: document types, pure operations, history, serialization, validation,
  React timeline primitives, and the generic workbench.
- Domain behavior enters through extensions, split packages, or host apps.
- Browser workers, WASM, Tauri, FFmpeg, codecs, proxy generation, export, and
  heavy processing do not belong in the root package.
- Root helpers must remain usable without accelerated compute backends.
- Public API changes require a changeset and an export contract update when
  runtime exports change.
- Workbench UI changes must follow `AGENTS.md`: do not add empty instructional
  panels, placeholder-only cards, or visual empty states that do not expose
  document state or a concrete action.

## Boundary Rules

- Root `src/*` code must not import `@timeline-editor/*` split packages.
- Split packages may depend on `@timeline-editor/compute`.
- Split packages may peer-depend on `@moritzbrantner/timeline-editor`.
- The root package can expose lightweight media foundations from root subpaths,
  but accelerated or domain-specific processing belongs in `packages/*`.
- `tests/package/export-contract.json` is the public runtime export source of
  truth. Update it only through `bun run update:export-contract`.
- Add a lightweight dependency-boundary check under `tests/package/` before any
  refactor that makes package boundaries harder to inspect manually.

## Ordered Workstreams

### 1. Restore Reliable Verification

Goal: make local and CI validation trustworthy before broader architecture work.

Tasks:

- Keep the Playwright Vite harness aliases aligned with `vitest.config.ts` for
  `react`, React JSX runtimes, `@moritzbrantner/editor-core/*`, and public
  timeline-editor subpaths.
- Run the targeted regression suite after alias changes:
  `bun run test:playwright src/react/workbench/workbench-basic-regressions.playwright.spec.ts`.
- Run `bun run verify:quick`.
- Treat harness resolution failures as architectural failures, not incidental
  test setup issues.

Acceptance:

- `bun run verify:quick` passes.
- The basic regression Playwright spec passes directly.
- No package export contract changes are introduced by verification fixes.

### 2. Codify Package Boundaries

Goal: convert documented architecture rules into enforceable checks.

The enforcement point is `tests/package/boundary.mjs`, which runs through
`bun run test:package`.

Tasks:

- Maintain the package-boundary script that scans root `src/**/*.{ts,tsx}` for
  `@timeline-editor/*` imports.
- Keep the check wired into `bun run test:package`.
- Keep package smoke tests focused on published package shape and runtime import
  safety.
- Extend export-contract snapshots only when public runtime exports intentionally
  change.

Acceptance:

- Boundary violations fail in CI.
- `bun run test:package` remains the source for package publication safety.
- Root package code remains independent of split packages.

### 3. Stabilize Extension Contracts

Goal: make extension matching and workbench extension APIs safe to evolve.

Current matching order in `src/extensions.ts`:

1. Exact `itemKinds`
2. Explicit `matchItem`
3. `domains`
4. Normalized `mediaTypes`

The extension matching contract is covered by focused tests in
`src/extensions.test.ts`, and user-facing reference docs mirror the same
priority order.

Tasks:

- Maintain focused tests for conflicting extension matches, especially when multiple
  extensions match the same item through different mechanisms.
- Keep `TimelineEditorExtension` backward-compatible unless a changeset records
  a public API change.
- Avoid moving media-specific behavior into core while adding extension
  features.

Acceptance:

- `src/extensions.test.ts` covers priority conflicts before any extension API
  refactor.
- Extension behavior is documented and tested before it is generalized.
- Core remains domain-neutral.

### 4. Reduce Workbench Coupling

Goal: make `TimelineWorkbench` easier to change while preserving behavior.

Tasks:

- Treat `src/react/workbench/implementation.tsx` as the main decomposition
  target.
- Extract only behaviorally coherent modules: import state, transport
  orchestration, command dispatch, extension resolution, and panel composition.
- Keep public `TimelineWorkbenchProps` stable during decomposition.
- Pair each extraction with focused unit coverage or a targeted Playwright spec.

Acceptance:

- `bun run test:unit` passes after each extraction.
- Affected Playwright specs pass after each extraction.
- No placeholder-only panels or empty instructional UI states are added.

### 5. Align Compute Backends

Goal: make browser worker, JS fallback, and Tauri compute behavior consistent.

Tasks:

- Document and test the shared task envelope from `packages/compute/src/index.ts`
  and `crates/timeline_compute/src/lib.rs`.
- Add contract coverage for TypeScript-to-Rust task serialization.
- Prioritize support parity for advertised domains: audio, video, image,
  captions, geo, and data.
- Keep root helpers functional when no accelerated backend supports a task.

Acceptance:

- `cargo test --workspace` passes.
- `bun run test:packages` passes.
- New compute task shapes have both TypeScript and Rust coverage.

## Public APIs And Interfaces

This plan file and Playwright harness alias fixes do not change public runtime
APIs.

Future public API changes must:

- Include a changeset.
- Preserve root package generic boundaries.
- Keep split packages experimental `0.x` unless intentionally promoted.
- Update `tests/package/export-contract.json` only through
  `bun run update:export-contract` when runtime exports change.

## Acceptance Checks

Use the smallest check set that covers the change:

- Harness or workbench regression changes:
  `bun run test:playwright src/react/workbench/workbench-basic-regressions.playwright.spec.ts`
- Normal local validation: `bun run verify:quick`
- Package/export changes: `bun run test:package`
- Public export changes:
  `bun run build:packages && bun run update:export-contract && bun run test:package`
- Release readiness: `bun run verify`

## Out Of Scope

- A large workbench rewrite.
- Moving media editor, map editor, subtitle editor, renderer, codec, or export
  behavior into the root package.
- Adding placeholder panels or empty cards to explain obvious UI behavior.
- Promoting split packages from `0.x` without an explicit release plan.

## Update Policy For Future Agents

- Read this file before planning architecture work.
- Keep this file concise and update it when a workstream is completed or a new
  architectural constraint becomes enforceable.
- Record concrete command results when they change the roadmap.
- Do not turn this file into a changelog; keep historical detail in commit
  messages, changesets, and docs.
