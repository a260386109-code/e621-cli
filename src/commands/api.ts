import { Command } from "commander";
import { commandSummary, loadOpenApiRegistry, operationSchema } from "../openapi/registry.js";
import { successEnvelope } from "../runtime/output.js";
import { emitResult } from "../runtime/program.js";
import { executeOperation, ExecuteOptions, GlobalOptions } from "./executor.js";
import { configureOpenApiCommand } from "./openapi-command.js";

export async function registerApiCommands(program: Command): Promise<void> {
  const registry = await loadOpenApiRegistry();
  const api = program.command("api").description("Run any OpenAPI operation by operationId.");

  api
    .command("schema")
    .argument("<operationId>", "OpenAPI operationId")
    .description("Print the schema and CLI option mapping for an operation.")
    .action(async (operationId: string) => {
      const operation = registry.byOperationId.get(operationId);
      if (!operation) {
        throw new Error(`Unknown operationId "${operationId}"`);
      }
      emitResult(program, successEnvelope(operationSchema(operation), { command: "api.schema" }));
    });

  for (const operation of registry.operations) {
    const command = api
      .command(operation.commandId)
      .description(operation.summary ?? `${operation.method.toUpperCase()} ${operation.path}`);

    configureOpenApiCommand(command, operation);

    command.action(async (options: ExecuteOptions) => {
      const result = await executeOperation(registry, operation.commandId, options, program.opts<GlobalOptions>());
      emitResult(
        program,
        successEnvelope(result.data, {
          command: `api.${operation.commandId}`,
          http: { status: result.status, method: result.method, url: result.url },
          dryRun: result.dryRun
        }),
        Boolean(options.raw)
      );
    });
  }
}

export async function apiCommandSummaries(): Promise<Record<string, unknown>[]> {
  const registry = await loadOpenApiRegistry();
  return registry.operations.map(commandSummary);
}
