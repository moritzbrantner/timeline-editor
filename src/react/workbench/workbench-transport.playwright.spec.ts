import { expect, test } from "@playwright/test";

import { getHarnessState, getTimelineEditor } from "./playwright/support/workbench";

function getTransportButton(page: import("@playwright/test").Page, name: string) {
  return page
    .locator("[data-slot='timeline-workbench-transport']")
    .getByRole("button", { exact: true, name });
}

test("dedicated transport strip renders with and without the preview panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-slot='timeline-workbench-transport']")).toBeVisible();
  await expect(getTransportButton(page, "Play")).toBeVisible();

  await page.goto("/?showPreviewPanel=false");
  await expect(page.locator("[data-slot='timeline-workbench-transport']")).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-preview']")).toHaveCount(0);
});

test("play advances the document time and timeline playhead", async ({ page }) => {
  await page.goto("/");

  const beforeLeft = await page
    .locator("[data-slot='timeline-editor-playhead']")
    .last()
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).left));

  await getTransportButton(page, "Play").click();

  await expect
    .poll(async () => (await getHarnessState(page)).document.currentTimeMs ?? 0)
    .toBeGreaterThan(1_000);

  const afterLeft = await page
    .locator("[data-slot='timeline-editor-playhead']")
    .last()
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).left));
  expect(afterLeft).toBeGreaterThan(beforeLeft);
});

test("Space, J, K, L, and Shift+L control transport state", async ({ page }) => {
  await page.goto("/");

  await getTransportButton(page, "Play").click();
  await expect(getTransportButton(page, "Pause")).toBeVisible();

  await page.keyboard.press("Space");
  await expect(getTransportButton(page, "Play")).toBeVisible();

  await page.keyboard.press("L");
  await expect(page.locator("[data-slot='timeline-workbench-transport-rate']")).toHaveText("1x");
  await page.keyboard.press("L");
  await expect(page.locator("[data-slot='timeline-workbench-transport-rate']")).toHaveText("2x");
  await page.keyboard.press("L");
  await expect(page.locator("[data-slot='timeline-workbench-transport-rate']")).toHaveText("4x");

  const beforeReverse = (await getHarnessState(page)).document.currentTimeMs ?? 0;
  await page.keyboard.press("J");
  await expect(page.locator("[data-slot='timeline-workbench-transport-rate']")).toHaveText("-1x");
  await expect
    .poll(async () => (await getHarnessState(page)).document.currentTimeMs ?? 0)
    .toBeLessThan(beforeReverse);

  await page.keyboard.press("K");
  await expect(getTransportButton(page, "Play")).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-transport-rate']")).toHaveText("1x");

  const loop = getTransportButton(page, "Loop");
  await expect(loop).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Shift+L");
  await expect(loop).toHaveAttribute("aria-pressed", "true");
});

test("selected range and full document loop wrap playback", async ({ page }) => {
  await page.goto("/?fixture=transport-endpoints&initialTimeMs=1900&initialRange=1000-2000");

  await getTransportButton(page, "Loop").click();
  await getTransportButton(page, "Play").click();

  await expect
    .poll(async () => (await getHarnessState(page)).document.currentTimeMs ?? 0, {
      timeout: 4_000,
    })
    .toBeLessThan(1_500);
  const selectedLoopTime = (await getHarnessState(page)).document.currentTimeMs ?? 0;
  expect(selectedLoopTime).toBeGreaterThanOrEqual(1_000);

  await page.goto("/?fixture=transport-endpoints&initialTimeMs=7900");
  await getTransportButton(page, "Loop").click();
  await getTransportButton(page, "Play").click();

  await expect
    .poll(async () => (await getHarnessState(page)).document.currentTimeMs ?? 0, {
      timeout: 4_000,
    })
    .toBeLessThan(1_000);
});

test("selected range loop wraps immediately from exact boundaries", async ({ page }) => {
  await page.goto("/?fixture=transport-endpoints&initialTimeMs=2000&initialRange=1000-2000");

  await getTransportButton(page, "Loop").click();
  await getTransportButton(page, "Play").click();

  await expect
    .poll(async () => (await getHarnessState(page)).document.currentTimeMs ?? 0)
    .toBeLessThan(2_000);
  expect((await getHarnessState(page)).document.currentTimeMs ?? 0).toBeGreaterThanOrEqual(1_000);
});

