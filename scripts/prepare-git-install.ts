#!/usr/bin/env bun

// The `prepare` script. It only acts when the package sits below node_modules, which is where
// bun places a consumer's commit-pinned git dependency (listed in `trustedDependencies`).
// bun does not install a git dependency's devDependencies, and below node_modules esbuild
// ignores tsconfig.json and TypeScript emits no declarations. So the build runs in a copy
// outside node_modules with its own frozen install, and only the build output is copied back.
// The dependency's own node_modules, which bun resolved for the consumer, is left untouched.
// The copy's install runs lifecycle scripts so that commit-pinned owner git dependencies listed
// in `trustedDependencies` (such as @moritzbrantner/ui) build their own dist via their prepare,
// which the type build here needs. The copy's own prepare is a no-op: it is not below node_modules.
// In a normal checkout it does nothing: `bun install` and `npm pack` (npm 10 runs prepare
// despite --ignore-scripts) must stay side-effect free there.

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const buildOutputs = ["dist"];
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(args: string[], cwd: string) {
  execFileSync("bun", args, { cwd, stdio: "inherit" });
}

if (packageRoot.split(path.sep).includes("node_modules")) {
  const buildRoot = mkdtempSync(path.join(tmpdir(), "git-install-build-"));
  const skipped = new Set(
    ["node_modules", ".git", ...buildOutputs].map((entry) => path.join(packageRoot, entry)),
  );

  try {
    cpSync(packageRoot, buildRoot, {
      recursive: true,
      filter: (source) => !skipped.has(source),
    });
    run(["install", "--frozen-lockfile"], buildRoot);
    run(["run", "build"], buildRoot);

    for (const output of buildOutputs) {
      rmSync(path.join(packageRoot, output), { recursive: true, force: true });
      cpSync(path.join(buildRoot, output), path.join(packageRoot, output), { recursive: true });
    }
  } finally {
    rmSync(buildRoot, { recursive: true, force: true });
  }
}
