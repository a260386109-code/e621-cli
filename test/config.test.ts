import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfigFile, redactConfig, resolveConfig, saveConfigFile } from "../src/runtime/config.js";

let dir: string;
const originalEnv = { ...process.env };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "e621-cli-test-"));
  process.env = { ...originalEnv };
});

afterEach(async () => {
  process.env = { ...originalEnv };
  await rm(dir, { recursive: true, force: true });
});

describe("config", () => {
  it("loads, saves, and resolves profile config", async () => {
    const configPath = join(dir, "config.json");
    await saveConfigFile(
      {
        defaultProfile: "work",
        profiles: {
          work: {
            baseUrl: "https://e926.net",
            username: "name",
            apiKey: "secret"
          }
        }
      },
      configPath
    );

    const file = await loadConfigFile(configPath);
    expect(file.defaultProfile).toBe("work");

    const resolved = await resolveConfig({ configPath });
    expect(resolved.profile).toBe("work");
    expect(resolved.baseUrl).toBe("https://e926.net");
    expect(resolved.username).toBe("name");
    expect(resolved.apiKey).toBe("secret");
  });

  it("lets environment variables override file values", async () => {
    const configPath = join(dir, "config.json");
    await saveConfigFile({ defaultProfile: "default", profiles: { default: { baseUrl: "https://e621.net" } } }, configPath);

    process.env.E621_BASE_URL = "https://example.test/";
    process.env.E621_USERNAME = "env-user";

    const resolved = await resolveConfig({ configPath });
    expect(resolved.baseUrl).toBe("https://example.test");
    expect(resolved.username).toBe("env-user");
  });

  it("keeps legacy login config as a username fallback", async () => {
    const configPath = join(dir, "config.json");
    await saveConfigFile({ defaultProfile: "default", profiles: { default: { login: "legacy-user" } } }, configPath);

    const resolved = await resolveConfig({ configPath });
    expect(resolved.username).toBe("legacy-user");
  });

  it("redacts API keys", () => {
    const redacted = redactConfig({
      defaultProfile: "default",
      profiles: {
        default: {
          apiKey: "secret"
        }
      }
    });

    expect(redacted.profiles.default.apiKey).toBe("[redacted]");
  });
});
