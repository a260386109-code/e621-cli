import { CliError } from "./errors.js";

export type KeyValueInput = string | string[] | undefined;

export function parseKeyValueList(values: KeyValueInput): Record<string, string> {
  const record: Record<string, string> = {};
  const list = Array.isArray(values) ? values : values ? [values] : [];

  for (const value of list) {
    const index = value.indexOf("=");
    if (index <= 0) {
      throw new CliError(`Expected key=value, got "${value}"`, { type: "InvalidArgument" });
    }
    record[value.slice(0, index)] = value.slice(index + 1);
  }

  return record;
}

export function parseJsonObject(value: string | undefined, optionName: string): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new CliError(`Invalid JSON object for ${optionName}`, {
      type: "InvalidArgument",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

export function coerceCliValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === true || value === false) return value;
  if (Array.isArray(value)) return value.map(coerceCliValue);
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  if (trimmed.includes(",")) return trimmed.split(",").map((item) => coerceCliValue(item));
  return value;
}

export function setNested(target: Record<string, unknown>, key: string, value: unknown): void {
  const parts = parseBracketKey(key);
  let cursor: Record<string, unknown> = target;

  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (existing === null || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }

  cursor[parts[parts.length - 1]] = value;
}

export function parseBracketKey(key: string): string[] {
  const first = key.match(/^[^\[]+/)?.[0];
  if (!first) return [key];

  const parts = [first];
  const bracketPattern = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = bracketPattern.exec(key))) {
    parts.push(match[1]);
  }
  return parts;
}
