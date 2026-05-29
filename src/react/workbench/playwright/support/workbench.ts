import { expect, type Locator, type Page } from "@playwright/test";

export type TimelineEditorHarnessState = {
  changes: string[];
  document: {
    currentTimeMs?: number;
    markers?: Array<{
      color?: string;
      id: string;
      label: string;
      timeMs: number;
    }>;
    itemGroups?: Array<{
      id: string;
      itemIds: string[];
      label: string;
    }>;
    groups?: Array<{
      id: string;
      label: string;
      trackIds: string[];
      collapsed?: boolean;
      locked?: boolean;
    }>;
    tracks: Array<{
      id: string;
      items: Array<TimelineEditorHarnessItem>;
    }>;
  };
  imports: Array<{
    fileName?: string;
    label?: string;
    mimeType?: string;
    size?: number;
    type: string;
  }>;
  selectedItemId: string | null;
  selectedItemIds: string[];
  range?: { startMs: number; endMs: number };
  frameRate?: number;
  transport?: {
    status: "paused" | "playing";
    playbackRate: -4 | -2 | -1 | 1 | 2 | 4;
    loop: boolean;
  };
  transportChanges: Array<{
    reason:
      | "play"
      | "pause"
      | "toggle-play"
      | "stop"
      | "shuttle-forward"
      | "shuttle-backward"
      | "loop-toggle"
      | "ended"
      | "document-change"
      | "read-only";
    state: {
      status: "paused" | "playing";
      playbackRate: -4 | -2 | -1 | 1 | 2 | 4;
      loop: boolean;
    };
    currentTimeMs: number;
    durationMs: number;
  }>;
};

export type TimelineEditorHarnessItem = {
  durationMs: number;
  id: string;
  itemGroupId?: string;
  label: string;
  startMs: number;
  trackId: string;
  transform?: {
    points: Array<{
      offsetMs: number;
      values: Record<string, number>;
      easing?: string;
    }>;
  };
};

export type TimelineEditorHarnessSnapshot = {
  items: Array<
    Pick<TimelineEditorHarnessItem, "durationMs" | "id" | "label" | "startMs" | "trackId">
  >;
  markers: Array<{
    color?: string;
    id: string;
    label: string;
    timeMs: number;
  }>;
};

export async function getHarnessState(page: Page) {
  return page.evaluate(
    () => window["__timelineEditorHarness"],
  ) as Promise<TimelineEditorHarnessState>;
}

export function getClip(page: Page, name: string) {
  return page.locator(`[data-slot='timeline-editor-clip'][aria-label="${name}"]`);
}

export function getTimelineEditor(page: Page) {
  return page.locator("[data-slot='timeline-editor']").last();
}

export function getTimelineRuler(page: Page) {
  return page.locator("[data-slot='timeline-editor-ruler']").last();
}

export function getTimelineRulerLane(page: Page) {
  return page.locator("[data-slot='timeline-editor-ruler-lane']").last();
}

export function getTimelineTrack(page: Page, label: string) {
  return page.locator("[data-slot='timeline-editor-track']").filter({ hasText: label }).last();
}

