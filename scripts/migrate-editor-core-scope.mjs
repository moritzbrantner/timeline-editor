import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const oldName = "@moritzbrantner/editor-core";
const newName = "@moenarch/editor-core";

const matched = spawnSync("git", ["grep", "-l", "-F", oldName, "--", ".", ":!bun.lock"], {
  cwd: rootDir,
  encoding: "utf8",
});
if (matched.status !== 0 && matched.status !== 1) {
  throw new Error(`git grep failed with status ${matched.status}`);
}

for (const relativePath of matched.stdout.split("\n").filter(Boolean)) {
  const filePath = path.join(rootDir, relativePath);
  const source = await readFile(filePath, "utf8");
  await writeFile(filePath, source.replaceAll(oldName, newName));
}

const packagePath = path.join(rootDir, "package.json");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
delete packageJson.dependencies?.[oldName];
packageJson.dependencies ??= {};
packageJson.dependencies[newName] = "^0.4.1";
packageJson.dependencies = Object.fromEntries(
  Object.entries(packageJson.dependencies).sort(([left], [right]) => left.localeCompare(right)),
);
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const sourceDepsPath = path.join(rootDir, "scripts/source-deps.mjs");
let sourceDeps = await readFile(sourceDepsPath, "utf8");
sourceDeps = sourceDeps.replace(
  'acceptedSourceNames: ["@moenarch/editor-core", "@moenarch/editor-core"],',
  'acceptedSourceNames: ["@moenarch/editor-core"],',
);
await writeFile(sourceDepsPath, sourceDeps);
