import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Timeline Editor Playground" })).toBeVisible();
});

test("switches between media, story/animation and dense editing workloads", async ({ page }) => {
  const picker = page.getByLabel("Try an example");
  await expect(picker).toHaveValue("media");
  await expect(page.getByText("Opening shot", { exact: true }).first()).toBeVisible();

  await picker.selectOption("story");
  await expect(page).toHaveURL(/scenario=story/);
  await expect(page.getByText("Reveal scene", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Wave and turn", { exact: true }).first()).toBeVisible();

  await picker.selectOption("dense");
  await expect(page).toHaveURL(/scenario=dense/);
  await expect(page.getByText("Track 1", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(picker).toHaveValue("dense");
});

test("shared settings persist and affect the active editor", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  const readonly = page.getByRole("checkbox", { name: "Read-only" });
  await expect(readonly).toBeEnabled();
  await readonly.check();
  await expect(readonly).toBeChecked();
  await expect(page.getByRole("status")).toContainText("updated through shared settings");

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("checkbox", { name: "Read-only" })).toBeChecked();
  await page.getByRole("button", { name: "Reset preferences" }).click();
  await expect(page.getByRole("checkbox", { name: "Read-only" })).not.toBeChecked();
});

test("shared input runtime dispatches shortcuts and respects binding-editor ownership", async ({
  page,
  isMobile,
}) => {
  // Mobile Chromium can use a hardware keyboard, but the Web input runtime must not
  // capture keys while its own input editor is open.
  await page.keyboard.press("F8");
  await expect(page.getByLabel("Try an example")).toHaveValue("story");

  await page.getByRole("button", { name: "Input bindings" }).click();
  await expect(page.getByRole("heading", { name: "Timeline input bindings" })).toBeVisible();
  await expect(page.getByText("Next example", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("F8");
  await expect(page.getByLabel("Try an example")).toHaveValue("story");

  await page.getByRole("button", { name: "Input bindings" }).click();
  await page.keyboard.press("F9");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("checkbox", { name: "Read-only" })).toBeChecked();
  if (!isMobile) await page.screenshot({ path: "test-results/timeline-playground-settings.png" });
});

test("media fixtures are served from the example origin", async ({ request }) => {
  await Promise.all(
    ["timeline-preview-fixture.webm", "timeline-preview-fixture.wav"].map(async (fixture) => {
      const response = await request.get(`/${fixture}`);
      expect(response.ok(), `${fixture} should be served`).toBeTruthy();
    }),
  );
});