export async function selectContextMenuItem(page: Page, label: string, role = "menuitem") {
  const item = page.locator(`[role='${role}']`).filter({ hasText: label }).first();

  await item.waitFor({ state: "visible" });

  const box = await item.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

export async function getItem(page: Page, itemId: string) {
  const state = await getHarnessState(page);

  return state.document.tracks.flatMap((track) => track.items).find((item) => item.id === itemId);
}

export async function getItems(page: Page) {
  const state = await getHarnessState(page);

  return state.document.tracks.flatMap((track) => track.items);
}

export async function drag(locator: Locator, deltaX: number, options: { steps?: number } = {}) {
  await dragByPixels(locator, { deltaX, steps: options.steps ?? 4 });
}

export async function scrubRulerTo(page: Page, fraction: number) {
  const lane = getTimelineRulerLane(page);
  const laneBox = await lane.boundingBox();
  expect(laneBox).not.toBeNull();

  await lane.click({
    position: {
      x: laneBox!.width * fraction,
      y: laneBox!.height / 2,
    },
  });
}

export async function clickClip(
  page: Page,
  label: string,
  options: { expectSelected?: boolean } = {},
) {
  const clip = getClip(page, label);

  await clip.scrollIntoViewIfNeeded();
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  if (options.expectSelected ?? true) {
    await expect
      .poll(async () => {
        const state = await getHarnessState(page);
        const selectedItem = state.document.tracks
          .flatMap((track) => track.items)
          .find((item) => item.id === state.selectedItemId);

        return selectedItem?.label;
      })
      .toBe(label);
  }
}

export async function clickAsset(
  page: Page,
  name: string | RegExp,
  options: { expectedItemDelta?: number } = {},
) {
  const beforeCount = (await getItems(page)).length;

  await page.getByRole("button", { name }).click();

  if (options.expectedItemDelta !== undefined) {
    await expect
      .poll(async () => (await getItems(page)).length)
      .toBe(beforeCount + options.expectedItemDelta);
  }
}

export async function dragByPixels(
  locator: Locator,
  options: { deltaX: number; deltaY?: number; steps?: number },
) {
  await locator.scrollIntoViewIfNeeded();

  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;

  await locator.page().mouse.move(startX, startY);
  await locator.page().mouse.down();
  await locator.page().mouse.move(startX + options.deltaX, startY + (options.deltaY ?? 0), {
    steps: options.steps ?? 6,
  });
  await locator.page().mouse.up();
}

export async function dragResizeHandle(
  page: Page,
  clipLabel: string,
  edge: "start" | "end",
  deltaX: number,
) {
  await dragByPixels(
    getClip(page, clipLabel).locator(`[data-slot='timeline-editor-resize-${edge}']`),
    { deltaX },
  );
}

export function flattenItems(state: TimelineEditorHarnessState) {
  return state.document.tracks
    .flatMap((track) =>
      track.items.map((item) => ({
        durationMs: item.durationMs,
        id: item.id,
        label: item.label,
        startMs: item.startMs,
        trackId: item.trackId,
      })),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function snapshotDocument(state: TimelineEditorHarnessState): TimelineEditorHarnessSnapshot {
  return {
    items: flattenItems(state),
    markers: [...(state.document.markers ?? [])].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}

export async function expectNoDocumentChange(
  page: Page,
  beforeState: TimelineEditorHarnessState | TimelineEditorHarnessSnapshot,
) {
  const before = "document" in beforeState ? snapshotDocument(beforeState) : beforeState;

  await expect.poll(async () => snapshotDocument(await getHarnessState(page))).toEqual(before);
}

export async function expectItem(
  page: Page,
  itemId: string,
  expected: Partial<TimelineEditorHarnessItem>,
) {
  await expect
    .poll(async () => await getItem(page, itemId))
    .toEqual(expect.objectContaining(expected));
}

export async function expectNoItem(page: Page, itemId: string) {
  await expect.poll(async () => await getItem(page, itemId)).toBeUndefined();
}

export async function getItemCount(page: Page) {
  return (await getItems(page)).length;
}

export function hasOverlaps(items: TimelineEditorHarnessItem[]) {
  const sortedItemsByTrack = new Map<string, TimelineEditorHarnessItem[]>();

  for (const item of items) {
    sortedItemsByTrack.set(item.trackId, [...(sortedItemsByTrack.get(item.trackId) ?? []), item]);
  }

  for (const itemsForTrack of sortedItemsByTrack.values()) {
    const sortedItems = itemsForTrack.sort((left, right) => left.startMs - right.startMs);

    for (let index = 1; index < sortedItems.length; index += 1) {
      const previousItem = sortedItems[index - 1]!;
      const item = sortedItems[index]!;

      if (previousItem.startMs + previousItem.durationMs > item.startMs) {
        return true;
      }
    }
  }

  return false;
}
