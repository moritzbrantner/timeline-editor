import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

export function linkWorkspaceRootPeer(rootDir, packageDirectory, packageJson, rootPackageJson) {
  const rootPackageName = rootPackageJson.name;

  if (!packageJson.peerDependencies?.[rootPackageName]) {
    return;
  }

  const linkPath = path.join(packageDirectory, "node_modules", ...rootPackageName.split("/"));
  mkdirSync(path.dirname(linkPath), { recursive: true });
  rmSync(linkPath, { force: true, recursive: true });
  symlinkSync(rootDir, linkPath, process.platform === "win32" ? "junction" : "dir");
}
