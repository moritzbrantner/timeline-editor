import { useEffect, useRef, useState } from "react";

import type { TimelineEditorTrack } from "../../types";

type TimelineEditorPendingPreview<TTrackData, TItemData> = {
  snapGuideMs: number | null;
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>> | null;
};

export function useTimelineEditorPreview<TTrackData, TItemData>() {
  const previewTracksRef = useRef<Array<TimelineEditorTrack<TTrackData, TItemData>> | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef<TimelineEditorPendingPreview<TTrackData, TItemData> | null>(
    null,
  );
  const [previewTracks, setPreviewTracks] = useState<Array<
    TimelineEditorTrack<TTrackData, TItemData>
  > | null>(null);
  const [snapGuideMs, setSnapGuideMs] = useState<number | null>(null);

  const updatePreviewTracks = (
    nextTracks: Array<TimelineEditorTrack<TTrackData, TItemData>> | null,
  ) => {
    previewTracksRef.current = nextTracks;
    setPreviewTracks(nextTracks);
  };

  const cancelScheduledPreview = () => {
    if (previewFrameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(previewFrameRef.current);
    }

    previewFrameRef.current = null;
    pendingPreviewRef.current = null;
  };

  const flushScheduledPreview = () => {
    const pendingPreview = pendingPreviewRef.current;

    if (!pendingPreview) {
      return previewTracksRef.current;
    }

    cancelScheduledPreview();
    setSnapGuideMs(pendingPreview.snapGuideMs);
    updatePreviewTracks(pendingPreview.tracks);

    return pendingPreview.tracks;
  };

  const schedulePreviewUpdate = (
    tracks: Array<TimelineEditorTrack<TTrackData, TItemData>> | null,
    nextSnapGuideMs: number | null,
  ) => {
    pendingPreviewRef.current = { snapGuideMs: nextSnapGuideMs, tracks };

    if (typeof window === "undefined") {
      flushScheduledPreview();
      return;
    }

    if (previewFrameRef.current !== null) {
      return;
    }

    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null;
      const pendingPreview = pendingPreviewRef.current;
      pendingPreviewRef.current = null;

      if (!pendingPreview) {
        return;
      }

      setSnapGuideMs(pendingPreview.snapGuideMs);
      updatePreviewTracks(pendingPreview.tracks);
    });
  };

  const clearPreview = () => {
    setSnapGuideMs(null);
    updatePreviewTracks(null);
  };

  useEffect(
    () => () => {
      cancelScheduledPreview();
    },
    [],
  );

  return {
    cancelScheduledPreview,
    clearPreview,
    flushScheduledPreview,
    previewTracks,
    schedulePreviewUpdate,
    snapGuideMs,
  };
}
