import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { linkWorkspaceRootPeer } from "./local-peer-resolution.mjs";

const rootDir = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const packageJson = readJson(path.join(rootDir, "package.json"));
const distDir = path.join(rootDir, "dist");
const forbiddenRuntimeImports = [
  '"react"',
  '"react/jsx-runtime"',
  '"@moritzbrantner/ui"',
  '"@moritzbrantner/ui/labs"',
];
const expectedSplitPackages = new Map([
  ["@timeline-editor/audio", { directory: "audio", hasWorkerExport: true }],
  ["@timeline-editor/captions", { directory: "captions", hasWorkerExport: true }],
  ["@timeline-editor/compute", { directory: "compute", hasWorkerExport: false }],
  ["@timeline-editor/data", { directory: "data", hasWorkerExport: true }],
  ["@timeline-editor/geo", { directory: "geo", hasWorkerExport: true }],
  ["@timeline-editor/image", { directory: "image", hasWorkerExport: true }],
  ["@timeline-editor/tauri", { directory: "tauri", hasWorkerExport: false }],
  ["@timeline-editor/video", { directory: "video", hasWorkerExport: true }],
]);

assertPackageExportTargets(rootDir, packageJson, packageJson.name);
await importPackageExports(rootDir, packageJson);

assert(
  packageJson.peerDependencies?.react === "^19.0.0" &&
    packageJson.peerDependencies?.["react-dom"] === "^19.0.0",
  "React peer dependency contract changed",
);

assertSetEqual(
  packageJson.files ?? [],
  ["dist", "src"],
  "Published root files should stay limited to dist and source exports",
);

for (const packageName of expectedSplitPackages.keys()) {
  assert(
    packageJson.name !== packageName,
    `Split package ${packageName} must not be published from the root package`,
  );
}

await Promise.all(
  [...expectedSplitPackages].map(async ([packageName, expectedPackage]) => {
    const splitPackageDir = path.join(rootDir, "packages", expectedPackage.directory);
    const splitPackageJson = readJson(path.join(splitPackageDir, "package.json"));
    linkWorkspaceRootPeer(rootDir, splitPackageDir, splitPackageJson, packageJson);

    assert(splitPackageJson.name === packageName, `${packageName} package name changed`);
    assert(splitPackageJson.version === "0.1.0", `${packageName} version changed`);
    assert(splitPackageJson.private === false, `${packageName} should be publishable`);
    assert(splitPackageJson.license === "MIT", `${packageName} license changed`);
    assert(splitPackageJson.sideEffects === false, `${packageName} should stay side-effect free`);
    assertSetEqual(
      splitPackageJson.files ?? [],
      ["dist"],
      `${packageName} published files should stay limited to dist`,
    );
    assert(
      splitPackageJson.publishConfig?.registry === "https://registry.npmjs.org" &&
        splitPackageJson.publishConfig?.access === "public",
      `${packageName} publishConfig changed`,
    );
    assert(splitPackageJson.exports?.["."], `${packageName} is missing a root export`);

    if (expectedPackage.hasWorkerExport) {
      assert(splitPackageJson.exports?.["./worker"], `${packageName} is missing a worker export`);
    } else {
      assert(
        !splitPackageJson.exports?.["./worker"],
        `${packageName} should not expose a worker export`,
      );
    }

    assertPackageExportTargets(splitPackageDir, splitPackageJson, packageName);
    await importPackageExports(splitPackageDir, splitPackageJson);
  }),
);

const packageDirectories = readdirSync(path.join(rootDir, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));
assertSetEqual(
  packageDirectories,
  [...expectedSplitPackages.values()].map((entry) => entry.directory),
  "Workspace split package directories changed",
);

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

process.exit(0);

function assertPackageExportTargets(packageDirectory, packageManifest, packageName) {
  assert(
    packageManifest.exports &&
      typeof packageManifest.exports === "object" &&
      !Array.isArray(packageManifest.exports),
    `${packageName} must define object package exports`,
  );

  for (const [subpath, exportTarget] of Object.entries(packageManifest.exports)) {
    assert(
      "import" in exportTarget,
      `${packageName} export ${subpath} is missing an import target`,
    );
    assert("types" in exportTarget, `${packageName} export ${subpath} is missing a types target`);

    for (const relativePath of Object.values(exportTarget)) {
      assert(
        existsSync(path.join(packageDirectory, relativePath)),
        `${packageName} export ${subpath} target does not exist: ${relativePath}`,
      );
    }
  }
}

async function importPackageExports(packageDirectory, packageManifest) {
  await Promise.all(
    Object.values(packageManifest.exports).map(async (exportTarget) => {
      await import(pathToFileURL(path.join(packageDirectory, exportTarget.import)).href);
    }),
  );
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSetEqual(actual, expected, message) {
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right));
  const sortedActual = [...actual].sort((left, right) => left.localeCompare(right));

  assert(
    sortedActual.length === sortedExpected.length &&
      sortedActual.every((value, index) => value === sortedExpected[index]),
    `${message}.\nExpected: ${sortedExpected.join(", ")}\nActual: ${sortedActual.join(", ")}`,
  );
}
