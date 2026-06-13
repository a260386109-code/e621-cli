import { describe, expect, it } from "vitest";
import { loadOpenApiRegistry } from "../src/openapi/registry.js";

describe("OpenAPI registry", () => {
  it("loads the vendored e621 OpenAPI spec", async () => {
    const registry = await loadOpenApiRegistry();

    expect(registry.operations.length).toBeGreaterThan(100);
    expect(registry.byOperationId.get("searchPosts")?.path).toBe("/posts.json");
    expect(registry.byOperationId.get("getPost")?.path).toBe("/posts/{id}.json");
  });

  it("generates a unique command id for every operation", async () => {
    const registry = await loadOpenApiRegistry();
    const commandIds = registry.operations.map((operation) => operation.commandId);

    expect(new Set(commandIds).size).toBe(commandIds.length);
    expect(commandIds).toContain("updateAppeal");
    expect(commandIds.some((id) => id.startsWith("updateAppeal-"))).toBe(true);
  });
});
