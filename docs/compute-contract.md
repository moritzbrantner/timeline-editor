# Compute Contract

`@timeline-editor/compute` defines the shared task contract used by browser
workers, JavaScript fallback backends, and the Tauri invoke adapter. Backends
receive tasks through this envelope:

```ts
{
  task: TimelineComputeTask;
}
```

The advertised task domains are:

- `audio:analyze`
- `video:analyze`
- `image:analyze`
- `captions:parse`
- `geo:analyze`
- `data:analyze`
- `data:downsample`

Task sources use one of these shapes:

```ts
{ type: "bytes"; bytes: ArrayBuffer; label?: string; mimeType?: string }
{ type: "url"; url: string; label?: string; mimeType?: string }
{ type: "path"; path: string; label?: string; mimeType?: string }
```

The wire field names are the TypeScript names: `mimeType` for source MIME type
metadata and `timeMs` for time-series points.

Backends return:

```ts
{
  result?: unknown;
  warnings?: string[];
  error?: TimelineComputeError;
}
```

Unsupported tasks are valid contract traffic. A backend must deserialize the
task successfully, then return a recoverable `TimelineComputeError`; unsupported
tasks are not task-envelope contract failures.

The current Tauri implementation returns a result for `geo:analyze`. Other
advertised domains may return recoverable unsupported errors until native
support is implemented.
