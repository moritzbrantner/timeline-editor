import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const rootDir = resolve(new URL("../..", import.meta.url).pathname);
const outputDir = resolve(rootDir, "test-results/unlighthouse-site");
const site = process.env.UNLIGHTHOUSE_SITE ?? "http://127.0.0.1:4173";
const budget = process.env.UNLIGHTHOUSE_BUDGET ?? "50";
const port = new URL(site).port || "4173";

function run(command, args, options = {}) {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      shell: process.platform === "win32",
      stdio: "inherit",
      ...options,
    });

    child.on("error", rejectProcess);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveProcess();
        return;
      }

      rejectProcess(
        new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit code ${code}`}`),
      );
    });
  });
}

function start(command, args) {
  return spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
}

async function waitForSite(url) {
  const deadline = Date.now() + 20_000;

  async function poll() {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {}

    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${url}`);
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    await poll();
  }

  await poll();
}

await mkdir(outputDir, { recursive: true });

await run("bunx", [
  "vite",
  "build",
  "--config",
  "src/react/workbench/playwright/vite.config.ts",
  "--outDir",
  outputDir,
  "--emptyOutDir",
]);

const server = start("bunx", [
  "vite",
  "preview",
  "--config",
  "src/react/workbench/playwright/vite.config.ts",
  "--host",
  "127.0.0.1",
  "--port",
  port,
  "--outDir",
  outputDir,
]);

try {
  await waitForSite(site);
  await run("bunx", [
    "unlighthouse-ci",
    "--config-file",
    "unlighthouse.config.ts",
    "--site",
    site,
    "--urls",
    "/",
    "--budget",
    budget,
    "--reporter",
    "json",
  ]);
} finally {
  server.kill();
}
