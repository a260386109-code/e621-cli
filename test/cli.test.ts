import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const tsx = resolve("node_modules/tsx/dist/cli.mjs");
const cli = resolve("src/cli.ts");

async function runCli(args: string[]) {
  return execFileAsync(process.execPath, [tsx, cli, ...args], {
    cwd: resolve("."),
    env: { ...process.env, E621_CONFIG_DIR: resolve("test/fixtures/config") },
    maxBuffer: 1024 * 1024 * 8
  });
}

describe("CLI", () => {
  it("prints command metadata as a JSON envelope", async () => {
    const { stdout } = await runCli(["commands", "--json"]);
    const parsed = JSON.parse(stdout);

    expect(parsed.ok).toBe(true);
    expect(parsed.data.curated.some((command: { name: string }) => command.name === "posts search")).toBe(true);
    expect(parsed.data.generatedApi.some((command: { commandId: string }) => command.commandId === "searchPosts")).toBe(true);
    expect(
      parsed.data.resourceAliases.some((command: { command: string; commandId: string }) => {
        return command.command === "comments search" && command.commandId === "searchComments";
      })
    ).toBe(true);
  });

  it("prints generated GET command help with method, path, and options", async () => {
    const { stdout } = await runCli(["comments", "search", "--help"]);

    expect(stdout).toContain("Usage: e621 comments search [options]");
    expect(stdout).toContain("Search Comments (GET /comments.json; operationId: searchComments)");
    expect(stdout).toContain("operationId: searchComments");
    expect(stdout).toContain("method: GET");
    expect(stdout).toContain("path: /comments.json");
    expect(stdout).toContain("--search-post-id");
  });

  it("prints generated write command help with dry-run and confirm guidance", async () => {
    const { stdout } = await runCli(["post-votes", "create", "--help"]);

    expect(stdout).toContain("Usage: e621 post-votes create [options]");
    expect(stdout).toContain("Create Post Vote (POST /posts/{id}/votes.json; operationId: createPostVote)");
    expect(stdout).toContain("--dry-run");
    expect(stdout).toContain("--confirm [operationId]");
    expect(stdout).toContain("--score");
    expect(stdout).toContain("Real request requires --confirm createPostVote.");
  });

  it("supports dry-run for generated post search", async () => {
    const { stdout } = await runCli(["api", "searchPosts", "--tags", "rating:s", "--limit", "1", "--dry-run"]);
    const parsed = JSON.parse(stdout);

    expect(parsed.ok).toBe(true);
    expect(parsed.data.url).toContain("v2=true");
    expect(parsed.data.url).toContain("mode=basic");
  });

  it("supports dry-run for generated resource GET commands", async () => {
    const { stdout } = await runCli(["comments", "search", "--search-post-id", "123", "--dry-run"]);
    const parsed = JSON.parse(stdout);

    expect(parsed.ok).toBe(true);
    expect(parsed.meta.command).toBe("comments search");
    expect(parsed.meta.operationId).toBe("searchComments");
    expect(parsed.data.method).toBe("GET");
    expect(parsed.data.url).toContain("/comments.json");
    expect(parsed.data.url).toContain("search%5Bpost_id%5D=123");
  });

  it("requires confirmation for generated resource write commands", async () => {
    await expect(runCli(["post-votes", "create", "--id", "123", "--score", "1"])).rejects.toMatchObject({
      stdout: expect.stringContaining("ConfirmationRequired")
    });

    const { stdout } = await runCli(["post-votes", "create", "--id", "123", "--score", "1", "--dry-run"]);
    const parsed = JSON.parse(stdout);

    expect(parsed.ok).toBe(true);
    expect(parsed.meta.command).toBe("post-votes create");
    expect(parsed.data.method).toBe("POST");
    expect(parsed.data.url).toContain("/posts/123/votes.json");
    expect(parsed.data.url).toContain("score=1");
  });

  it("blocks writes without confirmation", async () => {
    await expect(runCli(["favorites", "add", "123"])).rejects.toMatchObject({
      stdout: expect.stringContaining("ConfirmationRequired")
    });
  });
});
