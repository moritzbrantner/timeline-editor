import { expect, type Locator, type Page, test } from "@playwright/test";

type TimelineEditorHarnessState = {
  changes: string[];
  document: {
    currentTimeMs?: number;
    markers?: Array<{
      id: string;
      label: string;
      timeMs: number;
    }>;
    itemGroups?: Array<{
      id: string;
      itemIds: string[];
      label: string;
    }>;
    tracks: Array<{
      id: string;
      items: Array<{
        durationMs: number;
        id: string;
        itemGroupId?: string;
        label: string;
        startMs: number;
        trackId: string;
      }>;
    }>;
  };
  selectedItemId: string | null;
  selectedItemIds: string[];
};

async function getHarnessState(page: Page) {
  return page.evaluate(
    () => window["__timelineEditorHarness"],
  ) as Promise<TimelineEditorHarnessState>;
}

function getClip(page: Page, name: string) {
  return page.getByRole("button", { exact: true, name });
}

function getTimelineEditor(page: Page) {
  return page.locator("[data-slot='timeline-editor']").last();
}

function getTimelineRuler(page: Page) {
  return page.locator("[data-slot='timeline-editor-ruler']").last();
}

function getTimelineRulerLane(page: Page) {
  return page.locator("[data-slot='timeline-editor-ruler-lane']").last();
}

async function getItem(page: Page, itemId: string) {
  const state = await getHarnessState(page);

  return state.document.tracks.flatMap((track) => track.items).find((item) => item.id === itemId);
}

async function getItems(page: Page) {
  const state = await getHarnessState(page);

  return state.document.tracks.flatMap((track) => track.items);
}

async function drag(locator: Locator, deltaX: number) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Cannot drag an element without a bounding box");
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await locator.page().mouse.move(startX, startY);
  await locator.page().mouse.down();
  await locator.page().mouse.move(startX + deltaX, startY, { steps: 4 });
  await locator.page().mouse.up();
}

async function scrubRulerTo(page: Page, fraction: number) {
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

test("renders the timeline workbench", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Prototype/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Handoff task/ })).toBeVisible();
  await expect(page.getByText("Planning").last()).toBeVisible();
  await expect(page.getByText("Review").last()).toBeVisible();
  await expect(getClip(page, "Brief")).toBeVisible();
  await expect(
    page.locator("[data-slot='timeline-editor-marker'][title='Handoff']").last(),
  ).toBeVisible();
  await expect(getTimelineEditor(page)).toBeVisible();
});

test("selects an item and scrubs the ruler", async ({ page }) => {
  await page.goto("/");

  const clip = getClip(page, "Brief");
  await clip.click();

  await expect.poll(async () => (await getHarnessState(page)).selectedItemId).toBe("brief");
  await expect(clip).toHaveAttribute("aria-pressed", "true");

  await scrubRulerTo(page, 0.5);

  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(4_000);
});

test("aligns timeline zero after the track names", async ({ page }) => {
  await page.goto("/");

  const laneBox = await getTimelineRulerLane(page).boundingBox();
  const clipBox = await getClip(page, "Brief").boundingBox();
  expect(laneBox).not.toBeNull();
  expect(clipBox).not.toBeNull();

  expect(Math.round(clipBox!.x - laneBox!.x)).toBe(80);
});

test("inserts an asset at the playhead", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.75);
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(6_000);
  await page.getByRole("button", { name: /Prototype/ }).click();

  await expect(getClip(page, "Prototype")).toBeVisible();
  await expect
    .poll(async () => (await getItems(page)).find((item) => item.label === "Prototype"))
    .toEqual(
      expect.objectContaining({
        durationMs: 1_000,
        label: "Prototype",
        startMs: 6_000,
        trackId: "planning",
      }),
    );
  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemId)
    .toMatch(/^prototype-/);
});

