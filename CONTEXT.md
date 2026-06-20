# Repository Context

This repository is a TypeScript and Rust timeline editor library/workbench. Keep the core package generic and keep domain-specific behavior in extensions or application layers.

## Boundaries

- Keep the root package generic.
- Do not add domain-specific behavior to core.
- Do not add empty instructional panels or placeholder-only UI states.
- Add changesets for public package changes.
- Keep public exports reflected in export contract snapshots.

## Reference Docs

Read the docs that match the task before changing behavior:

- `docs/architecture.md` for the repository architecture.
- `docs/core.md` for core timeline model behavior.
- `docs/extensions.md` for extension mechanics.
- `docs/domain-extensions.md` for domain-specific extension guidance.
- `docs/serialization.md` for document serialization behavior.
- `docs/compute-contract.md` for compute package contracts.
- `docs/workbench.md` for workbench UI behavior.
- `docs/reference.md` for API reference details.
