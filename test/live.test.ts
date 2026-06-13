import { describe, expect, it } from "vitest";
import { E621Client } from "../src/runtime/http.js";

const live = process.env.E621_LIVE_TEST === "1" ? describe : describe.skip;

live("live e621 smoke", () => {
  it("can perform a read-only v2 post query", async () => {
    const client = new E621Client(
      {
        profile: "live",
        configPath: "env",
        baseUrl: process.env.E621_BASE_URL ?? "https://e621.net",
        username: process.env.E621_USERNAME ?? process.env.E621_LOGIN ?? "automated_test",
        login: process.env.E621_LOGIN,
        apiKey: process.env.E621_API_KEY
      },
      { rateLimitMs: 0 }
    );

    const result = await client.request({
      method: "GET",
      path: "/posts.json",
      query: {
        v2: true,
        mode: "basic",
        tags: "rating:s",
        limit: 1
      }
    });

    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
  });
});
