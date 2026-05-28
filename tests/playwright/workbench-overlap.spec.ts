import { expect, test } from "@playwright/test";

import {
  clickAsset,
  clickClip,
  drag,
  dragResizeHandle,
  expectItem,
  expectNoDocumentChange,
  getClip,
  getHarnessState,
  getItemCount,
  getItems,
  hasOverlaps,
  snapshotDocument,
  scrubRulerTo,
} from "./support/workbench";

const overlapFixtureUrl = "/?fixture=overlap-prevent&editPolicy=prevent";

test("prevents simple drag overlap", async ({ page }) => {
  await page.goto(overlapFixtureUrl);

  const initialItemCount = await getItemCount(page);

  await clickClip(page, "Second");
  await drag(getClip(page, "Second"), -80);

  await expectItem(page, "first", { durationMs: 2_000, startMs: 1_000 });
  await expectItem(page, "second", { durationMs: 1_500, startMs: 3_500 });
  await expect.poll(async () => await getItemCount(page)).toBe(initialItemCount);
  await expect.poll(async () => (await getHarnessState(page)).selectedItemId).toBe("second");
});

test("prevents resize overlap", async ({ page }) => {
  await page.goto(overlapFixtureUrl);

  await dragResizeHandle(page, "First", "end", 80);

  await expectItem(page, "first", { durationMs: 2_000, startMs: 1_000 });
  await expectItem(page, "second", { durationMs: 1_500, startMs: 3_500 });
});

test("allows non-overlapping drag under prevent policy", async ({ page }) => {
  await page.goto(overlapFixtureUrl);

  await clickClip(page, "Second");
  await drag(getClip(page, "Second"), 80);

  await expectItem(page, "second", { startMs: 4_500 });
  await expect.poll(async () => hasOverlaps(await getItems(page))).toBe(false);
});

test("prevents asset insertion into occupied range", async ({ page }) => {
  await page.goto(overlapFixtureUrl);

  const initialItemCount = await getItemCount(page);

  await scrubRulerTo(page, 0.25);
  await clickAsset(page, /Prototype/);

  await expect.poll(async () => await getItemCount(page)).toBe(initialItemCount);
  await expect
    .poll(async () => (await getItems(page)).some((item) => item.label === "Prototype"))
    .toBe(false);
});

test("does not mistake basic row click for overlap mutation", async ({ page }) => {
  await page.goto(overlapFixtureUrl);

  const initialSnapshot = snapshotDocument(await getHarnessState(page));

  await clickClip(page, "First");

  await expect.poll(async () => (await getHarnessState(page)).selectedItemId).toBe("first");
  await expectNoDocumentChange(page, initialSnapshot);
});
