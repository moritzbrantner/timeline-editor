import { describe, expect, test } from "vitest";

import {
  findTimelineEditorExtensionForItem,
  getTimelineEditorDomainForItem,
  getTimelineEditorItemDataDomain,
  doesTimelineEditorExtensionMatchItem,
  type TimelineEditorExtension,
} from "@moritzbrantner/timeline-editor";
import {
  moveTimelineEditorItem,
  resizeTimelineEditorItem,
  splitTimelineEditorItem,
  type TimelineEditorDocument,
  type TimelineEditorTrack,
} from "@moritzbrantner/timeline-editor/core";
import {
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
} from "@moritzbrantner/timeline-editor";

type DomainItemData =
  | {
      domain: "map";
      geojson?: unknown;
      layerId?: string;
      camera?: { center?: [number, number]; zoom?: number };
    }
  | {
      domain: "story";
      storyElementType: "scene" | "beat" | "chapter";
      storyId?: string;
      text?: string;
    }
  | {
      domain: "subtitle";
      mediaType: "text";
      format?: "srt" | "vtt" | "ass" | "ssa" | "unknown";
      text: string;
    }
  | {
      domain: "media";
      mediaType: "video" | "audio" | "image" | "text" | "numeric-data";
      assetId: string;
      codecHint?: string;
    };

