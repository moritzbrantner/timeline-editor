import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const forbiddenRuntimeImportPatterns = [
  /from\s+["']@moritzbrantner\/timeline-(map|story|subtitles)["']/,
  /from\s+["']@moritzbrantner\/media-editor[^"']*["']/,
  /from\s+["']@timeline-editor\/(audio|video|captions|map|story|subtitles)["']/,
  /from\s+["'][^"']*(ffmpeg|webcodecs|wasm|rust)[^"']*["']/i,
  /import\s+["'][^"']*(ffmpeg|webcodecs|wasm|rust)[^"']*["']/i,
];

describe("generic package dependency boundary", () => {
  test("src does not import future domain or heavy media packages", () => {
    const files = [
      ...listSourceFiles(path.resolve(process.cwd(), "src")),
      path.resolve(process.cwd(), "package.json"),
    ];
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");

      return forbiddenRuntimeImportPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${path.relative(process.cwd(), file)} matched ${pattern}`);
    });

    expect(violations).toEqual([]);
  });
});

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    return stats.isDirectory() ? listSourceFiles(entryPath) : [entryPath];
  });

  return entries.filter(
    (entry) => (entry.endsWith(".ts") || entry.endsWith(".tsx")) && !entry.endsWith(".d.ts"),
  );
}
