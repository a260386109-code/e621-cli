import { Command } from "commander";
import { OpenApiOperation } from "../openapi/registry.js";

export function configureOpenApiCommand(command: Command, operation: OpenApiOperation): Command {
  command
    .option("--dry-run", "Print the request that would be sent without calling e621.")
    .option("--confirm [operationId]", "Required for non-GET operations.")
    .option("--legacy-v1", "Do not opt in to the v2 post response format.")
    .option("--query-json <json>", "Merge a JSON object into query parameters.")
    .option("--body-json <json>", "Use a JSON object as the request body.")
    .option("--param <key=value>", "Set an operation parameter by OpenAPI or CLI name.", collect)
    .option("--field <key=value>", "Set a request body field. Bracket keys create nested JSON.", collect)
    .option("--file-field <key=path>", "Attach a multipart file field.", collect)
    .option("--raw", "Print upstream data without the e621 CLI envelope.");

  addParameterOptions(command, operation);
  command.addHelpText("after", operationHelp(operation));
  return command;
}

function addParameterOptions(command: Command, operation: OpenApiOperation): void {
  const seen = new Set<string>();
  for (const parameter of operation.parameters) {
    if (seen.has(parameter.cliName)) continue;
    seen.add(parameter.cliName);

    const type = parameter.schema?.type;
    const required = parameter.required ? " required" : "";
    const source = `${parameter.in}:${parameter.name}`;
    const description = [parameter.description, `OpenAPI ${source}.${required}`].filter(Boolean).join(" ");

    if (type === "boolean") {
      command.option(`--${parameter.cliName} [value]`, description);
    } else {
      command.option(`--${parameter.cliName} <value>`, description);
    }
  }
}

function operationHelp(operation: OpenApiOperation): string {
  const lines = [
    "",
    "OpenAPI:",
    `  operationId: ${operation.operationId}`,
    `  commandId: ${operation.commandId}`,
    `  method: ${operation.method.toUpperCase()}`,
    `  path: ${operation.path}`
  ];

  if (operation.parameters.length > 0) {
    lines.push("  parameters:");
    for (const parameter of operation.parameters) {
      const required = parameter.required ? " required" : "";
      lines.push(`    --${parameter.cliName}: ${parameter.in}:${parameter.name}${required}`);
    }
  }

  if (operation.hasRequestBody) {
    lines.push("  body:");
    lines.push("    --body-json <json> for a JSON object request body");
    lines.push("    --field <key=value> for individual body fields");
    lines.push("    --file-field <key=path> for multipart file fields");
  }

  if (operation.method !== "get") {
    lines.push("Safety:");
    lines.push("  Preview with --dry-run before mutating data.");
    lines.push(`  Real request requires --confirm ${operation.operationId}.`);
  }

  return `\n${lines.join("\n")}`;
}

function collect(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value];
}
