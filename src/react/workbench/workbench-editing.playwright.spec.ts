import { expect, test } from "@playwright/test";

import {
  clickClip,
  drag,
  dragResizeHandle,
  expectItem,
  expectNoItem,
  getClip,
  getHarnessState,
  getTimelineEditor,
  scrubRulerTo,
} from "./playwright/support/workbench";

const modKey = process.platform === "darwin" ? "Meta" : "Control";

test("moves a clip with browser pointer events", async ({ page }) => {
  await page.goto("/");

  await drag(getClip(page, "Brief"), 80);

  await expectItem(page, "brief", { startMs: 2_000 });
});

test("resizes a clip using end handle", async ({ page }) => {
  await page.goto("/");

  await dragResizeHandle(page, "Brief", "end", 80);

  await expectItem(page, "brief", { durationMs: 3_000 });
});

test("duplicates deletes undoes and redoes", async ({ page }) => {
  await page.goto("/");

  await clickClip(page, "Brief");
  await page.getByRole("button", { name: "Duplicate" }).click();

  await expectItem(page, "brief-copy", {
    durationMs: 2_000,
    startMs: 3_000,
  });

  await page.getByRole("button", { exact: true, name: "Delete" }).click();

  await expectNoItem(page, "brief");
  await expectItem(page, "brief-copy", { startMs: 3_000 });

  await page.getByRole("button", { name: "Undo" }).click();
  await expectItem(page, "brief", { startMs: 1_000 });

  await page.getByRole("button", { name: "Redo" }).click();
  await expectNoItem(page, "brief");
});

test("copies and pastes selected clips with keyboard shortcuts", async ({ page }) => {
  await page.goto("/");

  await clickClip(page, "Brief");
  await scrubRulerTo(page, 0.75);
  await getTimelineEditor(page).focus();
  await page.keyboard.press(`${modKey}+C`);
  await page.keyboard.press(`${modKey}+V`);

  await expectItem(page, "brief-copy", {
    durationMs: 2_000,
    startMs: 6_000,
    trackId: "planning",
  });
});

test("cuts and pastes with toolbar actions", async ({ page }) => {
  await page.goto("/");

  await clickClip(page, "Brief");
  await page.getByRole("button", { name: "Cut" }).click();

  await expectNoItem(page, "brief");

  await scrubRulerTo(page, 0.5);
  await page.getByRole("button", { name: "Paste" }).click();

  await expectItem(page, "brief-copy", { startMs: 4_000 });
});

test("splits a clip with toolbar button", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.25);
  await clickClip(page, "Brief");
  await page.getByRole("button", { name: "Split" }).click();

  await expectItem(page, "brief", {
    durationMs: 1_000,
    startMs: 1_000,
  });
  await expectItem(page, "brief-part-2", {
    durationMs: 1_000,
    startMs: 2_000,
  });
});

test("splits a clip with blade tool", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("radio", { name: "Blade" }).click();

  const clip = getClip(page, "Brief");
  const clipBox = await clip.boundingBox();
  expect(clipBox).not.toBeNull();

  await page.mouse.click(clipBox!.x + clipBox!.width / 2, clipBox!.y + clipBox!.height / 2);

  await expectItem(page, "brief", {
    durationMs: 1_000,
    startMs: 1_000,
  });
  await expectItem(page, "brief-part-2", {
    durationMs: 1_000,
    startMs: 2_000,
  });
});

test("nudges selected clip by snap interval", async ({ page }) => {
  await page.goto("/");

  await clickClip(page, "Brief");
  await getTimelineEditor(page).focus();
  await page.keyboard.press("ArrowRight");

  await expectItem(page, "brief", { startMs: 1_100 });
});

test("nudges selected clip by frame when frameRate is set", async ({ page }) => {
  await page.goto("/?frameRate=25");

  await clickClip(page, "Brief");
  await getTimelineEditor(page).focus();
  await page.keyboard.press("ArrowRight");

  await expectItem(page, "brief", { startMs: 1_040 });
});

test("steps playhead by frame controls when frameRate is set", async ({ page }) => {
  await page.goto("/?frameRate=25");

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: /Next frame/ }).click();
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(1_040);

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: /Previous frame/ }).click();
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(1_000);
});

test("edits transform keyframes from the inspector", async ({ page }) => {
  await page.goto("/?transformInspector=true");

  await clickClip(page, "Brief");
  await expect(page.locator("[data-slot='timeline-workbench-transform-inspector']")).toBeVisible();

  await page.getByRole("button", { name: "Add Keyframe" }).click();
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks[0]?.items[0]?.transform?.points)
    .toEqual([{ offsetMs: 0, values: { x: 0, opacity: 1 }, easing: "linear" }]);

  await page.getByLabel("X").fill("24");
  await expect
    .poll(
      async () =>
        (await getHarnessState(page)).document.tracks[0]?.items[0]?.transform?.points[0]?.values.x,
    )
    .toBe(24);

  await page.locator("[data-slot='timeline-workbench-transform-easing']").selectOption("hold");
  await expect
    .poll(
      async () =>
        (await getHarnessState(page)).document.tracks[0]?.items[0]?.transform?.points[0]?.easing,
    )
    .toBe("hold");

  await page.getByRole("button", { name: "Remove Keyframe" }).click();
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks[0]?.items[0]?.transform)
    .toBeUndefined();
});

test("draws frame ticks across timeline tracks", async ({ page }) => {
  await page.goto("/?frameRate=25");

  await expect
    .poll(async () => page.locator("[data-slot='timeline-editor-track-tick']").count())
    .toBeGreaterThan(0);
});

test("selects all with keyboard shortcut", async ({ page }) => {
  await page.goto("/");

  await clickClip(page, "Brief");
  await page.getByRole("button", { name: "Duplicate" }).click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press(`${modKey}+A`);

  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemIds.sort())
    .toEqual(["brief", "brief-copy"]);
});

test("deletes selected clip by keyboard", async ({ page }) => {
  await page.goto("/");

  await clickClip(page, "Brief");
  await getTimelineEditor(page).focus();
  await page.keyboard.press("Delete");

  await expectNoItem(page, "brief");
});
