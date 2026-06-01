export type TimelineComputeSource =
  | { type: "bytes"; bytes: ArrayBuffer; label?: string; mimeType?: string }
  | { type: "url"; url: string; label?: string; mimeType?: string }
  | { type: "path"; path: string; label?: string; mimeType?: string };

export type TimelineComputeProgress = {
  phase: string;
  completed?: number;
  total?: number;
  message?: string;
};

export type TimelineComputeRunOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: TimelineComputeProgress) => void;
};

export type TimelineComputeErrorCode =
  | "backend_unavailable"
  | "unsupported_source"
  | "unsupported_codec"
  | "decode_failed"
  | "parse_failed"
  | "cancelled"
  | "timeout"
  | "internal_error";

export type TimelineComputeError = {
  code: TimelineComputeErrorCode;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
};

export type TimelineComputeBackendKind = "browser-wasm" | "tauri" | "js-fallback";

export type TimelineComputeBackend = {
  id: string;
  kind: TimelineComputeBackendKind;
  supports(task: TimelineComputeTask): boolean;
  run<TResult>(task: TimelineComputeTask, options?: TimelineComputeRunOptions): Promise<TResult>;
  dispose(): void;
};

export type TimelineAudioComputeTask = {
  domain: "audio";
  operation: "analyze";
  source: TimelineComputeSource;
  options?: {
    sampleCount?: number;
    normalize?: boolean;
  };
};

export type TimelineVideoComputeTask = {
  domain: "video";
  operation: "analyze";
  source: TimelineComputeSource;
  options?: {
    generatePoster?: boolean;
    generateThumbnails?: boolean;
    posterTimeMs?: number;
    thumbnailCount?: number;
    thumbnailTimesMs?: number[];
    thumbnailMimeType?: string;
    thumbnailQuality?: number;
  };
};

export type TimelineImageComputeTask = {
  domain: "image";
  operation: "analyze";
  source: TimelineComputeSource;
  options?: {
    generateThumbnail?: boolean;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    thumbnailMimeType?: string;
    thumbnailQuality?: number;
  };
};

export type TimelineCaptionsComputeTask = {
  domain: "captions";
  operation: "parse";
  source?: TimelineComputeSource;
  input?: string;
  options?: {
    format?: string;
    sourceLabel?: string;
    mimeType?: string;
  };
};

export type TimelineGeoComputeTask = {
  domain: "geo";
  operation: "analyze";
  source?: TimelineComputeSource;
  geojson?: unknown;
  options?: {
    simplifyTolerance?: number;
  };
};

export type TimelineDataComputeTask = {
  domain: "data";
  operation: "analyze" | "downsample";
  series?: Array<{
    id?: string;
    label?: string;
    unit?: string;
    color?: string;
    points: Array<{ timeMs: number; value: number }>;
  }>;
  options?: {
    maxPoints?: number;
    startMs?: number;
    endMs?: number;
  };
};

export type TimelineComputeTask =
  | TimelineAudioComputeTask
  | TimelineVideoComputeTask
  | TimelineImageComputeTask
  | TimelineCaptionsComputeTask
  | TimelineGeoComputeTask
  | TimelineDataComputeTask;

export type TimelineWorkerRequest =
  | { id: string; type: "init" }
  | { id: string; type: "run"; task: TimelineComputeTask }
  | { id: string; type: "cancel" }
  | { id: string; type: "dispose" };

export type TimelineWorkerResponse =
  | { id: string; type: "ready" }
  | { id: string; type: "progress"; progress: TimelineComputeProgress }
  | { id: string; type: "result"; result: unknown }
  | { id: string; type: "error"; error: TimelineComputeError };

export type TimelineComputeTaskProcessor = (
  task: TimelineComputeTask,
  context: {
    signal?: AbortSignal;
    onProgress: (progress: TimelineComputeProgress) => void;
  },
) => Promise<unknown> | unknown;

type PendingWorkerRequest = {
  reject: (error: unknown) => void;
  resolve: (result: unknown) => void;
  onProgress?: (progress: TimelineComputeProgress) => void;
  timeout?: ReturnType<typeof globalThis.setTimeout>;
};

type TimelineWorkerScope = {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<TimelineWorkerRequest>) => void,
  ) => void;
  close: () => void;
  postMessage: (message: TimelineWorkerResponse, transfer?: Transferable[]) => void;
};

let nextTimelineComputeRequestId = 0;

