// oxlint-disable no-console, no-await-in-loop -- sequential measurements reported on the CLI.
// Real-browser scrub benchmark for many mounted clips (issue #75).
//
//   bun run bench:scrub
//   bun run bench:scrub -- --baseline origin/main
//   bun run bench:scrub -- --baseline origin/main --surfaces editor --passes 5 --cpu-throttle 4
//   bun run bench:scrub -- --profile
//   bun run bench:scrub -- --chromium /path/to/chrome   # use an existing Chromium build
//
// Builds `tests/performance/scrub-benchmark/` with production React against the working tree
// (`candidate`) and, with `--baseline <git-ref>`, against `src/` extracted from that ref. Each
// pass loads a fresh Chromium page per variant and surface (variant order alternates per pass),
// mounts 40 tracks x 50 clips, and changes only `document.currentTimeMs` for every tick.
// Reported numbers are medians of per-pass medians; JSON is written to test-results/.
import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

const rootDir = resolve(new URL("../..", import.meta.url).pathname);
const workDir = resolve(rootDir, "test-results/scrub-benchmark");

const { values: options } = parseArgs({
  options: {
    baseline: { type: "string" },
    surfaces: { type: "string", default: "editor,workbench" },
    passes: { type: "string", default: "3" },
    ticks: { type: "string", default: "120" },
    warmup: { type: "string", default: "20" },
    tracks: { type: "string", default: "40" },
    "clips-per-track": { type: "string", default: "50" },
    "cpu-throttle": { type: "string", default: "1" },
    profile: { type: "boolean", default: false },
    "skip-build": { type: "boolean", default: false },
    // Use a specific Chromium build instead of the one bundled with Playwright.
    chromium: { type: "string" },
  },
});

const passes = Number(options.passes);
const ticks = Number(options.ticks);
const warmupTicks = Number(options.warmup);
const cpuThrottle = Number(options["cpu-throttle"]);
const surfaces = options.surfaces.split(",").map((surface) => surface.trim());

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: { ...process.env, ...env },
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, { cwd: rootDir, encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  }

  return result.stdout.trim();
}

async function extractSource(ref) {
  const sha = capture("git", ["rev-parse", "--short", ref]);
  const target = resolve(workDir, `source-${sha}`);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const archive = spawnSync("git", ["archive", "--format=tar", ref, "src"], {
    cwd: rootDir,
    maxBuffer: 1024 * 1024 * 512,
  });

  if (archive.status !== 0) {
    throw new Error(`git archive ${ref} failed: ${archive.stderr}`);
  }

  const untar = spawnSync("tar", ["-x", "-C", target], { input: archive.stdout });

  if (untar.status !== 0) {
    throw new Error(`tar failed: ${untar.stderr}`);
  }

  return { sha, sourceRoot: resolve(target, "src") };
}

function buildVariant(name, sourceRoot) {
  run(
    "bunx",
    [
      "vite",
      "build",
      "--config",
      "tests/performance/scrub-benchmark/vite.config.ts",
      "--outDir",
      resolve(workDir, name),
      "--emptyOutDir",
    ],
    { SCRUB_BENCHMARK_SOURCE_ROOT: sourceRoot, NODE_ENV: "production" },
  );
}

const contentTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function startServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const filePath = join(workDir, decodeURIComponent(url.pathname));

    if (!filePath.startsWith(workDir)) {
      response.writeHead(403).end();
      return;
    }

    try {
      const resolvedPath = (await stat(filePath)).isDirectory()
        ? join(filePath, "index.html")
        : filePath;
      response.writeHead(200, {
        "content-type": contentTypes[extname(resolvedPath)] ?? "application/octet-stream",
      });
      createReadStream(resolvedPath).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });

  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function summarizeProfile(profile, top = 12) {
  const selfTimeByName = new Map();
  const nodeById = new Map(profile.nodes.map((node) => [node.id, node]));
  const deltas = profile.timeDeltas ?? [];

  profile.samples.forEach((nodeId, index) => {
    const node = nodeById.get(nodeId);
    const name = node?.callFrame.functionName || "(anonymous)";
    selfTimeByName.set(name, (selfTimeByName.get(name) ?? 0) + (deltas[index] ?? 0) / 1_000);
  });

  return [...selfTimeByName.entries()]
    .filter(([name]) => name !== "(idle)")
    .sort((left, right) => right[1] - left[1])
    .slice(0, top)
    .map(([name, selfMs]) => ({ name, selfMs: Number(selfMs.toFixed(1)) }));
}

