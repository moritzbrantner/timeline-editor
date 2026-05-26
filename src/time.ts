import {
  defaultTimelineEditorSnapThresholdPx,
  type TimelineEditorDocument,
  type TimelineEditorSnapOptions,
  type TimelineEditorTick,
  type TimelineEditorTrack,
} from "./types";

export function clampTimelineEditorTime(
  timeMs: number,
  minMs = 0,
  maxMs = Number.POSITIVE_INFINITY,
) {
  if (Number.isNaN(timeMs) || timeMs === Number.NEGATIVE_INFINITY) {
    return minMs;
  }

  if (timeMs === Number.POSITIVE_INFINITY) {
    return Number.isFinite(maxMs) ? maxMs : minMs;
  }

  return Math.min(Math.max(timeMs, minMs), maxMs);
}

export function snapTimelineEditorTime(timeMs: number, snapMs = 0) {
  if (!Number.isFinite(timeMs) || snapMs <= 0) {
    return timeMs;
  }

  return Math.round(timeMs / snapMs) * snapMs;
}

export function getTimelineEditorFrameDurationMs(frameRate?: number) {
  if (!Number.isFinite(frameRate) || frameRate === undefined || frameRate <= 0) {
    return undefined;
  }

  return 1_000 / frameRate;
}

export function getTimelineEditorItemEndMs(item: { durationMs: number; startMs: number }) {
  return item.startMs + item.durationMs;
}

export function formatTimelineEditorTimeMs(timeMs: number) {
  const safeTimeMs = Math.max(0, Math.round(timeMs));
  const totalSeconds = Math.floor(safeTimeMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safeTimeMs % 1_000) / 100);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function getTimelineEditorDurationMs<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>, fallbackMs = 60_000) {
  const itemEndMs = tracks.flatMap((track) => track.items.map(getTimelineEditorItemEndMs));
  return Math.max(fallbackMs, 1, ...itemEndMs);
}

export function getTimelineEditorTickIntervalMs(durationMs: number) {
  if (durationMs <= 10_000) {
    return 500;
  }

  if (durationMs <= 60_000) {
    return 1_000;
  }

  if (durationMs <= 5 * 60_000) {
    return 5_000;
  }

  return 30_000;
}

export function getTimelineEditorTicks(durationMs: number, intervalMs?: number) {
  const safeDurationMs = Math.max(0, durationMs);
  const stepMs = Math.max(1, intervalMs ?? getTimelineEditorTickIntervalMs(safeDurationMs));
  const ticks: TimelineEditorTick[] = [];

  for (let timeMs = 0; timeMs <= safeDurationMs + 0.0001; timeMs += stepMs) {
    ticks.push({
      timeMs,
      label: formatTimelineEditorTimeMs(timeMs),
      major: Math.round(timeMs / stepMs) % 5 === 0,
    });
  }

  return ticks;
}

export function createTimelineEditorSnapOptions(
  snapMs = 0,
  options: Partial<TimelineEditorSnapOptions> = {},
): TimelineEditorSnapOptions {
  return {
    enabled: options.enabled ?? snapMs > 0,
    thresholdPx: options.thresholdPx ?? defaultTimelineEditorSnapThresholdPx,
    targets: options.targets ?? (snapMs > 0 ? [{ type: "interval", intervalMs: snapMs }] : []),
  };
}

export function getTimelineEditorSnapTimes<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  snap: TimelineEditorSnapOptions,
) {
  const timesMs = new Set<number>();

  for (const target of snap.targets) {
    if (target.type === "interval") {
      const durationMs =
        document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 60_000);
      for (let timeMs = 0; timeMs <= durationMs; timeMs += target.intervalMs) {
        timesMs.add(timeMs);
      }
      continue;
    }

    if (target.type === "marker") {
      for (const marker of document.markers ?? []) {
        timesMs.add(marker.timeMs);
      }
      continue;
    }

    if (target.type === "item-edge") {
      for (const item of document.tracks.flatMap((track) => track.items)) {
        timesMs.add(item.startMs);
        timesMs.add(getTimelineEditorItemEndMs(item));
      }
      continue;
    }

    if (target.type === "playhead") {
      timesMs.add(document.currentTimeMs ?? 0);
      continue;
    }

    for (const timeMs of target.timesMs) {
      timesMs.add(timeMs);
    }
  }

  return [...timesMs].sort((left, right) => left - right);
}