export function createTimelineBrowserWasmBackend(options: {
  worker: Worker | (() => Worker);
  timeoutMs?: number;
}): TimelineComputeBackend {
  const pending = new Map<string, PendingWorkerRequest>();
  let worker: Worker | undefined;
  let disposed = false;

  const getWorker = () => {
    if (disposed) {
      throw createTimelineComputeError({
        code: "backend_unavailable",
        message: "Timeline compute worker has been disposed.",
        recoverable: true,
      });
    }

    if (!worker) {
      worker = typeof options.worker === "function" ? options.worker() : options.worker;
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleWorkerError);
    }

    return worker;
  };

  const settle = (id: string, callback: (request: PendingWorkerRequest) => void) => {
    const request = pending.get(id);

    if (!request) {
      return;
    }

    pending.delete(id);

    if (request.timeout) {
      globalThis.clearTimeout(request.timeout);
    }

    callback(request);
  };

  const rejectAll = (error: unknown) => {
    for (const [id] of pending) {
      settle(id, (request) => request.reject(error));
    }
  };

  function handleMessage(event: MessageEvent<TimelineWorkerResponse>) {
    const message = event.data;

    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "progress") {
      pending.get(message.id)?.onProgress?.(message.progress);
      return;
    }

    if (message.type === "result") {
      settle(message.id, (request) => request.resolve(message.result));
      return;
    }

    if (message.type === "error") {
      settle(message.id, (request) => request.reject(message.error));
    }
  }

  function handleWorkerError() {
    rejectAll(
      createTimelineComputeError({
        code: "internal_error",
        message: "Timeline compute worker failed.",
        recoverable: true,
      }),
    );
  }

  return {
    id: "timeline-browser-wasm",
    kind: "browser-wasm",
    supports: () =>
      typeof Worker !== "undefined" && typeof WebAssembly !== "undefined" && !disposed,
    run<TResult>(task: TimelineComputeTask, runOptions: TimelineComputeRunOptions = {}) {
      const activeWorker = getWorker();
      const id = createTimelineComputeRequestId();

      if (runOptions.signal?.aborted) {
        return Promise.reject(createTimelineCancelledError());
      }

      return new Promise<TResult>((resolve, reject) => {
        const timeout =
          options.timeoutMs && options.timeoutMs > 0
            ? globalThis.setTimeout(() => {
                activeWorker.postMessage(
                  { id, type: "cancel" } satisfies TimelineWorkerRequest,
                  [],
                );
                settle(id, (request) =>
                  request.reject(
                    createTimelineComputeError({
                      code: "timeout",
                      message: "Timeline compute task timed out.",
                      recoverable: true,
                    }),
                  ),
                );
              }, options.timeoutMs)
            : undefined;

        const abort = () => {
          activeWorker.postMessage({ id, type: "cancel" } satisfies TimelineWorkerRequest, []);
          settle(id, (request) => request.reject(createTimelineCancelledError()));
        };

        pending.set(id, {
          resolve: (result) => resolve(result as TResult),
          reject,
          onProgress: runOptions.onProgress,
          timeout,
        });
        runOptions.signal?.addEventListener("abort", abort, { once: true });

        try {
          activeWorker.postMessage(
            { id, type: "run", task } satisfies TimelineWorkerRequest,
            getTimelineComputeTransferables(task),
          );
        } catch (error) {
          settle(id, (request) => request.reject(normalizeTimelineComputeError(error)));
        }
      });
    },
    dispose() {
      disposed = true;
      rejectAll(
        createTimelineComputeError({
          code: "backend_unavailable",
          message: "Timeline compute backend was disposed.",
          recoverable: true,
        }),
      );
      if (worker) {
        worker.postMessage({ id: createTimelineComputeRequestId(), type: "dispose" }, []);
        worker.terminate();
        worker = undefined;
      }
    },
  };
}

export function createTimelineTauriBackend(options: {
  invoke: <T>(command: string, payload: unknown) => Promise<T>;
  command?: string;
}): TimelineComputeBackend {
  const command = options.command ?? "timeline_editor_process";
  let disposed = false;

  return {
    id: "timeline-tauri",
    kind: "tauri",
    supports: () => !disposed,
    async run<TResult>(task: TimelineComputeTask, runOptions: TimelineComputeRunOptions = {}) {
      if (disposed) {
        throw createTimelineComputeError({
          code: "backend_unavailable",
          message: "Timeline Tauri backend has been disposed.",
          recoverable: true,
        });
      }

      if (runOptions.signal?.aborted) {
        throw createTimelineCancelledError();
      }

      runOptions.onProgress?.({ phase: "dispatch" });
      const response = await options
        .invoke<{ result?: TResult; warnings?: string[]; error?: TimelineComputeError }>(command, {
          task,
        })
        .catch((error) => {
          throw normalizeTimelineComputeError(error);
        });

      if (runOptions.signal?.aborted) {
        throw createTimelineCancelledError();
      }

      if (response.error) {
        throw response.error;
      }

      runOptions.onProgress?.({ phase: "complete", completed: 1, total: 1 });
      return response.result as TResult;
    },
    dispose() {
      disposed = true;
    },
  };
}

