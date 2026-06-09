import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));

const resolveEditorCoreAlias = (subpath: string, sourceFile: string) => {
  const sourcePath = path.resolve(rootDir, "../editor-core/src", sourceFile);

  if (existsSync(sourcePath)) {
    return sourcePath;
  }

  if (subpath === "react") {
    return path.resolve(rootDir, "tests/support/editor-core-react.ts");
  }

  return path.resolve(
    rootDir,
    "node_modules/@moritzbrantner/editor-core/dist",
    `${subpath || "index"}.js`,
  );
};

export const timelineEditorTestAlias = [
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
    find: "@moritzbrantner/editor-core/history",
    replacement: resolveEditorCoreAlias("history", "history.ts"),
  },
  {
    find: "@moritzbrantner/editor-core/hotkeys",
    replacement: resolveEditorCoreAlias("hotkeys", "hotkeys.ts"),
  },
  {
    find: "@moritzbrantner/editor-core/json",
    replacement: resolveEditorCoreAlias("json", "json.ts"),
  },
  {
    find: "@moritzbrantner/editor-core/react",
    replacement: resolveEditorCoreAlias("react", "react.tsx"),
  },
  {
    find: "@moritzbrantner/editor-core/serialization",
    replacement: resolveEditorCoreAlias("serialization", "serialization.ts"),
  },
  {
    find: /^@moritzbrantner\/editor-core$/,
    replacement: resolveEditorCoreAlias("", "index.ts"),
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
  {
    find: "@timeline-editor/compute",
    replacement: path.resolve(rootDir, "packages/compute/src/index.ts"),
  },
  {
    find: "@timeline-editor/audio",
    replacement: path.resolve(rootDir, "packages/audio/src/index.ts"),
  },
  {
    find: "@timeline-editor/video",
    replacement: path.resolve(rootDir, "packages/video/src/index.ts"),
  },
  {
    find: "@timeline-editor/image",
    replacement: path.resolve(rootDir, "packages/image/src/index.ts"),
  },
  {
    find: "@timeline-editor/captions",
    replacement: path.resolve(rootDir, "packages/captions/src/index.ts"),
  },
  {
    find: "@timeline-editor/geo",
    replacement: path.resolve(rootDir, "packages/geo/src/index.ts"),
  },
  {
    find: "@timeline-editor/data",
    replacement: path.resolve(rootDir, "packages/data/src/index.ts"),
  },
  {
    find: "@timeline-editor/tauri",
    replacement: path.resolve(rootDir, "packages/tauri/src/index.ts"),
  },
];

export default defineConfig({
  resolve: {
    alias: timelineEditorTestAlias,
  },
  test: {
    name: "unit",
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "packages/**/*.test.ts"],
  },
});
