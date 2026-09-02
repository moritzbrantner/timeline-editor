import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const contractPath = path.join(rootDir, "tests/package/export-contract.json");
const updateContract = process.env.UPDATE_EXPORT_CONTRACT === "1";

const rootPackageJson = readJson(path.join(rootDir, "package.json"));
installRootRuntimeFacade();

const splitPackageDirectories = readdirSync(path.join(rootDir, "packages"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(rootDir, "packages", entry.name))
  .filter((packageDirectory) => existsSync(path.join(packageDirectory, "package.json")))
  .sort((left, right) => left.localeCompare(right));

const splitPackages = splitPackageDirectories
  .map((packageDirectory) => ({
    directory: packageDirectory,
    packageJson: readJson(path.join(packageDirectory, "package.json")),
  }))
  .sort((left, right) => left.packageJson.name.localeCompare(right.packageJson.name));

const actualContract = {
  rootPackage: await collectExports(rootDir, rootPackageJson),
  splitPackages: Object.fromEntries(
    await Promise.all(
      splitPackages.map(async ({ directory, packageJson }) => [
        packageJson.name,
        await collectExports(directory, packageJson),
      ]),
    ),
  ),
};

if (updateContract) {
  writeFileSync(contractPath, `${JSON.stringify(actualContract, null, 2)}\n`);
  process.stdout.write(`Updated ${path.relative(rootDir, contractPath)}\n`);
  process.exit(0);
} else {
  const expectedContract = readJson(contractPath);
  const differences = diffContracts(actualContract, expectedContract);

  if (differences.length > 0) {
    throw new Error(
      [
        "Public export contract changed.",
        "Run `bun run build:packages && bun run update:export-contract` if this is intentional.",
        "",
        ...differences,
      ].join("\n"),
    );
  }

  process.exit(0);
}

function installRootRuntimeFacade() {
  const targetDir = path.join(rootDir, "node_modules", ...rootPackageJson.name.split("/"));
  const distDir = path.join(rootDir, "dist");

  assert(
    existsSync(distDir),
    "Root build output is missing. Run `bun run build:packages` before checking exports.",
  );

  rmSync(targetDir, { force: true, recursive: true });
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(rootPackageJson, null, 2)}\n`,
  );
  cpSync(distDir, path.join(targetDir, "dist"), { recursive: true });

  const stylesPath = path.join(rootDir, "styles.css");
  if (existsSync(stylesPath)) {
    cpSync(stylesPath, path.join(targetDir, "styles.css"));
  }
}

async function collectExports(packageDirectory, packageJson) {
  const packageExports = packageJson.exports;

  assert(
    packageExports && typeof packageExports === "object" && !Array.isArray(packageExports),
    `${packageJson.name} must define object package exports`,
  );

  const entries = await Promise.all(
    Object.keys(packageExports)
      .sort((left, right) => left.localeCompare(right))
      .map(async (subpath) => {
        const exportTarget = packageExports[subpath];
        validateSourceTarget(packageDirectory, packageJson, subpath, exportTarget);

        const staticTarget = resolveStaticAssetTarget(exportTarget);
        if (staticTarget) {
          assert(
            existsSync(path.resolve(packageDirectory, staticTarget)),
            `${packageJson.name} export ${subpath} static asset is missing: ${staticTarget}`,
          );
          return [subpath, []];
        }

        const importTarget = resolveImportTarget(packageJson.name, subpath, exportTarget);
        const importPath = path.resolve(packageDirectory, importTarget);

        assert(
          existsSync(importPath),
          [
            `${packageJson.name} export ${subpath} build output is missing: ${importTarget}`,
            "Run `bun run build:packages` before checking the export contract.",
          ].join("\n"),
        );

        if (subpath === "./worker") {
          return [subpath, []];
        }

        const runtime = await import(pathToFileURL(importPath).href);

        return [subpath, Object.keys(runtime).sort((left, right) => left.localeCompare(right))];
      }),
  );

  return Object.fromEntries(entries);
}

function validateSourceTarget(packageDirectory, packageJson, subpath, exportTarget) {
  if (
    !exportTarget ||
    typeof exportTarget !== "object" ||
    typeof exportTarget.source !== "string"
  ) {
    return;
  }

  assert(
    exportTarget.source.startsWith("./src/"),
    `${packageJson.name} export ${subpath} source target must resolve inside ./src`,
  );
  assert(
    existsSync(path.resolve(packageDirectory, exportTarget.source)),
    `${packageJson.name} export ${subpath} source target is missing: ${exportTarget.source}`,
  );
  assert(
    Array.isArray(packageJson.files) && packageJson.files.includes("src"),
    `${packageJson.name} must include src in package files when source exports are declared`,
  );
}

function resolveStaticAssetTarget(exportTarget) {
  const target =
    typeof exportTarget === "string"
      ? exportTarget
      : exportTarget && typeof exportTarget === "object"
        ? exportTarget.default
        : undefined;

  return typeof target === "string" && target.endsWith(".css") ? target : undefined;
}

function resolveImportTarget(packageName, subpath, exportTarget) {
  const importTarget =
    typeof exportTarget === "string"
      ? exportTarget
      : exportTarget && typeof exportTarget === "object"
        ? exportTarget.import
        : undefined;

  assert(
    typeof importTarget === "string",
    `${packageName} export ${subpath} must define an import target`,
  );
  assert(
    importTarget.endsWith(".js"),
    `${packageName} export ${subpath} import target must resolve to a built JavaScript file`,
  );

  return importTarget;
}

function diffContracts(actual, expected) {
  return [
    ...diffExportMap("rootPackage", actual.rootPackage, expected.rootPackage),
    ...diffSplitPackages(actual.splitPackages, expected.splitPackages),
  ];
}

function diffSplitPackages(actual, expected) {
  const differences = [];

  for (const packageName of sortedUnion(Object.keys(actual), Object.keys(expected))) {
    if (!(packageName in expected)) {
      differences.push(`- Added splitPackages["${packageName}"]`);
      continue;
    }

    if (!(packageName in actual)) {
      differences.push(`- Removed splitPackages["${packageName}"]`);
      continue;
    }

    differences.push(
      ...diffExportMap(
        `splitPackages["${packageName}"]`,
        actual[packageName],
        expected[packageName],
      ),
    );
  }

  return differences;
}

function diffExportMap(label, actual, expected) {
  const differences = [];

  for (const subpath of sortedUnion(Object.keys(actual ?? {}), Object.keys(expected ?? {}))) {
    if (!(subpath in expected)) {
      differences.push(`- Added ${label}["${subpath}"]: ${actual[subpath].join(", ")}`);
      continue;
    }

    if (!(subpath in actual)) {
      differences.push(`- Removed ${label}["${subpath}"]: ${expected[subpath].join(", ")}`);
      continue;
    }

    const addedExports = actual[subpath].filter(
      (exportName) => !expected[subpath].includes(exportName),
    );
    const removedExports = expected[subpath].filter(
      (exportName) => !actual[subpath].includes(exportName),
    );

    if (addedExports.length > 0) {
      differences.push(`- Added ${label}["${subpath}"]: ${addedExports.join(", ")}`);
    }

    if (removedExports.length > 0) {
      differences.push(`- Removed ${label}["${subpath}"]: ${removedExports.join(", ")}`);
    }
  }

  return differences;
}

function sortedUnion(left, right) {
  return [...new Set([...left, ...right])].sort((first, second) => first.localeCompare(second));
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
