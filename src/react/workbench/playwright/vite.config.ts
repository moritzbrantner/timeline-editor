import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL("../../../../", import.meta.url));

const timelineEditorPlaywrightAlias = [
  {
    find: /^react$/,
    replacement: path.resolve(rootDir, "node_modules/react/index.js"),
  },
  {
    find: /^react\/jsx-runtime$/,
    replacement: path.resolve(rootDir, "node_modules/react/jsx-runtime.js"),
  },
  {
    find: /^react\/jsx-dev-runtime$/,
    replacement: path.resolve(rootDir, "node_modules/react/jsx-dev-runtime.js"),
  },
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
    find: "@moritzbrantner/timeline-editor/media-import",
    replacement: path.resolve(rootDir, "src/media-import.ts"),
  },
  {
    find: "@moritzbrantner/timeline-editor/extensions",
    replacement: path.resolve(rootDir, "src/extensions.ts"),
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
  root: path.resolve(rootDir, "src/react/workbench/playwright"),
  publicDir: path.resolve(rootDir, "examples"),
  plugins: [tailwindcss()],
  resolve: {
    alias: timelineEditorPlaywrightAlias,
  },
});