test("adds and removes whole timelines", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add Timeline" }).click();

  await expect(
    page.locator("[data-slot='timeline-editor-track']").filter({ hasText: "Timeline 3" }).last(),
  ).toBeVisible();
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual(["planning", "review", "timeline-3"]);

  const planningTrack = page
    .locator("[data-slot='timeline-editor-track']")
    .filter({ hasText: "Planning" })
    .last();
  const planningTrackBox = await planningTrack.boundingBox();
  expect(planningTrackBox).not.toBeNull();

  await planningTrack.click({
    button: "right",
    position: {
      x: planningTrackBox!.width - 12,
      y: planningTrackBox!.height / 2,
    },
  });
  await page.getByText("Remove Timeline", { exact: true }).click();

  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual(["review", "timeline-3"]);
  await expect.poll(async () => (await getHarnessState(page)).selectedItemIds).toEqual([]);
});

test("zooms the timeline with ctrl mousewheel", async ({ page }) => {
  await page.goto("/");

  const ruler = getTimelineRuler(page);
  const initialBox = await ruler.boundingBox();
  const editorBox = await getTimelineEditor(page).boundingBox();
  expect(initialBox).not.toBeNull();
  expect(editorBox).not.toBeNull();

  const defaultAllowed = await getTimelineEditor(page).evaluate(
    (editor, clientX) =>
      editor.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX,
          ctrlKey: true,
          deltaY: -120,
        }),
      ),
    editorBox!.x + editorBox!.width / 2,
  );

  expect(defaultAllowed).toBe(false);
  await expect
    .poll(async () => (await ruler.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialBox!.width);
});

test("keeps horizontal timeline scroll on the editor scroller", async ({ page }) => {
  await page.goto("/?fixture=large");

  const scrollState = await getTimelineEditor(page).evaluate((editor) => {
    window.scrollTo(0, 0);
    editor.scrollLeft = 200;
    editor.dispatchEvent(new Event("scroll", { bubbles: true }));

    return {
      bodyScrollLeft: document.body.scrollLeft,
      documentScrollLeft: document.documentElement.scrollLeft,
      editorScrollLeft: editor.scrollLeft,
      windowScrollX: window.scrollX,
    };
  });

  expect(scrollState).toEqual({
    bodyScrollLeft: 0,
    documentScrollLeft: 0,
    editorScrollLeft: 200,
    windowScrollX: 0,
  });
});

test("virtualizes large timeline rows", async ({ page }) => {
  await page.goto("/?fixture=large");

  await expect(getTimelineEditor(page)).toHaveAttribute("data-slot", "timeline-editor");
  await expect.poll(async () => (await getHarnessState(page)).document.tracks.length).toBe(200);
  await expect(page.locator("[data-slot='timeline-editor-tracks']").last()).toHaveAttribute(
    "data-virtualized",
    "true",
  );
  await expect
    .poll(async () => page.locator("[data-slot='timeline-editor-track']").count())
    .toBeLessThan(20);
});

test("groups and ungroups timeline items", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.5);
  await page.getByRole("button", { name: /Handoff task/ }).click();
  await getClip(page, "Brief").click({ modifiers: ["Control"] });

  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemIds.sort())
    .toEqual(expect.arrayContaining(["brief", expect.stringMatching(/^handoff-task-/)]));

  await page.getByRole("button", { exact: true, name: "Group" }).click();

  await expect.poll(async () => (await getHarnessState(page)).document.itemGroups).toHaveLength(1);

  const groupedItems = await getItems(page);
  const handoffTask = groupedItems.find((item) => item.label === "Handoff task");
  const groupId = groupedItems.find((item) => item.id === "brief")?.itemGroupId;
  expect(groupId).toBeTruthy();
  expect(handoffTask?.itemGroupId).toBe(groupId);

  await getClip(page, "Brief").click();
  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemIds.sort())
    .toEqual(["brief", handoffTask!.id].sort());

  await drag(getClip(page, "Brief"), 80);

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(2_000);
  await expect.poll(async () => (await getItem(page, handoffTask!.id))?.startMs).toBe(5_000);

  await page.getByRole("button", { exact: true, name: "Ungroup" }).click();

  await expect
    .poll(async () => (await getHarnessState(page)).document.itemGroups ?? [])
    .toEqual([]);
  await expect.poll(async () => (await getItem(page, "brief"))?.itemGroupId).toBeUndefined();
  await expect
    .poll(async () => (await getItem(page, handoffTask!.id))?.itemGroupId)
    .toBeUndefined();

  await getClip(page, "Brief").click();
  await drag(getClip(page, "Brief"), 80);

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(3_000);
  await expect.poll(async () => (await getItem(page, handoffTask!.id))?.startMs).toBe(5_000);
});

