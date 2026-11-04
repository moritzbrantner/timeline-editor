import type { TimelineEditorDocument } from "../src/core";

// Shared by the hosted workbench and Storybook: edits must exercise the same document shapes.
export const denseDocument: TimelineEditorDocument = {
  durationMs: 10 * 60_000,
  currentTimeMs: 0,
  tracks: Array.from({ length: 80 }, (_, trackIndex) => ({
    id: `track-${trackIndex + 1}`,
    label: `Track ${trackIndex + 1}`,
    items: Array.from({ length: 40 }, (_, itemIndex) => ({
      id: `track-${trackIndex + 1}-item-${itemIndex + 1}`,
      trackId: `track-${trackIndex + 1}`,
      label: `Item ${trackIndex + 1}-${itemIndex + 1}`,
      startMs: itemIndex * 4_000,
      durationMs: 1_200,
      color: itemIndex % 2 === 0 ? "#2563eb" : "#15803d",
    })),
  })),
};

// Domain-neutral example of narrative, dialogue, animation and effects lanes.
export const storyAnimationDocument: TimelineEditorDocument = {
  durationMs: 20_000,
  currentTimeMs: 5_000,
  groups: [
    { id: "narrative", label: "Narrative", trackIds: ["scenes", "narration"] },
    { id: "animation", label: "Animation", trackIds: ["poses", "effects"] },
  ],
  markers: [{ id: "reveal", label: "Reveal", timeMs: 10_000 }],
  tracks: [
    {
      id: "scenes",
      label: "Scenes",
      kind: "scene",
      acceptsItemKinds: ["scene"],
      items: [
        {
          id: "opening",
          trackId: "scenes",
          label: "Opening scene",
          kind: "scene",
          startMs: 0,
          durationMs: 9_000,
          color: "#2563eb",
        },
        {
          id: "reveal-scene",
          trackId: "scenes",
          label: "Reveal scene",
          kind: "scene",
          startMs: 10_000,
          durationMs: 8_000,
          color: "#0e7490",
        },
      ],
    },
    {
      id: "narration",
      label: "Narration",
      kind: "dialogue",
      items: [
        {
          id: "voiceover",
          trackId: "narration",
          label: "The story begins",
          kind: "dialogue",
          startMs: 1_500,
          durationMs: 8_000,
          color: "#15803d",
        },
      ],
    },
    {
      id: "poses",
      label: "Character pose",
      kind: "animation",
      items: [
        {
          id: "gesture",
          trackId: "poses",
          label: "Wave and turn",
          kind: "animation",
          startMs: 2_000,
          durationMs: 9_000,
          color: "#7c3aed",
          transform: {
            points: [
              { offsetMs: 0, values: { rotation: 0 }, easing: "ease-in-out" },
              { offsetMs: 2_500, values: { rotation: 20 }, easing: "ease-out" },
              { offsetMs: 5_000, values: { rotation: -8 }, easing: "linear" },
              { offsetMs: 9_000, values: { rotation: 0 }, easing: "ease-in-out" },
            ],
          },
        },
      ],
    },
    {
      id: "effects",
      label: "Effects",
      kind: "effect",
      items: [
        {
          id: "fade",
          trackId: "effects",
          label: "Fade to reveal",
          kind: "effect",
          startMs: 8_000,
          durationMs: 4_000,
          color: "#92400e",
          transform: {
            points: [
              { offsetMs: 0, values: { opacity: 0 } },
              { offsetMs: 4_000, values: { opacity: 1 } },
            ],
          },
        },
      ],
    },
  ],
};
