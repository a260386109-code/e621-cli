import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const url = "https://e621.wiki/openapi.yaml";
const output = resolve("schemas/openapi.yaml");

const response = await fetch(url, {
  headers: {
    "User-Agent": "e621-cli-openapi-refresh/0.1"
  }
});

if (!response.ok) {
  throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
}

const body = await response.text();
await mkdir(dirname(output), { recursive: true });
await writeFile(output, body, "utf8");
console.log(`Wrote ${output}`);
