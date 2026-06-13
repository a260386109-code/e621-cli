import { CliError } from "./errors.js";

export type OutputFormat = "json" | "pretty" | "table";

export type Envelope<T = unknown> = {
  ok: true;
  data: T;
  meta: Record<string, unknown>;
};

export type ErrorEnvelope = {
  ok: false;
  error: {
    type: string;
    message: string;
    status?: number;
    retryable: boolean;
    details?: unknown;
  };
  meta: Record<string, unknown>;
};

export function successEnvelope<T>(data: T, meta: Record<string, unknown> = {}): Envelope<T> {
  return { ok: true, data, meta };
}

export function errorEnvelope(error: unknown, meta: Record<string, unknown> = {}): ErrorEnvelope {
  if (error instanceof CliError) {
    return {
      ok: false,
      error: {
        type: error.type,
        message: error.message,
        status: error.status,
        retryable: error.retryable,
        details: error.details
      },
      meta
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        type: error.name || "Error",
        message: error.message,
        retryable: false
      },
      meta
    };
  }

  return {
    ok: false,
    error: {
      type: "UnknownError",
      message: String(error),
      retryable: false
    },
    meta
  };
}

export function printEnvelope(envelope: Envelope | ErrorEnvelope, format: OutputFormat, raw = false): void {
  if (raw && envelope.ok) {
    console.log(JSON.stringify(envelope.data, null, 2));
    return;
  }

  if (format === "json") {
    console.log(JSON.stringify(envelope, null, 2));
    return;
  }

  if (!envelope.ok) {
    console.error(`${envelope.error.type}: ${envelope.error.message}`);
    return;
  }

  if (format === "table") {
    console.log(formatTable(envelope.data));
    return;
  }

  console.log(formatPretty(envelope.data));
}

function formatPretty(data: unknown): string {
  if (Array.isArray(data)) {
    return data.map((item, index) => `${index + 1}. ${summarize(item)}`).join("\n");
  }

  return summarize(data);
}

function summarize(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return String(value);

  const record = value as Record<string, unknown>;
  const preferred = ["id", "name", "title", "operationId", "summary", "rating", "score", "file_url", "url"];
  const parts = preferred
    .filter((key) => record[key] !== undefined)
    .map((key) => `${key}=${String(record[key])}`);

  return parts.length > 0 ? parts.join(" ") : JSON.stringify(value, null, 2);
}

function formatTable(data: unknown): string {
  const rows = Array.isArray(data) ? data : [data];
  const objects = rows.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row));

  if (objects.length === 0) return formatPretty(data);

  const columns = selectColumns(objects);
  const widths = columns.map((column) =>
    Math.max(column.length, ...objects.map((row) => cell(row[column]).length))
  );
  const header = columns.map((column, index) => column.padEnd(widths[index])).join("  ");
  const rule = widths.map((width) => "-".repeat(width)).join("  ");
  const body = objects
    .map((row) => columns.map((column, index) => cell(row[column]).padEnd(widths[index])).join("  "))
    .join("\n");

  return [header, rule, body].filter(Boolean).join("\n");
}

function selectColumns(rows: Record<string, unknown>[]): string[] {
  const preferred = ["id", "name", "operationId", "summary", "method", "path", "rating", "score", "fav_count"];
  const keys = new Set<string>();
  for (const key of preferred) {
    if (rows.some((row) => row[key] !== undefined)) keys.add(key);
  }
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (keys.size >= 8) break;
      if (!keys.has(key) && isScalar(row[key])) keys.add(key);
    }
  }
  return [...keys];
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return truncate(JSON.stringify(value));
}

function isScalar(value: unknown): boolean {
  return value === null || ["string", "number", "boolean", "undefined"].includes(typeof value);
}

function truncate(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}