test("keep-visible follow scrolls forward and reverse while transport is active", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto("/?fixture=large&surface=workbench");
  const editor = getTimelineEditor(page);
  const initialScrollLeft = await editor.evaluate((element) => element.scrollLeft);

  await getTransportButton(page, "Play").click();
  await expect
    .poll(async () => editor.evaluate((element) => element.scrollLeft), { timeout: 8_000 })
    .toBeGreaterThan(initialScrollLeft);

  await page.goto("/?fixture=large-right-edge&surface=workbench");
  const rightEdgeEditor = getTimelineEditor(page);
  await expect.poll(async () => rightEdgeEditor.evaluate((element) => element.scrollLeft)).toBe(0);
  await getTransportButton(page, "Shuttle backward").click();
  await expect
    .poll(async () => rightEdgeEditor.evaluate((element) => element.scrollLeft), {
      timeout: 8_000,
    })
    .toBeGreaterThan(0);
});

test("preview modes expose scene, selected item, and mini timeline views", async ({ page }) => {
  await page.goto("/?fixture=transport-media&initialTimeMs=1500&mockMedia=true");

  await expect(page.locator("[data-slot='timeline-workbench-scene-preview']")).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-scene-image']")).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-scene-video']")).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-scene-subtitles']")).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-scene-audio']")).toHaveCount(1);
  await expect(page.locator("[data-slot='timeline-media-audio-preview-player']")).toHaveCount(0);

  await page.getByRole("button", { exact: true, name: "Caption" }).click();
  await page.getByRole("radio", { name: "Selection" }).click();
  await expect(page.locator("[data-slot='timeline-workbench-scene-subtitles']")).toBeVisible();

  await page.getByRole("radio", { name: "Timeline" }).click();
  await expect(page.locator("[data-slot='timeline-workbench-mini-preview-row']")).toHaveCount(2);
  await expect(
    page.locator("[data-slot='timeline-workbench-mini-preview-playhead']"),
  ).toBeVisible();
});

test("mocked media synchronizes to workbench transport without owning native controls", async ({
  page,
}) => {
  await page.goto("/?fixture=transport-media&mockMedia=true");

  const getMediaState = () =>
    page.evaluate(() => {
      const video = document.querySelector<HTMLVideoElement>(
        "[data-slot='timeline-workbench-scene-video']",
      );
      const audio = document.querySelector<HTMLAudioElement>(
        "[data-slot='timeline-workbench-scene-audio']",
      );

      return {
        audioCurrentTime: audio?.currentTime ?? null,
        audioPauseCount: Number.parseInt(audio?.dataset["pauseCount"] ?? "0", 10),
        audioPlayCount: Number.parseInt(audio?.dataset["playCount"] ?? "0", 10),
        audioPlayState: audio?.dataset["playState"],
        videoCurrentTime: video?.currentTime ?? null,
        videoPlaybackRate: video?.playbackRate ?? null,
        videoPlayState: video?.dataset["playState"],
      };
    });

  const initialTime = (await getHarnessState(page)).document.currentTimeMs ?? 0;
  await page.evaluate(() =>
    document
      .querySelector<HTMLVideoElement>("[data-slot='timeline-workbench-scene-video']")
      ?.play(),
  );
  await page.waitForTimeout(120);
  expect((await getHarnessState(page)).document.currentTimeMs).toBe(initialTime);
  expect((await getHarnessState(page)).transport?.status).not.toBe("playing");

  await getTransportButton(page, "Play").click();
  await expect.poll(async () => (await getMediaState()).videoPlayState).toBe("playing");
  await expect.poll(async () => (await getMediaState()).audioPlayState).toBe("playing");
  const playing = await getMediaState();
  expect(playing.videoCurrentTime).not.toBeNull();
  expect(playing.audioCurrentTime).not.toBeNull();
  expect(playing.audioPlayCount).toBe(1);
  expect(playing.videoPlaybackRate).toBe(1);
  await page.waitForTimeout(250);
  expect((await getMediaState()).audioPlayCount).toBe(1);
  await getTransportButton(page, "Pause").click();
  await expect.poll(async () => (await getHarnessState(page)).transport?.status).toBe("paused");
  await expect.poll(async () => (await getMediaState()).audioPlayState).toBe("paused");

  await getTransportButton(page, "Play").click();
  await getTransportButton(page, "Shuttle backward").click();
  await expect.poll(async () => (await getHarnessState(page)).transport?.playbackRate).toBe(-1);
  const reversed = await getMediaState();
  expect(reversed.videoPlaybackRate).not.toBe(-1);
  await expect.poll(async () => (await getMediaState()).audioPlayState).not.toBe("playing");
});
