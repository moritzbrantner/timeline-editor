import { expect, test } from "@playwright/test";

import {
  clickClip,
  drag,
  expectItem,
  expectNoItem,
  getClip,
  getHarnessState,
  getItem,
  getItems,
  getTimelineEditor,
  getTimelineTrack,
  scrubRulerTo,
  selectContextMenuItem,
} from "./playwright/support/workbench";

test("adds and removes whole tracks", async ({ page }) => {
  await page.goto("/");

  const initialEditorBox = await getTimelineEditor(page).boundingBox();
  expect(initialEditorBox).not.toBeNull();

  await page.getByRole("button", { name: "Add Track" }).click();
  await page.getByRole("menuitem", { name: "Review Track" }).click();

  await expect(
    page
      .locator("[data-slot='timeline-editor-track']")
      .filter({ hasText: "Review Track 3" })
      .last(),
  ).toBeVisible();
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual(["planning", "review", "review-track-3"]);

  await page.getByRole("button", { name: "Add Track" }).click();
  await page.getByRole("menuitem", { name: "Review Track" }).click();
  await page.getByRole("button", { name: "Add Track" }).click();
  await page.getByRole("menuitem", { name: "Review Track" }).click();
  await page.getByRole("button", { name: "Add Track" }).click();
  await page.getByRole("menuitem", { name: "Review Track" }).click();

  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual([
      "planning",
      "review",
      "review-track-3",
      "review-track-4",
      "review-track-5",
      "review-track-6",
    ]);

  await expect
    .poll(async () => Math.round((await getTimelineEditor(page).boundingBox())?.height ?? 0))
    .toBe(Math.round(initialEditorBox!.height));

  const trackRows = await page
    .locator("[data-slot='timeline-editor-track']")
    .evaluateAll((tracks) =>
      tracks.map((track) => ({
        label: track.textContent ?? "",
        top: (track.parentElement as HTMLElement | null)?.offsetTop ?? 0,
      })),
    );
  const planningRow = trackRows.find((track) => track.label.includes("Planning"));
  const reviewRow = trackRows.find((track) => track.label === "Review");
  const lastReviewRow = trackRows.find((track) => track.label.includes("Review Track 6"));
  expect(planningRow).toBeTruthy();
  expect(reviewRow?.top).toBeGreaterThan(planningRow!.top);
  expect(lastReviewRow?.top).toBeGreaterThan(reviewRow!.top);

  await getTimelineEditor(page).evaluate((editor) => {
    editor.scrollTop = editor.scrollHeight;
  });
  await expect(
    page
      .locator("[data-slot='timeline-editor-track']")
      .filter({ hasText: "Review Track 6" })
      .last(),
  ).toBeVisible();

  await getTimelineEditor(page).evaluate((editor) => {
    editor.scrollTop = 0;
  });
  const planningTrack = getTimelineTrack(page, "Planning");
  const planningTrackBox = await planningTrack.boundingBox();
  expect(planningTrackBox).not.toBeNull();

  await planningTrack.click({
    button: "right",
    position: {
      x: planningTrackBox!.width - 12,
      y: planningTrackBox!.height / 2,
    },
  });
  await selectContextMenuItem(page, "Remove Track");

  await expectNoItem(page, "brief");
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual(["review", "review-track-3", "review-track-4", "review-track-5", "review-track-6"]);
  await expect.poll(async () => (await getHarnessState(page)).selectedItemIds).toEqual([]);
});

test("runs custom timeline context menu action at clicked time", async ({ page }) => {
  await page.goto("/?timelineMenu=true");

  const planningTrack = getTimelineTrack(page, "Planning");
  const planningTrackBox = await planningTrack.boundingBox();
  expect(planningTrackBox).not.toBeNull();

  await planningTrack.click({
    button: "right",
    position: {
      x: 160,
      y: planningTrackBox!.height / 2,
    },
  });
  await selectContextMenuItem(page, "Record timeline time");

  await expect
    .poll(async () => (await getHarnessState(page)).changes)
    .toContain("timeline-menu:200:planning");
});