test("duplicates, deletes, undoes, and redoes from the toolbar", async ({ page }) => {
  await page.goto("/");

  await getClip(page, "Brief").click();
  await page.getByRole("button", { name: "Duplicate" }).click();

  await expect
    .poll(async () => await getItem(page, "brief-copy"))
    .toEqual(
      expect.objectContaining({
        durationMs: 2_000,
        startMs: 3_000,
      }),
    );

  await page.getByRole("button", { name: "Delete" }).click();

  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();
  await expect.poll(async () => await getItem(page, "brief-copy")).toBeDefined();

  await page.getByRole("button", { name: "Undo" }).click();

  await expect
    .poll(async () => await getItem(page, "brief"))
    .toEqual(expect.objectContaining({ startMs: 1_000 }));

  await page.getByRole("button", { name: "Redo" }).click();

  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();
});

test("splits a clip at the playhead and adds a marker", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.25);
  await getClip(page, "Brief").click();
  await page.getByRole("button", { name: "Split" }).click();

  await expect
    .poll(async () => await getItem(page, "brief"))
    .toEqual(
      expect.objectContaining({
        durationMs: 1_000,
        startMs: 1_000,
      }),
    );
  await expect
    .poll(async () => await getItem(page, "brief-part-2"))
    .toEqual(
      expect.objectContaining({
        durationMs: 1_000,
        startMs: 2_000,
      }),
    );

  await page.getByRole("button", { name: "Marker" }).click();

  await expect
    .poll(async () =>
      (await getHarnessState(page)).document.markers?.some((marker) => marker.timeMs === 2_000),
    )
    .toBe(true);
});

test("nudges selected clips and selects all with keyboard shortcuts", async ({ page }) => {
  await page.goto("/");

  await getClip(page, "Brief").click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press("ArrowRight");

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(1_100);

  await page.getByRole("button", { name: "Duplicate" }).click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");

  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemIds.sort())
    .toEqual(["brief", "brief-copy"]);
});

test("nudges selected clips by frame when a framerate is set", async ({ page }) => {
  await page.goto("/?frameRate=25");

  await getClip(page, "Brief").click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press("ArrowRight");

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(1_040);
});

test("drags a clip with real browser pointer events", async ({ page }) => {
  await page.goto("/");

  await drag(getClip(page, "Brief"), 80);

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(2_000);
});

test("resizes a clip using the end handle", async ({ page }) => {
  await page.goto("/");

  const endHandle = getClip(page, "Brief").locator("[data-slot='timeline-editor-resize-end']");
  await drag(endHandle, 80);

  await expect.poll(async () => (await getItem(page, "brief"))?.durationMs).toBe(3_000);
});

test("deletes the selected clip by keyboard", async ({ page }) => {
  await page.goto("/");

  await getClip(page, "Brief").click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press("Delete");

  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();
});

test("read-only mode prevents mutations", async ({ page }) => {
  await page.goto("/?readOnly=true");

  await expect(getTimelineEditor(page)).toHaveAttribute("data-read-only", "true");

  await drag(getClip(page, "Brief"), 80);
  await getClip(page, "Brief").click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press("Delete");

  const item = await getItem(page, "brief");
  expect(item).toEqual(expect.objectContaining({ startMs: 1_000 }));
});
