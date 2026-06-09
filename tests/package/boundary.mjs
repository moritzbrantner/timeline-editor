import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const sourceDir = path.join(rootDir, "src");
const packageJsonPath = path.join(rootDir, "package.json");
const runtimeDependencySections = ["dependencies", "peerDependencies", "optionalDependencies"];
const forbiddenImportPatterns = [
  /\bimport\s+(?:type\s+)?[^"']*from\s+["']@timeline-editor\/[^"']+["']/g,
  /\bexport\s+[^"']*from\s+["']@timeline-editor\/[^"']+["']/g,
  /\bimport\s*["']@timeline-editor\/[^"']+["']/g,
  /\bimport\s*\(\s*["']@timeline-editor\/[^"']+["']\s*\)/g,
  /\brequire\s*\(\s*["']@timeline-editor\/[^"']+["']\s*\)/g,
];

const violations = [
  ...collectSourceViolations(sourceDir),
  ...collectRuntimeDependencyViolations(packageJsonPath),
];

if (violations.length > 0) {
  throw new Error(["Root package boundary violations:", ...violations].join("\n"));
}

function collectSourceViolations(directory) {
  const sourceViolations = [];

  for (const filePath of collectSourceFiles(directory)) {
    const source = readFileSync(filePath, "utf8");
    const relativePath = toRepoRelativePath(filePath);

    for (const pattern of forbiddenImportPatterns) {
      pattern.lastIndex = 0;

      if (pattern.test(source)) {
        sourceViolations.push(`- ${relativePath} imports split package via ${pattern}`);
      }
    }
  }

  return sourceViolations;
}

function collectSourceFiles(directory) {
  const sourceFiles = [];
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (toRepoRelativePath(entryPath) === "src/react/workbench/playwright") {
        continue;
      }

      sourceFiles.push(...collectSourceFiles(entryPath));
      continue;
    }

    if (entry.isFile() && isProductionSourceFile(entryPath)) {
      sourceFiles.push(entryPath);
    }
  }

  return sourceFiles;
}

function collectRuntimeDependencyViolations(filePath) {
  const packageJson = readJson(filePath);
  const dependencyViolations = [];

  for (const section of runtimeDependencySections) {
    for (const packageName of Object.keys(packageJson[section] ?? {}).sort((left, right) =>
      left.localeCompare(right),
    )) {
      if (packageName.startsWith("@timeline-editor/")) {
        dependencyViolations.push(`- package.json ${section} lists ${packageName}`);
      }
    }
  }

  return dependencyViolations;
}

function isProductionSourceFile(filePath) {
  return (
    (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) &&
    !filePath.endsWith(".d.ts") &&
    !filePath.endsWith(".test.ts") &&
    !filePath.endsWith(".test.tsx") &&
    !filePath.endsWith(".stories.ts") &&
    !filePath.endsWith(".stories.tsx") &&
    !filePath.endsWith(".playwright.spec.ts") &&
    !filePath.endsWith(".playwright.spec.tsx")
  );
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function toRepoRelativePath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}
