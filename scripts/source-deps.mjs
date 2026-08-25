import { spawnSync } from "node:child_process";
import { access, lstat, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const dependency = {
  packageName: "@moritzbrantner/editor-core",
  sourceEnv: "EDITOR_CORE_SOURCE",
  defaultSourceDir: path.resolve(rootDir, "../editor-core"),
  acceptedSourceNames: ["@moritzbrantner/editor-core", "@moenarch/editor-core"],
};

const command = process.argv[2] ?? "status";
const sourceDir = path.resolve(process.env[dependency.sourceEnv] ?? dependency.defaultSourceDir);
const targetDir = path.join(rootDir, "node_modules", ...dependency.packageName.split("/"));
const stateDir = path.join(rootDir, "node_modules", ".editor-source-deps");
const stateFile = path.join(stateDir, `${dependency.packageName.replaceAll("/", "__")}.json`);

if (command === "prepare") {
  await prepare();
} else if (command === "restore") {
  await restore();
} else if (command === "status") {
  await status();
} else if (command === "watch") {
  await watch();
} else {
  fail(`unknown command ${JSON.stringify(command)}; use prepare, restore, status, or watch`);
}

async function prepare() {
  const sourceManifest = await readSourceManifest();
  run("bun", ["install", "--frozen-lockfile"], rootDir);
  run("bun", ["install", "--frozen-lockfile"], sourceDir);

  if (sourceManifest.scripts?.["source:prepare"]) {
    run("bun", ["run", "source:prepare"], sourceDir);
  }
  if (!sourceManifest.scripts?.build) {
    fail(`${dependency.packageName} source checkout has no build script: ${sourceDir}`);
  }
  run("bun", ["run", "build"], sourceDir);

  await mkdir(path.dirname(targetDir), { recursive: true });
  await rm(targetDir, { force: true, recursive: true });
  await symlink(sourceDir, targetDir, process.platform === "win32" ? "junction" : "dir");

  const revision = run("git", ["rev-parse", "HEAD"], sourceDir, true).trim();
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    stateFile,
    `${JSON.stringify(
      {
        packageName: dependency.packageName,
        sourcePackageName: sourceManifest.name,
        sourceDir,
        revision,
      },
      null,
      2,
    )}\n`,
  );

  process.stdout.write(
    `source dependency ready: ${dependency.packageName} -> ${sourceDir} @ ${revision.slice(0, 12)}\n`,
  );
}

async function restore() {
  await rm(targetDir, { force: true, recursive: true });
  await rm(stateFile, { force: true });
  run("bun", ["install", "--frozen-lockfile", "--force"], rootDir);
  process.stdout.write(`registry dependency restored: ${dependency.packageName}\n`);
}

async function status() {
  const linked = await isSymlink(targetDir);
  if (!linked) {
    process.stdout.write(`registry dependency active: ${dependency.packageName}\n`);
    return;
  }

  const resolved = await realpath(targetDir);
  let state;
  try {
    state = JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    state = undefined;
  }
  const suffix = state?.revision ? ` @ ${state.revision.slice(0, 12)}` : "";
  process.stdout.write(
    `source dependency active: ${dependency.packageName} -> ${resolved}${suffix}\n`,
  );
}

async function watch() {
  const sourceManifest = await readSourceManifest();
  if (!sourceManifest.scripts?.build) {
    fail(`${dependency.packageName} source checkout has no build script: ${sourceDir}`);
  }
  process.stdout.write(`watching source dependency: ${dependency.packageName} -> ${sourceDir}\n`);
  const result = spawnSync("bun", ["run", "build", "--", "--watch"], {
    cwd: sourceDir,
    env: process.env,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

async function readSourceManifest() {
  try {
    await access(path.join(sourceDir, "package.json"));
  } catch {
    fail(
      `missing ${dependency.packageName} source checkout at ${sourceDir}; set ${dependency.sourceEnv} to override`,
    );
  }

  const manifest = JSON.parse(await readFile(path.join(sourceDir, "package.json"), "utf8"));
  if (!dependency.acceptedSourceNames.includes(manifest.name)) {
    fail(
      `expected ${dependency.acceptedSourceNames.join(" or ")} at ${sourceDir}, found ${manifest.name ?? "unnamed package"}`,
    );
  }
  return manifest;
}

async function isSymlink(filePath) {
  try {
    return (await lstat(filePath)).isSymbolicLink();
  } catch {
    return false;
  }
}

function run(executable, args, cwd, capture = false) {
  const result = spawnSync(executable, args, {
    cwd,
    env: process.env,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.status !== 0) {
    fail(`${executable} ${args.join(" ")} failed in ${cwd}`);
  }
  return capture ? result.stdout : "";
}

function fail(message) {
  process.stderr.write(`source dependency error: ${message}\n`);
  process.exit(1);
}
