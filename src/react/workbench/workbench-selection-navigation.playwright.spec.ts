import { expect, test, type Page } from "@playwright/test";

import {
  clickClip,
  getClip,
  getHarnessState,
  getTimelineEditor,
  getTimelineRuler,
  getTimelineRulerLane,
  getTimelineTrack,
  scrubRulerTo,
} from "./playwright/support/workbench";

test("selects an item with one click", async ({ page }) => {
  await page.goto("/");

  const clip = getClip(page, "Brief");
  await clickClip(page, "Brief");

  await expect.poll(async () => (await getHarnessState(page)).selectedItemId).toBe("brief");
  await expect.poll(async () => (await getHarnessState(page)).selectedItemIds).toEqual(["brief"]);
  await expect(clip).toHaveAttribute("aria-pressed", "true");
});

test("clears selection by clicking an empty lane", async ({ page }) => {
  await page.goto("/");

  await clickClip(page, "Brief");
  await expect.poll(async () => (await getHarnessState(page)).selectedItemId).toBe("brief");

  const planningTrack = getTimelineTrack(page, "Planning");
  const planningTrackBox = await planningTrack.boundingBox();
  expect(planningTrackBox).not.toBeNull();

  await planningTrack.click({
    position: {
      x: planningTrackBox!.width - 12,
      y: planningTrackBox!.height / 2,
    },
  });

  await expect.poll(async () => (await getHarnessState(page)).selectedItemIds).toEqual([]);
});

test("scrubs ruler to expected time", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.5);

  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(4_000);
});

test("scrubs preview by dragging empty lane", async ({ page }) => {
  await page.goto("/");

  const rulerLaneBox = await getTimelineRulerLane(page).boundingBox();
  const reviewTrackBox = await getTimelineTrack(page, "Review").boundingBox();
  expect(rulerLaneBox).not.toBeNull();
  expect(reviewTrackBox).not.toBeNull();

  const startX = rulerLaneBox!.x + rulerLaneBox!.width * 0.25;
  const endX = rulerLaneBox!.x + rulerLaneBox!.width * 0.75;
  const y = reviewTrackBox!.y + reviewTrackBox!.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 5 });
  await page.mouse.up();

  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(6_000);
  await expect(
    page.locator("[data-slot='timeline-workbench-preview']").last().getByText("0:06.0"),
  ).toBeVisible();
});

test("zooms with ctrl mousewheel", async ({ page }) => {
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

test("maps normal mousewheel to horizontal scroll and shift mousewheel to vertical scroll", async ({
  page,
}) => {
  await page.goto("/?fixture=large");

  const normalScrollState = await getTimelineEditor(page).evaluate((editor) => {
    editor.scrollLeft = 0;
    const defaultAllowed = editor.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 180,
      }),
    );

    return {
      defaultAllowed,
      scrollLeft: editor.scrollLeft,
      scrollTop: editor.scrollTop,
    };
  });

  expect(normalScrollState.defaultAllowed).toBe(false);
  expect(normalScrollState.scrollLeft).toBe(180);
  expect(normalScrollState.scrollTop).toBe(0);

  const shiftScrollState = await getTimelineEditor(page).evaluate((editor) => {
    editor.scrollLeft = 0;
    editor.scrollTop = 0;
    const defaultAllowed = editor.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 160,
        shiftKey: true,
      }),
    );

    return {
      defaultAllowed,
      scrollLeft: editor.scrollLeft,
      scrollTop: editor.scrollTop,
    };
  });

  expect(shiftScrollState.defaultAllowed).toBe(false);
  expect(shiftScrollState.scrollLeft).toBe(0);
  expect(shiftScrollState.scrollTop).toBe(160);
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

test("keeps the track scrollbar visible when the timeline overflows horizontally", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto("/");

  await addReviewTrack(page);
  await addReviewTrack(page);
  await addReviewTrack(page);
  await addReviewTrack(page);

  const editorOverflow = await getTimelineEditor(page).evaluate((editor) => {
    const bounds = editor.getBoundingClientRect();

    return {
      editorRight: bounds.right,
      horizontalOverflow: editor.scrollWidth > editor.clientWidth,
      verticalOverflow: editor.scrollHeight > editor.clientHeight,
      viewportWidth: window.innerWidth,
    };
  });

  expect(editorOverflow.horizontalOverflow).toBe(true);
  expect(editorOverflow.verticalOverflow).toBe(true);
  expect(editorOverflow.editorRight).toBeLessThanOrEqual(editorOverflow.viewportWidth);
});

async function addReviewTrack(page: Page) {
  await page.getByRole("button", { name: "Add Track" }).click();
  await page.getByRole("menuitem", { name: "Review Track" }).click();
}
