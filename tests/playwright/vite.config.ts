import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: path.resolve(rootDir, "tests/playwright"),
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@moritzbrantner/timeline-editor": path.resolve(rootDir, "src/index.ts"),
      "@moritzbrantner/timeline-editor/core": path.resolve(rootDir, "src/core.ts"),
      "@moritzbrantner/timeline-editor/react": path.resolve(rootDir, "src/react.tsx"),
    },
  },
});
