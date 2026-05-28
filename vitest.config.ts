import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));

const alias = [
  {
    find: "@moritzbrantner/timeline-editor/core",
    replacement: path.resolve(rootDir, "src/core.ts"),
  },
  {
    find: "@moritzbrantner/timeline-editor/react",
    replacement: path.resolve(rootDir, "src/react.tsx"),
  },
  {
    find: "@moritzbrantner/timeline-editor/media-types",
    replacement: path.resolve(rootDir, "src/media-types.ts"),
  },
  {
    find: "@moritzbrantner/timeline-editor/text",
    replacement: path.resolve(rootDir, "src/text.ts"),
  },
  {
    find: "@moritzbrantner/timeline-editor/audio",
    replacement: path.resolve(rootDir, "src/audio.ts"),
  },
  {
    find: "@moritzbrantner/timeline-editor/video",
    replacement: path.resolve(rootDir, "src/video.ts"),
  },
  {
    find: "@moritzbrantner/timeline-editor/image",
    replacement: path.resolve(rootDir, "src/image.ts"),
  },
  {
    find: "@moritzbrantner/timeline-editor/data",
    replacement: path.resolve(rootDir, "src/data.ts"),
  },
  {
    find: /^@moritzbrantner\/timeline-editor$/,
    replacement: path.resolve(rootDir, "src/index.ts"),
  },
];

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        },
      },
      {
        plugins: [storybookTest({ configDir: ".storybook" })],
        resolve: { alias },
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