export type TimelineEditorSnapResolverOptions = {
  excludeItemIds?: ReadonlySet<string> | readonly string[];
};

export function createTimelineEditorSnapResolver<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  snap: TimelineEditorSnapOptions,
  pixelsPerSecond: number,
  options: TimelineEditorSnapResolverOptions = {},
) {
  if (!snap.enabled) {
    return (timeMs: number) => ({ timeMs, snapped: false });
  }

  const excludedItemIds =
    options.excludeItemIds instanceof Set
      ? options.excludeItemIds
      : new Set(options.excludeItemIds ?? []);
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 60_000);
  const intervalTargets: number[] = [];
  const snapTimesMs = new Set<number>();

  for (const target of snap.targets) {
    if (target.type === "interval") {
      if (Number.isFinite(target.intervalMs) && target.intervalMs > 0) {
        intervalTargets.push(target.intervalMs);
      }
      continue;
    }

    if (target.type === "marker") {
      for (const marker of document.markers ?? []) {
        snapTimesMs.add(marker.timeMs);
      }
      continue;
    }

    if (target.type === "item-edge") {
      for (const track of document.tracks) {
        for (const item of track.items) {
          if (excludedItemIds.has(item.id)) {
            continue;
          }

          snapTimesMs.add(item.startMs);
          snapTimesMs.add(getTimelineEditorItemEndMs(item));
        }
      }
      continue;
    }

    if (target.type === "playhead") {
      snapTimesMs.add(document.currentTimeMs ?? 0);
      continue;
    }

    for (const timeMs of target.timesMs) {
      snapTimesMs.add(timeMs);
    }
  }

  const sortedSnapTimesMs = [...snapTimesMs].sort((left, right) => left - right);
  const thresholdMs = (snap.thresholdPx / Math.max(1, pixelsPerSecond)) * 1_000;

  return (timeMs: number) => {
    let bestTimeMs = timeMs;
    let bestDistanceMs = Number.POSITIVE_INFINITY;

    const checkCandidate = (candidateMs: number) => {
      const distanceMs = Math.abs(candidateMs - timeMs);
      if (
        distanceMs <= thresholdMs &&
        (distanceMs < bestDistanceMs || (distanceMs === bestDistanceMs && candidateMs < bestTimeMs))
      ) {
        bestTimeMs = candidateMs;
        bestDistanceMs = distanceMs;
      }
    };

    for (const intervalMs of intervalTargets) {
      const nearestIndex = Math.round(timeMs / intervalMs);

      for (const candidateIndex of [nearestIndex - 1, nearestIndex, nearestIndex + 1]) {
        const candidateMs = candidateIndex * intervalMs;

        if (candidateMs >= 0 && candidateMs <= durationMs) {
          checkCandidate(candidateMs);
        }
      }
    }

    const firstSnapTimeIndex = findTimelineEditorSnapTimeIndex(
      sortedSnapTimesMs,
      timeMs - thresholdMs,
    );

    for (
      let index = firstSnapTimeIndex;
      index < sortedSnapTimesMs.length && sortedSnapTimesMs[index]! <= timeMs + thresholdMs;
      index += 1
    ) {
      checkCandidate(sortedSnapTimesMs[index]!);
    }

    return {
      timeMs: bestTimeMs,
      snapped: bestTimeMs !== timeMs,
    };
  };
}

export function resolveTimelineEditorSnap<TTrackData, TItemData>(
  timeMs: number,
  document: TimelineEditorDocument<TTrackData, TItemData>,
  snap: TimelineEditorSnapOptions,
  pixelsPerSecond: number,
) {
  return createTimelineEditorSnapResolver(document, snap, pixelsPerSecond)(timeMs);
}

function findTimelineEditorSnapTimeIndex(timesMs: number[], targetMs: number) {
  let low = 0;
  let high = timesMs.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (timesMs[middle]! < targetMs) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}
