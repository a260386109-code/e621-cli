import { Command } from "commander";
import { loadOpenApiRegistry } from "../openapi/registry.js";
import { successEnvelope } from "../runtime/output.js";
import { emitResult } from "../runtime/program.js";
import { curatedOptions, executeOperation, ExecuteOptions, GlobalOptions } from "./executor.js";

export async function registerCuratedCommands(program: Command): Promise<void> {
  const registry = await loadOpenApiRegistry();

  const posts = program.command("posts").description("Convenience commands for post endpoints.");
  posts
    .command("search")
    .description("Search posts with v2 post output by default.")
    .option("--tags <query>", "e621 tag search query")
    .option("--limit <number>", "Maximum posts to return")
    .option("--page <page>", "Page number or a/b cursor")
    .option("--mode <mode>", "v2 mode: basic, extended, or thumbnail", "basic")
    .option("--legacy-v1", "Use legacy v1 post response format")
    .option("--raw", "Print upstream data without the e621 CLI envelope")
    .action((options) => runCurated(program, registry, "searchPosts", options));

  posts
    .command("get")
    .argument("<id>", "Post ID")
    .description("Get a post by ID.")
    .option("--mode <mode>", "v2 mode: basic, extended, or thumbnail", "basic")
    .option("--legacy-v1", "Use legacy v1 post response format")
    .option("--raw", "Print upstream data without the e621 CLI envelope")
    .action((id: string, options) => runCurated(program, registry, "getPost", { ...options, id }));

  posts
    .command("random")
    .description("Get a random post.")
    .option("--tags <query>", "Optional tag search query")
    .option("--mode <mode>", "v2 mode: basic, extended, or thumbnail", "basic")
    .option("--legacy-v1", "Use legacy v1 post response format")
    .option("--raw", "Print upstream data without the e621 CLI envelope")
    .action((options) => runCurated(program, registry, "getRandomPost", options));

  const tags = program.command("tags").description("Convenience commands for tags.");
  tags
    .command("search")
    .description("Search tags.")
    .option("--name-matches <value>", "Tag name expression; * wildcard supported")
    .option("--category <value>", "Tag category number")
    .option("--order <value>", "Sort order")
    .option("--hide-empty <value>", "Hide tags with zero visible posts")
    .option("--has-wiki <value>", "Filter by wiki page presence")
    .option("--limit <number>", "Maximum tags to return")
    .option("--page <page>", "Page number or a/b cursor")
    .option("--raw", "Print upstream data without the e621 CLI envelope")
    .action((options) =>
      runCurated(program, registry, "searchTags", {
        ...options,
        searchNameMatches: options.nameMatches,
        searchCategory: options.category,
        searchOrder: options.order,
        searchHideEmpty: options.hideEmpty,
        searchHasWiki: options.hasWiki
      })
    );

  const artists = program.command("artists").description("Convenience commands for artists.");
  artists
    .command("search")
    .description("Search artists.")
    .option("--name <value>", "Artist name")
    .option("--url <value>", "Artist URL")
    .option("--limit <number>", "Maximum artists to return")
    .option("--page <page>", "Page number")
    .option("--raw", "Print upstream data without the e621 CLI envelope")
    .action((options) =>
      runCurated(program, registry, "searchArtists", {
        ...options,
        searchName: options.name,
        searchUrl: options.url
      })
    );

  const favorites = program.command("favorites").description("Convenience commands for favorites.");
  favorites
    .command("list")
    .description("List favorites.")
    .option("--user-id <id>", "User ID")
    .option("--limit <number>", "Maximum posts to return")
    .option("--page <page>", "Page number")
    .option("--mode <mode>", "v2 mode: basic, extended, or thumbnail", "basic")
    .option("--legacy-v1", "Use legacy v1 post response format")
    .option("--raw", "Print upstream data without the e621 CLI envelope")
    .action((options) => runCurated(program, registry, "listFavorites", { ...options, userId: options.userId }));

  favorites
    .command("add")
    .argument("<postId>", "Post ID to favorite")
    .description("Add a favorite. Requires --confirm addFavorite unless --dry-run is used.")
    .option("--dry-run", "Print the request without calling e621")
    .option("--confirm [operationId]", "Required to mutate favorites")
    .option("--raw", "Print upstream data without the e621 CLI envelope")
    .action((postId: string, options) => runCurated(program, registry, "addFavorite", { ...options, field: [`post_id=${postId}`] }));

  favorites
    .command("remove")
    .argument("<postId>", "Post ID to remove from favorites")
    .description("Remove a favorite. Requires --confirm removeFavorite unless --dry-run is used.")
    .option("--dry-run", "Print the request without calling e621")
    .option("--confirm [operationId]", "Required to mutate favorites")
    .option("--raw", "Print upstream data without the e621 CLI envelope")
    .action((postId: string, options) => runCurated(program, registry, "removeFavorite", { ...options, id: postId, postId }));
}

async function runCurated(
  program: Command,
  registry: Awaited<ReturnType<typeof loadOpenApiRegistry>>,
  operationId: string,
  options: ExecuteOptions
): Promise<void> {
  const result = await executeOperation(registry, operationId, curatedOptions(options), program.opts<GlobalOptions>());
  emitResult(
    program,
    successEnvelope(result.data, {
      command: operationId,
      http: { status: result.status, method: result.method, url: result.url },
      dryRun: result.dryRun
    }),
    Boolean(options.raw)
  );
}
