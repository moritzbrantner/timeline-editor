import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import { timelineEditorTestAlias } from "./vitest.config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const storybookPlugins = await storybookTest({ configDir: path.join(dirname, ".storybook") });

export default defineConfig({
  resolve: {
    alias: timelineEditorTestAlias,
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: storybookPlugins,
        resolve: {
          alias: timelineEditorTestAlias,
        },
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
