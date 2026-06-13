import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { CliError, isRetryableStatus, statusType } from "./errors.js";
import { ResolvedConfig, authUsername, buildUserAgent, hasAuth, redact } from "./config.js";

export type RequestInput = {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  fileFields?: Record<string, string>;
  dryRun?: boolean;
};

export type RequestResult = {
  data: unknown;
  status: number;
  url: string;
  method: string;
  dryRun?: boolean;
};

export type E621ClientOptions = {
  fetchImpl?: typeof fetch;
  delayMs?: (ms: number) => Promise<void>;
  maxRetries?: number;
  rateLimitMs?: number;
};

let lastRequestAt = 0;

export class E621Client {
  private readonly fetchImpl: typeof fetch;
  private readonly delayMs: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly rateLimitMs: number;

  constructor(
    private readonly config: ResolvedConfig,
    options: E621ClientOptions = {}
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.delayMs = options.delayMs ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxRetries = options.maxRetries ?? 2;
    this.rateLimitMs = options.rateLimitMs ?? 1000;
  }

  async request(input: RequestInput): Promise<RequestResult> {
    const url = this.buildUrl(input.path, input.query);
    const method = input.method.toUpperCase();

    if (input.dryRun) {
      return {
        status: 0,
        method,
        url: url.toString(),
        dryRun: true,
        data: {
          method,
          url: url.toString(),
          body: redact(input.body ?? {}),
          fileFields: input.fileFields ? Object.keys(input.fileFields) : []
        }
      };
    }

    const headers = new Headers();
    headers.set("User-Agent", buildUserAgent(this.config));
    headers.set("Accept", "application/json");

    if (hasAuth(this.config)) {
      const token = Buffer.from(`${authUsername(this.config)}:${this.config.apiKey}`).toString("base64");
      headers.set("Authorization", `Basic ${token}`);
    }

    const init: RequestInit = { method, headers };
    if (method !== "GET" && method !== "HEAD") {
      if (input.fileFields && Object.keys(input.fileFields).length > 0) {
        init.body = await this.multipartBody(input.body ?? {}, input.fileFields);
      } else if (input.body && Object.keys(input.body).length > 0) {
        headers.set("Content-Type", "application/json");
        init.body = JSON.stringify(input.body);
      }
    }

    await this.waitForRateLimit();
    return this.fetchWithRetry(url, init, method);
  }

  private buildUrl(path: string, query: Record<string, unknown> = {}): URL {
    const url = new URL(path, `${this.config.baseUrl}/`);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, lastRequestAt + this.rateLimitMs - now);
    if (wait > 0) await this.delayMs(wait);
    lastRequestAt = Date.now();
  }

  private async fetchWithRetry(url: URL, init: RequestInit, method: string): Promise<RequestResult> {
    let attempt = 0;
    let response: Response | undefined;

    while (attempt <= this.maxRetries) {
      response = await this.fetchImpl(url, init);
      if (!isRetryableStatus(response.status) || attempt === this.maxRetries) break;

      const retryAfter = response.headers.get("retry-after");
      const retryMs = retryAfter ? Number.parseFloat(retryAfter) * 1000 : 1000 * 2 ** attempt;
      await this.delayMs(Number.isFinite(retryMs) ? retryMs : 1000);
      attempt += 1;
    }

    if (!response) throw new CliError("No HTTP response received", { type: "HttpError", retryable: true });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new CliError(`HTTP ${response.status} ${response.statusText}`, {
        type: statusType(response.status),
        status: response.status,
        retryable: isRetryableStatus(response.status),
        details: data
      });
    }

    return {
      data,
      status: response.status,
      method,
      url: url.toString()
    };
  }

  private async multipartBody(body: Record<string, unknown>, fileFields: Record<string, string>): Promise<FormData> {
    const form = new FormData();

    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null) continue;
      form.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }

    for (const [key, path] of Object.entries(fileFields)) {
      const bytes = await readFile(path);
      form.set(key, new Blob([bytes]), basename(path));
    }

    return form;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
