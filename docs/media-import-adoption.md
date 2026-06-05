# Media Import Adoption

Timeline media import is host-owned. `TimelineWorkbench` collects selected
files, URLs, or references and passes them to `onImportAssets`; the host decides
which resolver, storage, and cleanup lifetime to use.

## Root Package Path

Use the root package path when a host needs lightweight audio, video, image, or
URL/reference import helpers without worker or native processing:

```tsx
import {
  TimelineWorkbench,
  createTimelineMediaImportResolver,
  createTimelineMediaSourceLibrary,
} from "@moritzbrantner/timeline-editor";

const sourceLibrary = createTimelineMediaSourceLibrary();
const importAssets = createTimelineMediaImportResolver({
  sourceLibrary,
  defaultImageDurationMs: 2_000,
  videoThumbnailCount: 4,
});

<TimelineWorkbench onImportAssets={importAssets} allowUrlImport />;
```

The resolver accepts file, URL, and reference import sources. File imports create
object URLs for supported audio, video, and image files. URL and reference
imports create source-backed assets when media type, label, and duration can be
resolved from the source or metadata.

Keep one `TimelineMediaSourceLibrary` per editing session and call
`sourceLibrary.dispose()` when the session is destroyed. Returned cleanup
callbacks are also accepted by `TimelineWorkbenchImportResult`, so imports owned
by the workbench are revoked on unmount.

The same resolver is available from a dedicated subpath for hosts that prefer
smaller import surfaces:

```ts
import { createTimelineMediaImportResolver } from "@moritzbrantner/timeline-editor/media-import";
```

## Split Package Path

Use split packages when imports need optional browser-worker, WASM, or
Tauri-backed analysis:

- `@timeline-editor/compute` provides the shared backend contract, browser
  worker backend, adaptive backend selection, and Tauri adapter.
- `@timeline-editor/audio`, `@timeline-editor/video`, and
  `@timeline-editor/image` wrap the root helpers with backend-aware analysis.
- `@timeline-editor/captions`, `@timeline-editor/geo`, and
  `@timeline-editor/data` provide domain-specific parsing or analysis helpers.
- `@timeline-editor/tauri` adapts the shared compute task contract to Tauri
  invoke calls.

```ts
import { createTimelineAdaptiveBackend } from "@timeline-editor/compute";
import { createTimelineTauriBackend } from "@timeline-editor/tauri";
import {
  createTimelineVideoBrowserBackend,
  createTimelineVideoFileAsset,
} from "@timeline-editor/video";

const backend = createTimelineAdaptiveBackend({
  tauri: isTauri ? createTimelineTauriBackend({ invoke }) : undefined,
  browserWasm: createTimelineVideoBrowserBackend(),
});

const result = await createTimelineVideoFileAsset(file, {
  backend,
  thumbnailCount: 4,
});
```

When no backend supports a task, split packages fall back to the lightweight root
behavior or return typed warnings with the import result. Hosts should surface
warnings through the workbench import context and keep unsupported files
recoverable per source.

## Support Matrix

| Area           | Supported here                                                                                              | Out of scope                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Root package   | Text, audio, video, image, and numeric-data foundations; lightweight file, URL, and reference media imports | Rendering/export pipelines, proxies, effects, transitions, codecs  |
| Split packages | Backend-capable wrappers for audio, video, image, captions, geo, data, compute, and Tauri integration       | Product-specific media project models and long render workflows    |
| Host app       | Source storage, persistence, import policy, cleanup lifetime, and user-facing recovery                      | Generic timeline document operations already owned by this package |
