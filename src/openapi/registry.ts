import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { CliError } from "../runtime/errors.js";

export type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

export type OpenApiParameter = {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required: boolean;
  description?: string;
  schema?: Record<string, unknown>;
  cliName: string;
  optionKey: string;
};

export type OpenApiOperation = {
  commandId: string;
  operationId: string;
  summary?: string;
  description?: string;
  method: HttpMethod;
  path: string;
  tags: string[];
  parameters: OpenApiParameter[];
  hasRequestBody: boolean;
  requestBody?: unknown;
  raw: Record<string, unknown>;
};

export type OpenApiRegistry = {
  spec: Record<string, unknown>;
  operations: OpenApiOperation[];
  byOperationId: Map<string, OpenApiOperation>;
};

const methods = new Set(["get", "post", "patch", "put", "delete"]);

let cachedRegistry: OpenApiRegistry | undefined;

export async function loadOpenApiRegistry(schemaPath?: string): Promise<OpenApiRegistry> {
  if (!schemaPath && cachedRegistry) return cachedRegistry;

  const path = schemaPath ?? (await findSchemaPath());
  const raw = await readFile(path, "utf8");
  const spec = YAML.parse(raw) as Record<string, unknown>;
  const operations = assignCommandIds(collectOperations(spec));
  const byOperationId = new Map<string, OpenApiOperation>();

  for (const operation of operations) {
    if (byOperationId.has(operation.commandId)) {
      throw new CliError(`Duplicate generated commandId "${operation.commandId}"`, { type: "OpenApiError" });
    }
    byOperationId.set(operation.commandId, operation);
  }

  const registry = { spec, operations, byOperationId };
  if (!schemaPath) cachedRegistry = registry;
  return registry;
}

export function getOperation(registry: OpenApiRegistry, operationId: string): OpenApiOperation {
  const operation = registry.byOperationId.get(operationId);
  if (!operation) {
    throw new CliError(`Unknown operationId "${operationId}"`, {
      type: "UnknownOperation",
      details: { available: registry.operations.map((item) => item.operationId).sort() }
    });
  }
  return operation;
}

export function operationSchema(operation: OpenApiOperation): Record<string, unknown> {
  return {
    operationId: operation.operationId,
    commandId: operation.commandId,
    summary: operation.summary,
    description: operation.description,
    method: operation.method.toUpperCase(),
    path: operation.path,
    tags: operation.tags,
    parameters: operation.parameters.map((parameter) => ({
      name: parameter.name,
      in: parameter.in,
      required: parameter.required,
      cliOption: `--${parameter.cliName}`,
      type: parameter.schema?.type,
      enum: parameter.schema?.enum,
      description: parameter.description
    })),
    requestBody: operation.hasRequestBody
      ? {
          use: ["--body-json", "--field key=value", "--file-field field=path"],
          schema: operation.requestBody
        }
      : undefined
  };
}

export function commandSummary(operation: OpenApiOperation): Record<string, unknown> {
  return {
    name: `api ${operation.commandId}`,
    commandId: operation.commandId,
    operationId: operation.operationId,
    summary: operation.summary,
    method: operation.method.toUpperCase(),
    path: operation.path,
    tags: operation.tags,
    parameters: operation.parameters.map((parameter) => ({
      name: parameter.name,
      option: `--${parameter.cliName}`,
      required: parameter.required
    }))
  };
}

