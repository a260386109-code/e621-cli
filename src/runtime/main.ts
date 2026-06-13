import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isMainModule(importMetaUrl: string, argvPath = process.argv[1]): boolean {
  if (!argvPath) return false;

  const modulePath = fileURLToPath(importMetaUrl);
  return normalizePath(realpathOrResolve(modulePath)) === normalizePath(realpathOrResolve(argvPath));
}

function realpathOrResolve(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return resolve(path);
  }
}

function normalizePath(path: string): string {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
