# e621-cli

AI-friendly command line client for the e621 API.

## Install

```bash
npm install -g e621-cli
```

Local development:

```bash
npm install
npm run build
node dist/cli.js --help
```

## Configure

e621 requires a descriptive User-Agent. This CLI derives it from the configured username and always sends:

```text
e621-cli/1.0 (by <username> on e621)
```

API keys are sent with Basic Auth and are never added to query strings.

```bash
e621 config init --profile default --base-url https://e621.net --username "<username>"
e621 config set api-key "<api-key>"
```

Environment variables override the config file:

- `E621_PROFILE`
- `E621_BASE_URL`
- `E621_USERNAME`
- `E621_API_KEY`

`E621_LOGIN` is accepted as a legacy alias for `E621_USERNAME`.

## Usage

The default output is a stable JSON envelope:

```json
{ "ok": true, "data": {}, "meta": {} }
```

Examples:

```bash
e621 commands --json
e621 comments search --help
e621 comments search --search-post-id 123 --dry-run
e621 post-votes create --id 123 --score 1 --dry-run
e621 api schema searchPosts
e621 api searchPosts --tags "rating:s" --limit 10
e621 posts search --tags "rating:s" --limit 10 --mode thumbnail
e621 favorites add 12345 --dry-run
```

The CLI exposes two OpenAPI-backed layers:

- Friendly resource commands such as `e621 comments search`, `e621 forum-topics create`, and `e621 post-votes create`.
- Raw generated API commands such as `e621 api searchPosts`, useful when you need exact OpenAPI coverage.

Use `e621 <resource> <action> --help` for complete plain-text usage, including the HTTP method/path, operationId, path/query parameters, body flags, and write confirmation guidance.

Human-readable output is opt-in:

```bash
e621 posts search --tags "rating:s" --limit 5 --format table
```

## Safety

- All real non-GET operations require `--confirm <operationId>`.
- Use `--dry-run` to preview write requests.
- Post endpoints default to e621's v2 response format with `v2=true&mode=basic`.
- For bulk data or tens of thousands of lookups, use e621's database exports instead of hammering the API.

## Development

```bash
npm run openapi:refresh
npm run check
npm run test
npm run build
npm pack
```

The repository includes a Codex skill at `skills/e621-cli` to help AI agents discover and use the CLI safely.
