import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const distDir = path.join(rootDir, "dist");
const forbiddenRuntimeImports = [
  '"react"',
  '"react/jsx-runtime"',
  '"@moritzbrantner/ui"',
  '"@moritzbrantner/ui/labs"',
];

const entryFiles = [
  "index.js",
  "core.js",
  "react.js",
  "commands.js",
  "history.js",
  "serialization.js",
  "text.js",
  "audio.js",
  "video.js",
  "image.js",
  "data.js",
];

for (const entryFile of entryFiles) {
  const entryPath = path.join(distDir, entryFile);

  assert(existsSync(entryPath), `Missing built entry: ${entryFile}`);
}

await Promise.all(
  entryFiles.map((entryFile) => import(pathToFileURL(path.join(distDir, entryFile)).href)),
);

for (const exportTarget of Object.values(packageJson.exports)) {
  for (const relativePath of Object.values(exportTarget)) {
    assert(
      existsSync(path.join(rootDir, relativePath)),
      `Package export target does not exist: ${relativePath}`,
    );
  }
}

for (const entryFile of ["core.js", "commands.js", "history.js", "serialization.js"]) {
  const visited = new Set();
  const queue = [entryFile];

  while (queue.length > 0) {
    const file = queue.shift();

    if (!file || visited.has(file)) {
      continue;
    }

    visited.add(file);
    const filePath = path.join(distDir, file);
    const source = readFileSync(filePath, "utf8");

    for (const forbiddenImport of forbiddenRuntimeImports) {
      assert(
        !source.includes(forbiddenImport),
        `${entryFile} runtime graph unexpectedly imports ${forbiddenImport} through ${file}`,
      );
    }

    for (const importedFile of source.matchAll(
      /from\s+"\.\/([^"]+\.js)"|import\s+"\.\/([^"]+\.js)"/g,
    )) {
      queue.push(importedFile[1] ?? importedFile[2]);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