export function createTimelineAdaptiveBackend(options: {
  tauri?: TimelineComputeBackend;
  browserWasm?: TimelineComputeBackend;
  fallback?: TimelineComputeBackend;
}): TimelineComputeBackend {
  const backends = [options.tauri, options.browserWasm, options.fallback].filter(
    (backend): backend is TimelineComputeBackend => Boolean(backend),
  );
  let disposed = false;

  return {
    id: "timeline-adaptive",
    kind:
      options.tauri?.kind ?? options.browserWasm?.kind ?? options.fallback?.kind ?? "js-fallback",
    supports(task) {
      return !disposed && backends.some((backend) => backend.supports(task));
    },
    async run<TResult>(task: TimelineComputeTask, runOptions?: TimelineComputeRunOptions) {
      if (disposed) {
        throw createTimelineComputeError({
          code: "backend_unavailable",
          message: "Timeline adaptive backend has been disposed.",
          recoverable: true,
        });
      }

      const candidates = backends.filter((backend) => backend.supports(task));
      let lastError: unknown;

      for (const backend of candidates) {
        try {
          // Backends are intentionally tried in priority order.
          // eslint-disable-next-line no-await-in-loop
          return await backend.run<TResult>(task, runOptions);
        } catch (error) {
          lastError = error;
          const normalized = normalizeTimelineComputeError(error);

          if (!normalized.recoverable || normalized.code === "cancelled") {
            throw normalized;
          }
        }
      }

      throw (
        lastError ??
        createTimelineComputeError({
          code: "backend_unavailable",
          message: `No timeline compute backend supports ${task.domain}:${task.operation}.`,
          recoverable: true,
        })
      );
    },
    dispose() {
      disposed = true;
      for (const backend of backends) {
        backend.dispose();
      }
    },
  };
}

export function createTimelineJsFallbackBackend(options: {
  id?: string;
  supports?: (task: TimelineComputeTask) => boolean;
  run: TimelineComputeTaskProcessor;
}): TimelineComputeBackend {
  let disposed = false;

  return {
    id: options.id ?? "timeline-js-fallback",
    kind: "js-fallback",
    supports(task) {
      return !disposed && (options.supports?.(task) ?? true);
    },
    async run<TResult>(task: TimelineComputeTask, runOptions: TimelineComputeRunOptions = {}) {
      if (disposed) {
        throw createTimelineComputeError({
          code: "backend_unavailable",
          message: "Timeline JS fallback backend has been disposed.",
          recoverable: true,
        });
      }

      if (runOptions.signal?.aborted) {
        throw createTimelineCancelledError();
      }

      return options.run(task, {
        signal: runOptions.signal,
        onProgress: runOptions.onProgress ?? (() => undefined),
      }) as Promise<TResult>;
    },
    dispose() {
      disposed = true;
    },
  };
}

export function createTimelineComputeError(error: TimelineComputeError): TimelineComputeError {
  return error;
}

export function normalizeTimelineComputeError(error: unknown): TimelineComputeError {
  if (isTimelineComputeError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: "internal_error",
      message: error.message,
      recoverable: true,
    };
  }

  return {
    code: "internal_error",
    message: "Timeline compute task failed.",
    recoverable: true,
    details: { error },
  };
}

export function isTimelineComputeError(error: unknown): error is TimelineComputeError {
  return (
    Boolean(error) &&
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    "recoverable" in error
  );
}

export function createTimelineWorkerHandler(options: {
  process: TimelineComputeTaskProcessor;
  scope?: TimelineWorkerScope;
}) {
  const scope = options.scope ?? (globalThis as unknown as TimelineWorkerScope);
  const controllers = new Map<string, AbortController>();

  scope.addEventListener("message", (event: MessageEvent<TimelineWorkerRequest>) => {
    const message = event.data;

    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "init") {
      scope.postMessage({ id: message.id, type: "ready" } satisfies TimelineWorkerResponse, []);
      return;
    }

    if (message.type === "cancel") {
      controllers.get(message.id)?.abort();
      return;
    }

    if (message.type === "dispose") {
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
      scope.close();
      return;
    }

    const controller = new AbortController();
    controllers.set(message.id, controller);

    Promise.resolve(
      options.process(message.task, {
        signal: controller.signal,
        onProgress(progress) {
          scope.postMessage(
            {
              id: message.id,
              type: "progress",
              progress,
            } satisfies TimelineWorkerResponse,
            [],
          );
        },
      }),
    )
      .then((result) => {
        scope.postMessage(
          {
            id: message.id,
            type: "result",
            result,
          } satisfies TimelineWorkerResponse,
          [],
        );
      })
      .catch((error) => {
        scope.postMessage(
          {
            id: message.id,
            type: "error",
            error: normalizeTimelineComputeError(error),
          } satisfies TimelineWorkerResponse,
          [],
        );
      })
      .finally(() => {
        controllers.delete(message.id);
      });
  });
}

function createTimelineComputeRequestId() {
  nextTimelineComputeRequestId += 1;
  return `timeline-compute-${Date.now()}-${nextTimelineComputeRequestId}`;
}

function createTimelineCancelledError(): TimelineComputeError {
  return {
    code: "cancelled",
    message: "Timeline compute task was cancelled.",
    recoverable: false,
  };
}

function getTimelineComputeTransferables(task: TimelineComputeTask): Transferable[] {
  const source = "source" in task ? task.source : undefined;

  return source?.type === "bytes" ? [source.bytes] : [];
}