describe("timeline editor domain extension boundaries", () => {
  test.each([
    {
      domain: "map",
      item: {
        id: "map-item",
        trackId: "track-a",
        label: "Map item",
        kind: "map-layer",
        startMs: 1_000,
        durationMs: 3_000,
        data: {
          domain: "map",
          geojson: { type: "FeatureCollection", features: [{ id: "route" }] },
          layerId: "route",
          camera: { center: [13.405, 52.52] as [number, number], zoom: 11 },
        },
      },
    },
    {
      domain: "story",
      item: {
        id: "story-item",
        trackId: "track-a",
        label: "Story item",
        kind: "story-scene",
        startMs: 1_000,
        durationMs: 3_000,
        data: {
          domain: "story",
          storyElementType: "scene",
          storyId: "story-1",
          text: "Opening beat",
        },
      },
    },
    {
      domain: "subtitle",
      item: {
        id: "subtitle-item",
        trackId: "track-a",
        label: "Subtitle item",
        kind: "subtitle",
        startMs: 1_000,
        durationMs: 3_000,
        data: {
          domain: "subtitle",
          mediaType: "text",
          format: "srt",
          text: "Hello timeline",
        },
      },
    },
    {
      domain: "media",
      item: {
        id: "media-item",
        trackId: "track-a",
        label: "Media item",
        kind: "media-clip",
        startMs: 1_000,
        durationMs: 3_000,
        data: {
          domain: "media",
          mediaType: "video",
          assetId: "asset-video",
          codecHint: "h264",
        },
      },
    },
  ] satisfies Array<{
    domain: string;
    item: TimelineEditorTrack<Record<string, unknown>, DomainItemData>["items"][number];
  }>)("moves, resizes, and splits $domain items as generic timed items", ({ item }) => {
    const tracks: Array<TimelineEditorTrack<Record<string, unknown>, DomainItemData>> = [
      { id: "track-a", label: "Track A", acceptsItemKinds: [item.kind!], items: [item] },
      { id: "track-b", label: "Track B", acceptsItemKinds: [item.kind!], items: [] },
    ];

    const moved = moveTimelineEditorItem(
      tracks,
      { itemId: item.id, startMs: 2_000, trackId: "track-b" },
      { durationMs: 10_000 },
    );
    const movedItem = moved[1]?.items[0];
    expect(movedItem).toEqual(expect.objectContaining({ id: item.id, startMs: 2_000 }));
    expect(movedItem?.data).toEqual(item.data);

    const resized = resizeTimelineEditorItem(moved, {
      itemId: item.id,
      edge: "end",
      durationMs: 4_000,
    });
    expect(resized[1]?.items[0]).toEqual(expect.objectContaining({ durationMs: 4_000 }));
    expect(resized[1]?.items[0]?.data).toEqual(item.data);

    const split = splitTimelineEditorItem(resized, { itemId: item.id, timeMs: 4_000 });
    expect(split[1]?.items).toHaveLength(2);
    expect(split[1]?.items[0]?.data).toEqual(item.data);
    expect(split[1]?.items[1]?.data).toEqual(item.data);
  });

  test("serialization round-trips unknown domain data", () => {
    const document: TimelineEditorDocument<Record<string, unknown>, DomainItemData> = {
      durationMs: 6_000,
      tracks: [
        {
          id: "domains",
          label: "Domains",
          items: [
            {
              id: "map",
              trackId: "domains",
              label: "Map",
              kind: "map-layer",
              startMs: 0,
              durationMs: 1_000,
              data: {
                domain: "map",
                geojson: { type: "Feature", properties: { route: "north" } },
                layerId: "route-north",
              },
            },
            {
              id: "media",
              trackId: "domains",
              label: "Media",
              kind: "media-clip",
              startMs: 1_000,
              durationMs: 2_000,
              data: {
                domain: "media",
                mediaType: "video",
                assetId: "asset-1",
                codecHint: "av1",
              },
            },
          ],
        },
      ],
    };

    const parsed = parseTimelineEditorDocument(
      serializeTimelineEditorDocument(document),
    ) as TimelineEditorDocument<Record<string, unknown>, DomainItemData>;

    expect(parsed.tracks[0]?.items.map((item) => item.data)).toEqual(
      document.tracks[0]?.items.map((item) => item.data),
    );
  });

  test("matches extensions by kind, matchItem, domain, then media type", () => {
    const extensions: Array<TimelineEditorExtension> = [
      {
        id: "media-text",
        mediaTypes: ["text"],
      },
      {
        id: "map-domain",
        domains: ["map"],
      },
      {
        id: "predicate",
        matchItem: (item) => item.label === "Predicate item",
      },
      {
        id: "exact-kind",
        itemKinds: ["map-layer"],
      },
    ];
    const item = {
      id: "route",
      trackId: "map",
      label: "Route",
      kind: "map-layer",
      startMs: 0,
      durationMs: 1_000,
      data: { domain: "map", mediaType: "text" },
    };

    expect(getTimelineEditorItemDataDomain(item.data)).toBe("map");
    expect(getTimelineEditorDomainForItem(item)).toBe("map");
    expect(doesTimelineEditorExtensionMatchItem(extensions[1]!, item)).toBe(true);
    expect(findTimelineEditorExtensionForItem(item, extensions)?.id).toBe("exact-kind");
    expect(
      findTimelineEditorExtensionForItem(
        { ...item, kind: undefined, label: "Predicate item" },
        extensions,
      )?.id,
    ).toBe("predicate");
    expect(
      findTimelineEditorExtensionForItem({ ...item, kind: undefined, label: "Route" }, extensions)
        ?.id,
    ).toBe("map-domain");
    expect(
      findTimelineEditorExtensionForItem(
        { ...item, kind: undefined, data: { mediaType: "text" } },
        extensions,
      )?.id,
    ).toBe("media-text");
    expect(
      findTimelineEditorExtensionForItem(item, extensions, {
        predicate: (extension) => extension.id !== "exact-kind",
      })?.id,
    ).toBe("map-domain");
  });

  describe("timeline editor extension matching contract", () => {
    const conflictingItem = {
      id: "route",
      trackId: "track",
      label: "Predicate item",
      kind: "map-layer",
      startMs: 0,
      durationMs: 1_000,
      data: { domain: "map", mediaType: "text" },
    };

    test("resolves by priority before registration order", () => {
      const extensions: Array<TimelineEditorExtension> = [
        {
          id: "media",
          mediaTypes: ["text"],
        },
        {
          id: "domain",
          domains: ["map"],
        },
        {
          id: "predicate",
          matchItem: () => true,
        },
        {
          id: "kind",
          itemKinds: ["map-layer"],
        },
      ];

      expect(findTimelineEditorExtensionForItem(conflictingItem, extensions)?.id).toBe("kind");
    });

    test("resolves matchItem before domains and mediaTypes when no itemKinds match", () => {
      const extensions: Array<TimelineEditorExtension> = [
        {
          id: "media",
          mediaTypes: ["text"],
        },
        {
          id: "domain",
          domains: ["map"],
        },
        {
          id: "predicate",
          matchItem: (item) => item.label === "Predicate item",
        },
      ];

      expect(
        findTimelineEditorExtensionForItem(
          {
            ...conflictingItem,
            kind: "unclaimed-kind",
          },
          extensions,
        )?.id,
      ).toBe("predicate");
    });

    test("resolves domains before mediaTypes when no itemKinds or matchItem match", () => {
      const extensions: Array<TimelineEditorExtension> = [
        {
          id: "media",
          mediaTypes: ["text"],
        },
        {
          id: "domain",
          domains: ["map"],
        },
      ];

      expect(
        findTimelineEditorExtensionForItem(
          {
            ...conflictingItem,
            kind: "unclaimed-kind",
          },
          extensions,
        )?.id,
      ).toBe("domain");
    });

    const samePriorityCases: Array<{
      name: string;
      extensions: Array<TimelineEditorExtension>;
      item?: typeof conflictingItem;
    }> = [
      {
        name: "itemKinds",
        extensions: [
          { id: "first", itemKinds: ["map-layer"] },
          { id: "second", itemKinds: ["map-layer"] },
        ],
      },
      {
        name: "matchItem",
        extensions: [
          { id: "first", matchItem: () => true },
          { id: "second", matchItem: () => true },
        ],
        item: {
          ...conflictingItem,
          kind: "unclaimed-kind",
          data: { domain: "unclaimed-domain", mediaType: "text" },
        },
      },
      {
        name: "domains",
        extensions: [
          { id: "first", domains: ["map"] },
          { id: "second", domains: ["map"] },
        ],
      },
      {
        name: "mediaTypes",
        extensions: [
          { id: "first", mediaTypes: ["text"] },
          { id: "second", mediaTypes: ["text"] },
        ],
        item: {
          ...conflictingItem,
          kind: "unclaimed-kind",
          data: { domain: "unclaimed-domain", mediaType: "text" },
        },
      },
    ];

    test.each(samePriorityCases)(
      "resolves same-priority $name matches by registration order",
      ({ extensions, item = conflictingItem }) => {
        expect(findTimelineEditorExtensionForItem(item, extensions)?.id).toBe("first");
      },
    );

    test("filters candidates before resolving priority", () => {
      const extensions: Array<TimelineEditorExtension> = [
        {
          id: "kind",
          itemKinds: ["map-layer"],
        },
        {
          id: "domain",
          domains: ["map"],
        },
        {
          id: "media",
          mediaTypes: ["text"],
        },
      ];

      expect(
        findTimelineEditorExtensionForItem(conflictingItem, extensions, {
          predicate: (extension) => extension.id !== "kind",
        })?.id,
      ).toBe("domain");
    });
  });
});
