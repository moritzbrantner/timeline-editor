import { expect, type Locator, type Page, test } from "@playwright/test";

type TimelineEditorHarnessState = {
  changes: string[];
  document: {
    currentTimeMs?: number;
    tracks: Array<{
      id: string;
      items: Array<{
        durationMs: number;
        id: string;
        startMs: number;
      }>;
    }>;
  };
  selectedItemId: string | null;
};

async function getHarnessState(page: Page) {
  return page.evaluate(
    () => window["__timelineEditorHarness"],
  ) as Promise<TimelineEditorHarnessState>;
}

function getClip(page: Page, name: string) {
  return page.getByRole("button", { name });
}

function getTimelineEditor(page: Page) {
  return page.locator("[data-slot='timeline-editor']").last();
}

function getTimelineRuler(page: Page) {
  return page.locator("[data-slot='timeline-editor-ruler']").last();
}

async function getItem(page: Page, itemId: string) {
  const state = await getHarnessState(page);

  return state.document.tracks.flatMap((track) => track.items).find((item) => item.id === itemId);
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

test("renders the timeline workbench", async ({ page }) => {
  await page.goto("/");

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

  const ruler = getTimelineRuler(page);
  const rulerBox = await ruler.boundingBox();
  expect(rulerBox).not.toBeNull();

  await page.mouse.click(rulerBox!.x + rulerBox!.width / 2, rulerBox!.y + rulerBox!.height / 2);

  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(4_000);
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
