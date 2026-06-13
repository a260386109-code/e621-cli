import { describe, expect, it } from "vitest";
import { loadOpenApiRegistry, OpenApiOperation, OpenApiRegistry } from "../src/openapi/registry.js";
import {
  actionFromOperation,
  buildResourceAliases,
  resourceGroupFromTag
} from "../src/commands/resource-aliases.js";
import { curatedCommandIds } from "../src/commands/curated-metadata.js";

describe("resource aliases", () => {
  it("generates resource group slugs from OpenAPI tags", () => {
    expect(resourceGroupFromTag("Forum Topics")).toBe("forum-topics");
    expect(resourceGroupFromTag("Post Votes")).toBe("post-votes");
  });

  it("generates short action names from operation summaries", async () => {
    const registry = await loadOpenApiRegistry();
    const operation = registry.byOperationId.get("searchComments");

    expect(operation).toBeDefined();
    expect(actionFromOperation(operation!, "comments")).toBe("search");
  });

  it("resolves action conflicts with stable aliases", () => {
    const operations: OpenApiOperation[] = [
      fakeOperation({ operationId: "firstCommentAction", summary: "Get Comments", path: "/comments/first.json" }),
      fakeOperation({ operationId: "secondCommentAction", summary: "Get Comments", path: "/comments/second.json" })
    ];

    const aliases = buildResourceAliases({ operations } as OpenApiRegistry);

    expect(aliases.map((alias) => alias.action)).toHaveLength(new Set(aliases.map((alias) => alias.action)).size);
    expect(aliases.map((alias) => alias.command)).toEqual(["comments get", "comments get-get"]);
  });

  it("keeps hand-written curated commands ahead of generated aliases", async () => {
    const registry = await loadOpenApiRegistry();
    const aliases = buildResourceAliases(registry);
    const commands = new Set(aliases.map((alias) => alias.command));
    const commandIds = new Set(aliases.map((alias) => alias.commandId));

    expect(commands.has("posts search")).toBe(false);
    expect(commandIds.has("searchPosts")).toBe(false);
  });

  it("covers every OpenAPI operation through either a resource alias or curated mapping", async () => {
    const registry = await loadOpenApiRegistry();
    const aliases = buildResourceAliases(registry);
    const covered = new Set([...aliases.map((alias) => alias.commandId), ...curatedCommandIds()]);

    expect(covered.size).toBe(registry.operations.length);
    expect(registry.operations.every((operation) => covered.has(operation.commandId))).toBe(true);
  });
});

function fakeOperation(overrides: Partial<OpenApiOperation>): OpenApiOperation {
  return {
    commandId: overrides.operationId ?? "operation",
    operationId: overrides.operationId ?? "operation",
    summary: overrides.summary,
    method: "get",
    path: overrides.path ?? "/comments.json",
    tags: ["Comments"],
    parameters: [],
    hasRequestBody: false,
    raw: {},
    ...overrides
  };
}
