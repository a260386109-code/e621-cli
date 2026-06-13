import { CliError } from "../runtime/errors.js";
import { E621Client, RequestInput, RequestResult } from "../runtime/http.js";
import { coerceCliValue, parseJsonObject, parseKeyValueList, setNested } from "../runtime/params.js";
import { resolveConfig } from "../runtime/config.js";
import { getOperation, OpenApiOperation, OpenApiRegistry } from "../openapi/registry.js";

export type GlobalOptions = {
  config?: string;
  profile?: string;
  format?: string;
};

export type ExecuteOptions = Record<string, unknown> & {
  dryRun?: boolean;
  confirm?: boolean | string;
  legacyV1?: boolean;
  bodyJson?: string;
  queryJson?: string;
  param?: string[];
  field?: string[];
  fileField?: string[];
};

export type ExecuteResult = RequestResult & {
  operationId: string;
};

export async function executeOperation(
  registry: OpenApiRegistry,
  operationId: string,
  options: ExecuteOptions,
  globals: GlobalOptions = {}
): Promise<ExecuteResult> {
  const operation = getOperation(registry, operationId);
  const request = buildRequest(operation, options);
  const config = await resolveConfig({ configPath: globals.config, profile: globals.profile });
  const client = new E621Client(config);
  const result = await client.request(request);
  return { ...result, operationId };
}

export function buildRequest(operation: OpenApiOperation, options: ExecuteOptions): RequestInput {
  assertConfirm(operation, options);

  const pathValues: Record<string, unknown> = {};
  const query: Record<string, unknown> = parseJsonObject(options.queryJson, "--query-json");
  const body: Record<string, unknown> = parseJsonObject(options.bodyJson, "--body-json");
  const explicitParams = parseKeyValueList(options.param);
  const fields = parseKeyValueList(options.field);
  const fileFields = parseKeyValueList(options.fileField);

  for (const [key, value] of Object.entries(fields)) {
    setNested(body, key, coerceCliValue(value));
  }

  for (const parameter of operation.parameters) {
    const value = options[parameter.optionKey];
    if (value === undefined) continue;
    assignParameter(parameter.in, parameter.name, coerceCliValue(value), pathValues, query);
  }

  for (const [key, value] of Object.entries(explicitParams)) {
    const parameter = operation.parameters.find((candidate) => candidate.name === key || candidate.cliName === key);
    if (parameter) {
      assignParameter(parameter.in, parameter.name, coerceCliValue(value), pathValues, query);
    } else {
      query[key] = coerceCliValue(value);
    }
  }

  applyPostV2Defaults(operation, query, options);
  const path = interpolatePath(operation.path, pathValues);

  return {
    method: operation.method.toUpperCase(),
    path,
    query,
    body,
    fileFields,
    dryRun: options.dryRun
  };
}

export function curatedOptions(input: Record<string, unknown>): ExecuteOptions {
  return input as ExecuteOptions;
}

function assignParameter(
  location: string,
  name: string,
  value: unknown,
  pathValues: Record<string, unknown>,
  query: Record<string, unknown>
): void {
  if (location === "path") {
    pathValues[name] = value;
  } else if (location === "query") {
    query[name] = value;
  }
}

function interpolatePath(path: string, values: Record<string, unknown>): string {
  return path.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined || value === null || value === "") {
      throw new CliError(`Missing required path parameter "${key}"`, { type: "InvalidArgument" });
    }
    return encodeURIComponent(String(value));
  });
}

function assertConfirm(operation: OpenApiOperation, options: ExecuteOptions): void {
  if (operation.method === "get") return;
  if (options.dryRun) return;

  const confirm = options.confirm;
  if (confirm === true || confirm === operation.operationId) return;

  throw new CliError(`Refusing to run ${operation.method.toUpperCase()} ${operation.path} without --confirm ${operation.operationId}`, {
    type: "ConfirmationRequired",
    details: {
      operationId: operation.operationId,
      dryRun: `e621 api ${operation.operationId} --dry-run ...`,
      confirm: `--confirm ${operation.operationId}`
    }
  });
}

function applyPostV2Defaults(operation: OpenApiOperation, query: Record<string, unknown>, options: ExecuteOptions): void {
  const supportsV2 = operation.parameters.some((parameter) => parameter.name === "v2");
  const supportsMode = operation.parameters.some((parameter) => parameter.name === "mode");
  if (!supportsV2 || options.legacyV1) return;

  if (query.v2 === undefined) query.v2 = true;

  if (supportsMode && query.mode === undefined) {
    query.mode = "basic";
  }

  if (query.mode === "thumbnails") {
    query.mode = "thumbnail";
  }
}