async function measure(browser, baseUrl, variant, surface) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const cdp = await page.context().newCDPSession(page);

  if (cpuThrottle > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
  }

  const query = new URLSearchParams({
    surface,
    tracks: options.tracks,
    clipsPerTrack: options["clips-per-track"],
  });
  await page.goto(`${baseUrl}/${variant}/?${query}`);
  await page.waitForFunction(() => window.timelineScrubBenchmark?.ready === true, undefined, {
    timeout: 120_000,
  });

  if (options.profile) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.start");
  }

  const result = await page.evaluate(
    (runOptions) => window.timelineScrubBenchmark.run(runOptions),
    {
      warmupTicks,
      ticks,
    },
  );
  const profile = options.profile ? (await cdp.send("Profiler.stop")).profile : undefined;
  await page.close();

  return {
    mountedClips: result.mountedClips,
    commitMedianMs: median(result.samples.map((sample) => sample.commitMs)),
    commitP95Ms: percentile(
      result.samples.map((sample) => sample.commitMs),
      0.95,
    ),
    frameMedianMs: median(result.samples.map((sample) => sample.frameMs)),
    indexBuildMs: result.indexBuildMs,
    profileTop: profile ? summarizeProfile(profile) : undefined,
  };
}

await mkdir(workDir, { recursive: true });
const variants = [
  { name: "candidate", label: "working tree", sourceRoot: resolve(rootDir, "src") },
];

if (options.baseline) {
  const { sha, sourceRoot } = await extractSource(options.baseline);
  variants.unshift({ name: "baseline", label: `${options.baseline} (${sha})`, sourceRoot });
}

if (!options["skip-build"]) {
  for (const variant of variants) {
    console.log(`Building ${variant.name} from ${variant.label}`);
    buildVariant(variant.name, variant.sourceRoot);
  }
}

const server = await startServer();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: options.chromium });
const chromiumVersion = browser.version();
const runs = [];

try {
  for (let pass = 0; pass < passes; pass += 1) {
    const ordered = pass % 2 === 0 ? variants : [...variants].reverse();

    for (const surface of surfaces) {
      for (const variant of ordered) {
        const measurement = await measure(browser, baseUrl, variant.name, surface);
        runs.push({ pass, surface, variant: variant.name, ...measurement });
        console.log(
          `pass ${pass + 1}/${passes} ${surface.padEnd(9)} ${variant.name.padEnd(9)} ` +
            `clips=${measurement.mountedClips} commit=${measurement.commitMedianMs.toFixed(2)}ms ` +
            `p95=${measurement.commitP95Ms.toFixed(2)}ms frame=${measurement.frameMedianMs.toFixed(2)}ms`,
        );
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const summary = surfaces.flatMap((surface) =>
  variants.map((variant) => {
    const variantRuns = runs.filter(
      (entry) => entry.surface === surface && entry.variant === variant.name,
    );
    return {
      surface,
      variant: variant.name,
      source: variant.label,
      mountedClips: variantRuns[0]?.mountedClips,
      commitMedianMs: Number(median(variantRuns.map((entry) => entry.commitMedianMs)).toFixed(2)),
      commitP95Ms: Number(median(variantRuns.map((entry) => entry.commitP95Ms)).toFixed(2)),
      frameMedianMs: Number(median(variantRuns.map((entry) => entry.frameMedianMs)).toFixed(2)),
      indexBuildMs: Number(median(variantRuns.map((entry) => entry.indexBuildMs)).toFixed(2)),
    };
  }),
);

console.log(
  `\nScrub benchmark: ${passes} passes x ${ticks} ticks (+${warmupTicks} warmup), ` +
    `CPU throttle ${cpuThrottle}x, Chromium ${chromiumVersion}`,
);
console.table(summary);

if (options.profile) {
  for (const surface of surfaces) {
    for (const variant of variants) {
      const profiled = runs.find(
        (entry) => entry.surface === surface && entry.variant === variant.name,
      );
      console.log(`\nTop self time, ${surface} / ${variant.name} (pass 1, ms):`);
      console.table(profiled?.profileTop);
    }
  }
}

const outputPath = resolve(workDir, "results.json");
await writeFile(
  outputPath,
  `${JSON.stringify({ options, chromium: chromiumVersion, summary, runs }, null, 2)}\n`,
);
console.log(`\nWrote ${outputPath}`);