test("changes frame rate through custom context menu", async ({ page }) => {
  await page.goto("/?timelineMenu=true&frameRate=30");

  const planningTrack = getTimelineTrack(page, "Planning");
  const planningTrackBox = await planningTrack.boundingBox();
  expect(planningTrackBox).not.toBeNull();

  await planningTrack.click({
    button: "right",
    position: {
      x: 160,
      y: planningTrackBox!.height / 2,
    },
  });
  await selectContextMenuItem(page, "24 fps", "menuitemradio");

  await expect.poll(async () => (await getHarnessState(page)).frameRate).toBe(24);
  await expect.poll(async () => (await getHarnessState(page)).changes).toContain("frame-rate:24");
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

  await clickClip(page, "Brief");
  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemIds.sort())
    .toEqual(["brief", handoffTask!.id].sort());

  await drag(getClip(page, "Brief"), 80);

  await expectItem(page, "brief", { startMs: 2_000 });
  await expectItem(page, handoffTask!.id, { startMs: 5_000 });

  await page.getByRole("button", { exact: true, name: "Ungroup" }).click();

  await expect
    .poll(async () => (await getHarnessState(page)).document.itemGroups ?? [])
    .toEqual([]);
  await expect.poll(async () => (await getItem(page, "brief"))?.itemGroupId).toBeUndefined();
  await expect
    .poll(async () => (await getItem(page, handoffTask!.id))?.itemGroupId)
    .toBeUndefined();

  await clickClip(page, "Brief");
  await drag(getClip(page, "Brief"), 80);

  await expectItem(page, "brief", { startMs: 3_000 });
  await expectItem(page, handoffTask!.id, { startMs: 5_000 });
});

test("controls track groups from group row", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Track Groups" }).click();
  await page.getByRole("menuitem", { name: "Create Group From All Tracks" }).click();

  const groupRow = page.locator("[data-slot='timeline-editor-track-group']").last();
  await expect(groupRow).toContainText("2 tracks");

  await groupRow.getByRole("button", { name: "Collapse" }).click();
  await expect(getClip(page, "Brief")).toBeHidden();

  await groupRow.getByRole("button", { name: "Expand" }).click();
  await expect(getClip(page, "Brief")).toBeVisible();

  await groupRow.getByRole("button", { name: "Lock" }).click();
  await expect(groupRow.getByRole("button", { name: "Unlock" })).toBeVisible();
  await drag(getClip(page, "Brief"), 80);
  await expectItem(page, "brief", { startMs: 1_000 });

  await groupRow.click({ button: "right", position: { x: 24, y: 18 } });
  await selectContextMenuItem(page, "Dissolve Group");
  await expect.poll(async () => (await getHarnessState(page)).document.groups ?? []).toEqual([]);
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual(["planning", "review"]);
});

test("adds moves and removes tracks inside a group from track menus", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Track Groups" }).click();
  await page.getByRole("menuitem", { name: "Create Group From All Tracks" }).click();

  await expect
    .poll(async () => (await getHarnessState(page)).document.groups?.[0]?.trackIds)
    .toEqual(["planning", "review"]);

  const reviewTrack = getTimelineTrack(page, "Review");
  const reviewTrackBox = await reviewTrack.boundingBox();
  expect(reviewTrackBox).not.toBeNull();

  await reviewTrack.click({
    button: "right",
    position: { x: 24, y: reviewTrackBox!.height / 2 },
  });
  await selectContextMenuItem(page, "Remove Track From Group");

  await expect
    .poll(async () => (await getHarnessState(page)).document.groups?.[0]?.trackIds)
    .toEqual(["planning"]);

  await page.getByRole("button", { exact: true, name: "Review" }).click({
    button: "right",
  });
  await selectContextMenuItem(page, "Add Track To Group 1");

  await expect
    .poll(async () => (await getHarnessState(page)).document.groups?.[0]?.trackIds)
    .toEqual(["review", "planning"]);

  await reviewTrack.click({
    button: "right",
    position: { x: 24, y: reviewTrackBox!.height / 2 },
  });
  await selectContextMenuItem(page, "Move Track Down In Group");

  await expect
    .poll(async () => (await getHarnessState(page)).document.groups?.[0]?.trackIds)
    .toEqual(["planning", "review"]);
});

test("filters assets and shows selected-track compatibility", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Compatible with another track").first()).toBeVisible();
  await clickClip(page, "Brief");
  await expect(page.getByText("Fits selected track").first()).toBeVisible();

  await page.getByPlaceholder("Search assets").fill("Prototype");
  await expect(page.getByRole("button", { name: /Prototype/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Handoff task/ })).toBeHidden();

  await page.getByPlaceholder("Search assets").fill("");
  await page.getByLabel("Compatible with selected track").check();
  await page.locator("[data-slot='timeline-workbench-asset-kind-filter']").selectOption("task");
  await expect(page.getByRole("button", { name: /Handoff task/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Prototype/ })).toBeHidden();
});

test("read-only mode prevents mutations", async ({ page }) => {
  await page.goto("/?readOnly=true");

  await expect(getTimelineEditor(page)).toHaveAttribute("data-read-only", "true");

  await drag(getClip(page, "Brief"), 80);
  await clickClip(page, "Brief", { expectSelected: false });
  await getTimelineEditor(page).focus();
  await page.keyboard.press("Delete");

  await expectItem(page, "brief", { startMs: 1_000 });
});
