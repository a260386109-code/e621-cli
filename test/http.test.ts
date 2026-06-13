import { describe, expect, it, vi } from "vitest";
import { E621Client } from "../src/runtime/http.js";

const config = {
  profile: "default",
  configPath: "test",
  baseUrl: "https://e621.net",
  username: "user",
  apiKey: "key"
};

describe("HTTP client", () => {
  it("sends User-Agent and Basic Auth headers without query credentials", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new E621Client(config, { fetchImpl, rateLimitMs: 0 });

    const result = await client.request({ method: "GET", path: "/posts.json", query: { limit: 1 } });

    expect(result.status).toBe(200);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://e621.net/posts.json?limit=1");
    const headers = init?.headers as Headers;
    expect(headers.get("User-Agent")).toBe("e621-cli/1.0 (by user on e621)");
    expect(headers.get("Authorization")).toBe(`Basic ${Buffer.from("user:key").toString("base64")}`);
    expect(String(url)).not.toContain("api_key");
  });

  it("retries retryable responses", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "slow down" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new E621Client(config, { fetchImpl, rateLimitMs: 0, delayMs: async () => undefined });

    await client.request({ method: "GET", path: "/posts.json" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("requires a username to build the fixed user agent", async () => {
    const client = new E621Client({ ...config, username: undefined }, { rateLimitMs: 0 });
    await expect(client.request({ method: "GET", path: "/posts.json" })).rejects.toThrow(/username is required/);
  });
});
