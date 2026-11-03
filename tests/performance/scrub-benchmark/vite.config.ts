import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Production build of the scrub benchmark page. `SCRUB_BENCHMARK_SOURCE_ROOT` points the
// package aliases at another checkout of `src/` (the runner extracts a baseline ref there),
// so one page can be built against baseline and candidate sources.
const rootDir = fileURLToPath(new URL("../../../", import.meta.url));
const sourceRoot = path.resolve(
  process.env.SCRUB_BENCHMARK_SOURCE_ROOT ?? path.resolve(rootDir, "src"),
);

export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  base: "./",
  plugins: [tailwindcss()],
  logLevel: "warn",
  build: {
    // Keep function names readable for the optional CPU profile attribution.
    minify: false,
    reportCompressedSize: false,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code !== "MODULE_LEVEL_DIRECTIVE") {
          warn(warning);
        }
      },
    },
  },
  resolve: {
    alias: [
      { find: /^react$/, replacement: path.resolve(rootDir, "node_modules/react/index.js") },
      {
        find: /^react\/jsx-runtime$/,
        replacement: path.resolve(rootDir, "node_modules/react/jsx-runtime.js"),
      },
      {
        find: /^react-dom$/,
        replacement: path.resolve(rootDir, "node_modules/react-dom/index.js"),
      },
      {
        find: /^react-dom\/client$/,
        replacement: path.resolve(rootDir, "node_modules/react-dom/client.js"),
      },
      { find: /^@scrub-benchmark-source\/(.*)$/, replacement: `${sourceRoot}/$1` },
    ],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
