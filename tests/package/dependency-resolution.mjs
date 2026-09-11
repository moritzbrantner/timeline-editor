import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const packageDirectories = [
  rootDir,
  "audio",
  "captions",
  "compute",
  "data",
  "geo",
  "image",
  "tauri",
  "video",
].map((directory) =>
  directory === rootDir ? directory : path.join(rootDir, "packages", directory),
);

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "timeline-editor-consumer-"));

try {
  const tarballDirectory = path.join(temporaryRoot, "packages");
  mkdirSync(tarballDirectory);
  const packages = packageDirectories.map((directory) => packPackage(directory, tarballDirectory));

  verifyConsumer("minimum", packages, ["react@19.0.0", "react-dom@19.0.0"]);
  verifyConsumer("fresh", packages, ["react@^19.0.0", "react-dom@^19.0.0"]);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function packPackage(directory, destination) {
  const manifest = readJson(path.join(directory, "package.json"));
  const result = run(
    "npm",
    ["pack", "--ignore-scripts", "--json", "--pack-destination", destination],
    directory,
  );
  const metadata = JSON.parse(result.stdout);
  const filename = metadata[0]?.filename;

  assert(filename, `${manifest.name} did not produce a package tarball`);
  return {
    name: manifest.name,
    version: manifest.version,
    tarball: path.join(destination, filename),
  };
}

function verifyConsumer(mode, packages, peerSpecs) {
  const consumerDirectory = path.join(temporaryRoot, mode);
  const packageSpecs = packages.map(({ tarball }) => tarball);
  const expectedPackages = new Map(packages.map(({ name, version }) => [name, version]));

  mkdirSync(consumerDirectory);
  writeFileSync(
    path.join(consumerDirectory, "package.json"),
    JSON.stringify({ name: `timeline-editor-${mode}-consumer`, private: true, version: "0.0.0" }),
    { encoding: "utf8", flag: "wx" },
  );
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--package-lock-only",
      "--no-audit",
      "--no-fund",
      ...packageSpecs,
      ...peerSpecs,
    ],
    consumerDirectory,
  );

  const lockfile = readJson(path.join(consumerDirectory, "package-lock.json"));
  for (const [name, expectedVersion] of expectedPackages) {
    const installed = lockfile.packages?.[`node_modules/${name}`];
    assert(installed?.version === expectedVersion, `${mode} consumer did not resolve ${name}`);
    assert(
      installed.resolved?.startsWith("file:"),
      `${mode} consumer did not resolve ${name} from its source tarball`,
    );
  }

  const reactVersion = lockfile.packages?.["node_modules/react"]?.version;
  const reactDomVersion = lockfile.packages?.["node_modules/react-dom"]?.version;
  assert(reactVersion && reactDomVersion, `${mode} consumer did not resolve the React peer pair`);
  process.stdout.write(`${mode}: react ${reactVersion}, react-dom ${reactDomVersion}\n`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      [`${command} ${args.join(" ")} failed`, result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
