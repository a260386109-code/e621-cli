---
name: e621-cli
description: Use this skill whenever Codex needs to use the local e621 command line client to search, inspect, favorite, upload, edit, or otherwise interact with the e621/e926/e6ai API. This skill helps Codex discover resource commands and generated API commands, inspect per-command --help and OpenAPI schemas, parse the stable JSON envelope, choose safe dry-run/confirm behavior for writes, avoid leaking API keys, and prefer the v2 post API format.
---

# e621 CLI

## Core Workflow

1. Run `e621 commands --json` first when you need to discover available commands.
2. Prefer `resourceAliases` from discovery when a matching resource command exists, such as `e621 comments search` or `e621 post-votes create`.
3. Before calling an unfamiliar command, run `e621 <resource> <action> --help` to inspect its complete usage. `--help` is plain text and is not wrapped in the JSON envelope.
4. If a resource command does not exist or you need exact OpenAPI details, run `e621 api schema <operationId>` and then use `e621 api <commandId>`.
5. Expect JSON output by default:

```json
{ "ok": true, "data": {}, "meta": {} }
```

Failures use:

```json
{ "ok": false, "error": { "type": "HttpError", "message": "...", "retryable": false }, "meta": {} }
```

6. Read `ok` before reading `data`. If `ok` is false, report `error.type`, `error.message`, and whether `retryable` is true.

## Safe Calling Rules

- Never print, summarize, or put `E621_API_KEY` in a URL, query string, prompt, log, or final answer.
- Prefer configured profiles or environment variables over passing credentials on the command line.
- The CLI does not accept a custom User-Agent. It derives `e621-cli/1.0 (by <username> on e621)` from the configured username.
- For any non-GET operation, call with `--dry-run` first unless the user explicitly asked to perform the mutation.
- Real write calls require `--confirm <operationId>`. Do not guess confirmation for destructive/admin/moderator actions.
- Do not use this CLI as a bulk scraper. For tens of thousands of lookups, tell the user e621 recommends daily database exports.

## Common Commands

Discover commands:

```bash
e621 commands --json
```

Inspect a resource command:

```bash
e621 comments search --help
e621 post-votes create --help
```

Search posts:

```bash
e621 posts search --tags "rating:s" --limit 10
```

Call a generated resource command:

```bash
e621 comments search --search-post-id 123
```

Inspect a generated operation:

```bash
e621 api schema searchPosts
```

Call the raw generated API layer when resource commands are insufficient:

```bash
e621 api searchPosts --tags "rating:s" --limit 10
```

Preview a generated resource write:

```bash
e621 forum-topics create --dry-run --field "forum_topic[title]=Example"
```

Preview a write:

```bash
e621 favorites add 12345 --dry-run
```

Perform a confirmed write only after user intent is clear:

```bash
e621 favorites add 12345 --confirm addFavorite
```

## Post API Defaults

Post endpoints default to e621's v2 response format with `v2=true&mode=basic`.

- Use `--mode thumbnail` for lightweight grid/list metadata.
- Use `--mode extended` when tag categories are needed.
- Use `--legacy-v1` only for compatibility with old tools.

## Configuration

Initialize a profile:

```bash
e621 config init --profile default --base-url https://e621.net --username "<username>"
```

Set credentials without printing them:

```bash
e621 config set username "<username>"
e621 config set api-key "<api-key>"
```

Environment overrides:

- `E621_PROFILE`
- `E621_BASE_URL`
- `E621_USERNAME`
- `E621_API_KEY`

`E621_LOGIN` remains accepted as a legacy alias for `E621_USERNAME`.

Use `e621 config get` or `e621 config list`; secrets are redacted unless `--show-secrets` is explicitly supplied.
