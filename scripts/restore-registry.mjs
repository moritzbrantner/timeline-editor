import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

rmSync(path.join(root, "node_modules", ".coding-tooling-source-deps"), {
  recursive: true,
  force: true,
});

const result = spawnSync("bun", ["install", "--frozen-lockfile", "--force"], {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
