import { expect, test, type Page } from "@playwright/test";

import { getHarnessState, getTimelineEditor } from "./playwright/support/workbench";

function pane(page: Page, label: "Assets" | "Inspector") {
  return page.locator(`[data-slot='editor-pane'][aria-label='${label}']`);
}

async function paneWidth(page: Page, label: "Assets" | "Inspector") {
  const box = await pane(page, label).boundingBox();
  expect(box).not.toBeNull();
  return Math.round(box!.width);
}

async function panelLayoutChanges(page: Page) {
  const state = await getHarnessState(page);
  return state.changes.filter((change) => change.startsWith("panel-layout:"));
}

test("docks side panes at fixed pixel widths that survive window resizes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(pane(page, "Assets")).toBeVisible();
  await expect(pane(page, "Inspector")).toBeVisible();
  expect(await paneWidth(page, "Assets")).toBe(272);
  expect(await paneWidth(page, "Inspector")).toBe(320);

  await page.setViewportSize({ width: 1600, height: 800 });
  expect(await paneWidth(page, "Assets")).toBe(272);
  expect(await paneWidth(page, "Inspector")).toBe(320);
  const editor = await getTimelineEditor(page).boundingBox();
  expect(editor!.width).toBeGreaterThan(1500);
});

test("resizes panes with the keyboard and reports finished layout changes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const splitter = page.getByRole("separator", { name: "Resize Inspector" });
  await splitter.focus();
  // The inspector sits at the end edge, so ArrowLeft grows it.
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => paneWidth(page, "Inspector")).toBe(336);
  await expect(splitter).toHaveAttribute("aria-valuenow", "336");
  // Keyboard resizing stays with the splitter: the timeline does not move its playhead or clips.
  expect(
    (await getHarnessState(page)).changes.some(
      (change) => change.startsWith("current-time:") || change.startsWith("document:"),
    ),
  ).toBe(false);

  await expect
    .poll(() => panelLayoutChanges(page))
    .toContainEqual(
      expect.stringContaining(
        'panel-layout:inspector:resize-end:{"assets":{"size":272,"collapsed":false},"inspector":{"size":336,"collapsed":false}}',
      ),
    );
});

test("resizes panes by dragging the splitter", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const box = await page.getByRole("separator", { name: "Resize Assets" }).boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => paneWidth(page, "Assets")).toBe(332);
  await expect
    .poll(() => panelLayoutChanges(page))
    .toContainEqual(
      expect.stringContaining('panel-layout:assets:resize-end:{"assets":{"size":332'),
    );
});

test("collapses a pane to a rail from the toolbar and restores it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Toggle Assets" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(pane(page, "Assets")).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(() => panelLayoutChanges(page))
    .toContainEqual(
      expect.stringContaining(
        'panel-layout:assets:collapse:{"assets":{"size":272,"collapsed":true}',
      ),
    );

  await page.getByRole("button", { name: "Show Assets" }).click();
  await expect(pane(page, "Assets")).toBeVisible();
  expect(await paneWidth(page, "Assets")).toBe(272);
});

test("restores a host-provided panel layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const layout = { assets: { collapsed: true }, inspector: { size: 400 } };
  await page.goto(`/?panelLayout=${encodeURIComponent(JSON.stringify(layout))}`);

  await expect(pane(page, "Assets")).toBeHidden();
  await expect(page.getByRole("button", { name: "Show Assets" })).toBeVisible();
  expect(await paneWidth(page, "Inspector")).toBe(400);
});

test("presents panes as drawers over the editor on narrow containers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");

  const workbench = page.locator("[data-slot='timeline-workbench']");
  await expect(pane(page, "Inspector")).toBeHidden();
  await expect(page.getByRole("button", { name: "Show Inspector" })).toHaveCount(0);
  const editorBox = await getTimelineEditor(page).boundingBox();
  const workbenchBox = await workbench.boundingBox();
  // Without docked panes or rails the timeline keeps the full workbench width.
  expect(editorBox!.width).toBeGreaterThan(workbenchBox!.width - 8);

  const toggle = page.getByRole("button", { name: "Toggle Inspector" });
  await toggle.click();
  const drawer = pane(page, "Inspector");
  await expect(drawer).toBeVisible();
  await expect(drawer).toBeFocused();
  const drawerBox = await drawer.boundingBox();
  // The drawer covers the preview and timeline rows, not only the short preview row.
  expect(drawerBox!.height).toBeGreaterThan(workbenchBox!.height * 0.75);
  expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(
    workbenchBox!.x + workbenchBox!.width + 1,
  );

  // The drawer is on top of the sticky timeline ruler.
  const topmost = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x!, y!)?.closest("[data-slot='editor-pane']") !== null,
    [drawerBox!.x + drawerBox!.width / 2, drawerBox!.y + drawerBox!.height / 2],
  );
  expect(topmost).toBe(true);

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("keeps the toolbar on one scrollable row on narrow containers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");

  const toolbar = page.getByRole("toolbar", { name: "Timeline commands" });
  await expect(toolbar).toHaveAttribute("data-overflow", "scroll");
  const box = await toolbar.boundingBox();
  expect(box!.height).toBeLessThan(64);
  const overflow = await toolbar.evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("moves between toolbar commands with arrow keys from a single tab stop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const toggleAssets = page.getByRole("button", { name: "Toggle Assets" });
  const toggleInspector = page.getByRole("button", { name: "Toggle Inspector" });
  await toggleAssets.focus();
  await expect(toggleAssets).toHaveAttribute("tabindex", "0");
  await expect(toggleInspector).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("ArrowRight");
  await expect(toggleInspector).toBeFocused();
});
