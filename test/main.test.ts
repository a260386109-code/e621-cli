import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { isMainModule } from "../src/runtime/main.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "e621-main-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("isMainModule", () => {
  it("matches the same file through a linked argv path", async () => {
    const realDir = join(dir, "real");
    const linkedDir = join(dir, "linked");
    await mkdir(realDir);
    const realFile = join(realDir, "cli.js");
    const linkedFile = join(linkedDir, "cli.js");
    await writeFile(realFile, "console.log('ok')", "utf8");
    await symlink(realDir, linkedDir, process.platform === "win32" ? "junction" : "dir");

    expect(isMainModule(pathToFileURL(realFile).href, linkedFile)).toBe(true);
  });
});
