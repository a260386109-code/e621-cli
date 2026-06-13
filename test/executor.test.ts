import { describe, expect, it } from "vitest";
import { loadOpenApiRegistry } from "../src/openapi/registry.js";
import { buildRequest } from "../src/commands/executor.js";

describe("request builder", () => {
  it("adds v2 post defaults", async () => {
    const registry = await loadOpenApiRegistry();
    const operation = registry.byOperationId.get("searchPosts");
    expect(operation).toBeDefined();

    const request = buildRequest(operation!, { tags: "rating:s", limit: "1", dryRun: true });
    expect(request.query).toMatchObject({
      tags: "rating:s",
      limit: 1,
      v2: true,
      mode: "basic"
    });
  });

  it("supports legacy v1 opt-out", async () => {
    const registry = await loadOpenApiRegistry();
    const operation = registry.byOperationId.get("searchPosts");
    const request = buildRequest(operation!, { tags: "rating:s", legacyV1: true, dryRun: true });

    expect(request.query?.v2).toBeUndefined();
    expect(request.query?.mode).toBeUndefined();
  });

  it("requires confirmation for non-GET operations", async () => {
    const registry = await loadOpenApiRegistry();
    const operation = registry.byOperationId.get("addFavorite");

    expect(() => buildRequest(operation!, { field: ["post_id=1"] })).toThrow(/without --confirm addFavorite/);
    expect(() => buildRequest(operation!, { field: ["post_id=1"], dryRun: true })).not.toThrow();
    expect(() => buildRequest(operation!, { field: ["post_id=1"], confirm: "addFavorite" })).not.toThrow();
  });
});