function collectOperations(spec: Record<string, unknown>): OpenApiOperation[] {
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths) throw new CliError("OpenAPI spec has no paths object", { type: "OpenApiError" });

  const operations: OpenApiOperation[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    const pathParameters = collectParameters(spec, pathItem.parameters);
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!methods.has(method)) continue;
      const operationObject = resolveRef(spec, rawOperation) as Record<string, unknown>;
      const operationId = String(operationObject.operationId ?? "");
      if (!operationId) continue;

      operations.push({
        commandId: operationId,
        operationId,
        summary: stringValue(operationObject.summary),
        description: stringValue(operationObject.description),
        method: method as HttpMethod,
        path,
        tags: Array.isArray(operationObject.tags) ? operationObject.tags.map(String) : [],
        parameters: dedupeParameters([...pathParameters, ...collectParameters(spec, operationObject.parameters)]),
        hasRequestBody: Boolean(operationObject.requestBody),
        requestBody: operationObject.requestBody ? resolveRef(spec, operationObject.requestBody) : undefined,
        raw: operationObject
      });
    }
  }

  return operations.sort((left, right) => left.operationId.localeCompare(right.operationId));
}

function assignCommandIds(operations: OpenApiOperation[]): OpenApiOperation[] {
  const seen = new Map<string, number>();
  return operations.map((operation) => {
    const count = seen.get(operation.operationId) ?? 0;
    seen.set(operation.operationId, count + 1);
    if (count === 0) return { ...operation, commandId: operation.operationId };

    return {
      ...operation,
      commandId: `${operation.operationId}-${operation.method}-${toCliName(operation.path)}`
    };
  });
}

function collectParameters(spec: Record<string, unknown>, rawParameters: unknown): OpenApiParameter[] {
  if (!Array.isArray(rawParameters)) return [];

  const usedCliNames = new Set<string>();
  return rawParameters.map((raw) => {
    const parameter = resolveRef(spec, raw) as Record<string, unknown>;
    const name = String(parameter.name);
    const location = String(parameter.in) as OpenApiParameter["in"];
    const cliName = uniqueCliName(toCliName(name), usedCliNames);

    return {
      name,
      in: location,
      required: Boolean(parameter.required),
      description: stringValue(parameter.description),
      schema: parameter.schema ? (resolveRef(spec, parameter.schema) as Record<string, unknown>) : undefined,
      cliName,
      optionKey: toOptionKey(cliName)
    };
  });
}

function dedupeParameters(parameters: OpenApiParameter[]): OpenApiParameter[] {
  const seen = new Set<string>();
  const result: OpenApiParameter[] = [];
  for (const parameter of parameters) {
    const key = `${parameter.in}:${parameter.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(parameter);
  }
  return result;
}

export function resolveRef(spec: Record<string, unknown>, value: unknown): unknown {
  if (!value || typeof value !== "object" || !("$ref" in value)) return value;

  const ref = String((value as { $ref: string }).$ref);
  if (!ref.startsWith("#/")) throw new CliError(`Unsupported external OpenAPI ref "${ref}"`, { type: "OpenApiError" });

  return ref
    .slice(2)
    .split("/")
    .map((part) => decodeURIComponent(part.replace(/~1/g, "/").replace(/~0/g, "~")))
    .reduce<unknown>((cursor, part) => {
      if (cursor && typeof cursor === "object" && part in cursor) {
        return (cursor as Record<string, unknown>)[part];
      }
      throw new CliError(`Broken OpenAPI ref "${ref}"`, { type: "OpenApiError" });
    }, spec);
}

export function toCliName(name: string): string {
  return name
    .replace(/\]/g, "")
    .replace(/\[/g, "-")
    .replace(/_/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .toLowerCase();
}

export function toOptionKey(cliName: string): string {
  return cliName.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function uniqueCliName(base: string, used: Set<string>): string {
  let candidate = base || "value";
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

async function findSchemaPath(): Promise<string> {
  const candidates: string[] = [];
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  let cursor = resolve(moduleDir);

  for (let index = 0; index < 8; index += 1) {
    candidates.push(join(cursor, "schemas", "openapi.yaml"));
    cursor = dirname(cursor);
  }
  candidates.push(join(process.cwd(), "schemas", "openapi.yaml"));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next likely install layout.
    }
  }

  throw new CliError("Could not find schemas/openapi.yaml", { type: "OpenApiError", details: { candidates } });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
