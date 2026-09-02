import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { mergeConfig } from "vite";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

const alias = {
  "@moritzbrantner/editor-core/react": path.resolve(
    rootDir,
    "src/react/workbench/use-controllable-editor-state.ts",
  ),
  "@moritzbrantner/timeline-editor": path.resolve(rootDir, "src/index.ts"),
  "@moritzbrantner/timeline-editor/audio": path.resolve(rootDir, "src/audio.ts"),
  "@moritzbrantner/timeline-editor/commands": path.resolve(rootDir, "src/commands.ts"),
  "@moritzbrantner/timeline-editor/core": path.resolve(rootDir, "src/core.ts"),
  "@moritzbrantner/timeline-editor/data": path.resolve(rootDir, "src/data.ts"),
  "@moritzbrantner/timeline-editor/history": path.resolve(rootDir, "src/history.ts"),
  "@moritzbrantner/timeline-editor/image": path.resolve(rootDir, "src/image.ts"),
  "@moritzbrantner/timeline-editor/media-types": path.resolve(rootDir, "src/media-types.ts"),
  "@moritzbrantner/timeline-editor/react": path.resolve(rootDir, "src/react.tsx"),
  "@moritzbrantner/timeline-editor/serialization": path.resolve(rootDir, "src/serialization.ts"),
  "@moritzbrantner/timeline-editor/text": path.resolve(rootDir, "src/text.ts"),
  "@moritzbrantner/timeline-editor/video": path.resolve(rootDir, "src/video.ts"),
};

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    builder: "@storybook/builder-vite",
  },
  viteFinal: (config) =>
    mergeConfig(config, {
      plugins: [tailwindcss()],
      resolve: { alias },
    }),
};

export default config;
