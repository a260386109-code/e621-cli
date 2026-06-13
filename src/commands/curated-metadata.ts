export type CuratedCommandMetadata = {
  name: string;
  summary: string;
  category: string;
};

export type CuratedOperationAlias = {
  group: string;
  action: string;
  commandId: string;
};

export const curatedCommandMetadata: CuratedCommandMetadata[] = [
  { name: "commands", summary: "List AI-readable CLI capabilities.", category: "meta" },
  { name: "api schema <operationId>", summary: "Print operation schema and option mapping.", category: "meta" },
  { name: "config init", summary: "Create or update a profile.", category: "config" },
  { name: "config set <key> <value>", summary: "Set base-url, username, or api-key.", category: "config" },
  { name: "config get [key]", summary: "Read profile config with secrets redacted by default.", category: "config" },
  { name: "config list", summary: "List profiles with secrets redacted by default.", category: "config" },
  { name: "config profile [name]", summary: "Show or set the default profile.", category: "config" },
  { name: "posts search", summary: "Search posts with v2=true by default.", category: "posts" },
  { name: "posts get <id>", summary: "Get a post by ID with v2=true by default.", category: "posts" },
  { name: "posts random", summary: "Get a random post with v2=true by default.", category: "posts" },
  { name: "tags search", summary: "Search tags.", category: "tags" },
  { name: "artists search", summary: "Search artists.", category: "artists" },
  { name: "favorites list", summary: "List favorites.", category: "favorites" },
  { name: "favorites add <postId>", summary: "Add favorite; requires --confirm addFavorite.", category: "favorites" },
  { name: "favorites remove <postId>", summary: "Remove favorite; requires --confirm removeFavorite.", category: "favorites" }
];

export const curatedOperationAliases: CuratedOperationAlias[] = [
  { group: "posts", action: "search", commandId: "searchPosts" },
  { group: "posts", action: "get", commandId: "getPost" },
  { group: "posts", action: "random", commandId: "getRandomPost" },
  { group: "tags", action: "search", commandId: "searchTags" },
  { group: "artists", action: "search", commandId: "searchArtists" },
  { group: "favorites", action: "list", commandId: "listFavorites" },
  { group: "favorites", action: "add", commandId: "addFavorite" },
  { group: "favorites", action: "remove", commandId: "removeFavorite" }
];

export function curatedCommandIds(): Set<string> {
  return new Set(curatedOperationAliases.map((alias) => alias.commandId));
}

export function curatedReservedActions(): Map<string, Set<string>> {
  const reserved = new Map<string, Set<string>>();
  for (const alias of curatedOperationAliases) {
    if (!reserved.has(alias.group)) reserved.set(alias.group, new Set());
    reserved.get(alias.group)?.add(alias.action);
  }
  return reserved;
}
