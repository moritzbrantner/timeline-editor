import { expect, test } from "@playwright/test";

import {
  clickClip,
  expectItem,
  expectNoItem,
  getHarnessState,
  getTimelineRulerLane,
  getTimelineTrack,
  scrubRulerTo,
} from "./playwright/support/workbench";

test("edits jumps to and deletes marker from inspector", async ({ page }) => {
  await page.goto("/");

  await page.locator("[data-slot='timeline-editor-marker'][title='Handoff']").last().click();
  const inspector = page.locator("[data-slot='timeline-workbench-marker-inspector']");
  await expect(inspector).toBeVisible();

  await inspector.locator("[data-slot='timeline-workbench-marker-label']").fill("QA handoff");
  await inspector.locator("[data-slot='timeline-workbench-marker-time']").fill("5000");
  await inspector.locator("[data-slot='timeline-workbench-marker-color']").fill("#ff0000");

  await expect
    .poll(async () => (await getHarnessState(page)).document.markers?.[0])
    .toEqual(
      expect.objectContaining({
        color: "#ff0000",
        label: "QA handoff",
        timeMs: 5_000,
      }),
    );

  await inspector.getByRole("button", { name: "Jump" }).click();
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(5_000);

  await inspector.getByRole("button", { name: "Delete" }).click();
  await expect.poll(async () => (await getHarnessState(page)).document.markers ?? []).toEqual([]);
});

test("adds marker at playhead", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.25);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Add Marker" }).click();

  await expect
    .poll(async () =>
      (await getHarnessState(page)).document.markers?.some((marker) => marker.timeMs === 2_000),
    )
    .toBe(true);
});

test("selects range and deletes overlapping items", async ({ page }) => {
  await page.goto("/");

  const lane = getTimelineRulerLane(page);
  const laneBox = await lane.boundingBox();
  expect(laneBox).not.toBeNull();

  await page.keyboard.down("Shift");
  await page.mouse.move(laneBox!.x + laneBox!.width * 0.1, laneBox!.y + laneBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(laneBox!.x + laneBox!.width * 0.5, laneBox!.y + laneBox!.height / 2, {
    steps: 4,
  });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => (await getHarnessState(page)).range)
    .toEqual(expect.objectContaining({ startMs: 800, endMs: 4_000 }));
  await expect(page.locator("[data-slot='timeline-editor-range-overlay']").first()).toBeVisible();
  const inspector = page.locator("[data-slot='timeline-workbench-inspector']");
  await expect(inspector.getByRole("heading", { name: "Range" })).toBeVisible();
  await expect(inspector.getByText("Span")).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Insert Gap" })).toBeVisible();

  await page.getByRole("button", { name: "Delete Range" }).first().click();
  await expectNoItem(page, "brief");
});

test("updates snap settings from toolbar menu", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Snap" }).click();
  const menu = page.locator("[data-slot='timeline-workbench-snap-menu']");
  await menu.getByLabel("Item edges").uncheck();
  await menu.getByLabel("Playhead").uncheck();

  await expect
    .poll(async () =>
      (await getHarnessState(page)).changes.filter((change) => change.startsWith("snap:")),
    )
    .toEqual(expect.arrayContaining([expect.stringContaining('"marker"')]));
  await expect
    .poll(async () => (await getHarnessState(page)).changes.at(-1) ?? "")
    .not.toContain("item-edge");
});

test("inserts and closes selected gap on target track", async ({ page }) => {
  await page.goto("/");

  await clickClip(page, "Brief");

  const planningTrack = getTimelineTrack(page, "Planning");
  const trackBox = await planningTrack.boundingBox();
  const laneBox = await getTimelineRulerLane(page).boundingBox();
  expect(trackBox).not.toBeNull();
  expect(laneBox).not.toBeNull();

  await page.keyboard.down("Shift");
  await page.mouse.move(laneBox!.x + 2, trackBox!.y + trackBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(laneBox!.x + 82, trackBox!.y + trackBox!.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await page.getByRole("button", { name: "Insert Gap" }).first().click();
  await expectItem(page, "brief", { startMs: 2_000 });

  await page.getByRole("button", { name: "Close Gap" }).first().click();
  await expectItem(page, "brief", { startMs: 1_000 });
});
