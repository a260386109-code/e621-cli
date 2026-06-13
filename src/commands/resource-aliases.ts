import { Command } from "commander";
import { loadOpenApiRegistry, OpenApiOperation, OpenApiRegistry, toCliName } from "../openapi/registry.js";
import { successEnvelope } from "../runtime/output.js";
import { emitResult } from "../runtime/program.js";
import { curatedCommandIds, curatedReservedActions } from "./curated-metadata.js";
import { executeOperation, ExecuteOptions, GlobalOptions } from "./executor.js";
import { configureOpenApiCommand } from "./openapi-command.js";

export type ResourceAlias = {
  group: string;
  action: string;
  command: string;
  commandId: string;
  operationId: string;
  summary?: string;
  method: string;
  path: string;
  tags: string[];
};

export async function registerResourceCommands(program: Command): Promise<void> {
  const registry = await loadOpenApiRegistry();
  const aliases = buildResourceAliases(registry);
  const byCommandId = new Map(registry.operations.map((operation) => [operation.commandId, operation]));

  for (const alias of aliases) {
    const operation = byCommandId.get(alias.commandId);
    if (!operation) continue;

    const group = findOrCreateGroup(program, alias.group, alias.tags[0]);
    if (hasSubcommand(group, alias.action)) continue;

    const command = group.command(alias.action).description(commandDescription(operation));
    configureOpenApiCommand(command, operation);
    command.action(async (options: ExecuteOptions) => {
      const result = await executeOperation(registry, operation.commandId, options, program.opts<GlobalOptions>());
      emitResult(
        program,
        successEnvelope(result.data, {
          command: alias.command,
          operationId: operation.operationId,
          commandId: operation.commandId,
          http: { status: result.status, method: result.method, url: result.url },
          dryRun: result.dryRun
        }),
        Boolean(options.raw)
      );
    });
  }
}

export async function resourceAliasSummaries(): Promise<ResourceAlias[]> {
  return buildResourceAliases(await loadOpenApiRegistry());
}

export function buildResourceAliases(registry: OpenApiRegistry): ResourceAlias[] {
  const excluded = curatedCommandIds();
  const reserved = curatedReservedActions();
  const operationsByGroup = new Map<string, OpenApiOperation[]>();

  for (const operation of registry.operations) {
    if (excluded.has(operation.commandId)) continue;
    const group = resourceGroupFromOperation(operation);
    if (!operationsByGroup.has(group)) operationsByGroup.set(group, []);
    operationsByGroup.get(group)?.push(operation);
  }

  const aliases: ResourceAlias[] = [];
  for (const [group, operations] of [...operationsByGroup.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const used = new Set(reserved.get(group) ?? []);
    for (const operation of operations) {
      const action = uniqueAction(actionFromOperation(operation, group), operation, group, used);
      used.add(action);
      aliases.push({
        group,
        action,
        command: `${group} ${action}`,
        commandId: operation.commandId,
        operationId: operation.operationId,
        summary: operation.summary,
        method: operation.method.toUpperCase(),
        path: operation.path,
        tags: operation.tags
      });
    }
  }

  return aliases.sort((left, right) => left.command.localeCompare(right.command));
}

export function resourceGroupFromTag(tag: string | undefined): string {
  return toCliName(tag || "misc");
}

export function actionFromOperation(operation: OpenApiOperation, group = resourceGroupFromOperation(operation)): string {
  const summaryTokens = tokens(operation.summary ?? operation.operationId);
  const groupTokens = resourceTokens(group);
  const filtered = summaryTokens.filter((token) => !groupTokens.has(token));
  const action = filtered.length > 0 ? filtered.join("-") : toCliName(operation.commandId);
  return action || operation.commandId;
}

function resourceGroupFromOperation(operation: OpenApiOperation): string {
  return resourceGroupFromTag(operation.tags[0]);
}

function uniqueAction(base: string, operation: OpenApiOperation, group: string, used: Set<string>): string {
  const candidates = [
    base,
    joinNonEmpty(base, qualifierFromSummary(operation, group, base)),
    joinNonEmpty(base, operation.method),
    joinNonEmpty(base, operation.method, pathSlug(operation.path)),
    operation.commandId
  ];

  for (const candidate of candidates) {
    if (candidate && !used.has(candidate)) return candidate;
  }

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function qualifierFromSummary(operation: OpenApiOperation, group: string, base: string): string {
  const baseTokens = new Set(tokens(base));
  const groupTokens = resourceTokens(group);
  return tokens(operation.summary ?? operation.commandId)
    .filter((token) => !baseTokens.has(token) && !groupTokens.has(token))
    .join("-");
}

function resourceTokens(group: string): Set<string> {
  const values = new Set<string>();
  for (const token of tokens(group)) {
    values.add(token);
    values.add(singularize(token));
  }
  return values;
}

function singularize(token: string): string {
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ses")) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 1) return token.slice(0, -1);
  return token;
}

function tokens(value: string): string[] {
  return toCliName(value).split("-").filter(Boolean);
}

function joinNonEmpty(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join("-");
}

function pathSlug(path: string): string {
  return toCliName(path.replace(/\{([^}]+)\}/g, "$1"));
}

function commandDescription(operation: OpenApiOperation): string {
  return `${operation.summary ?? operation.operationId} (${operation.method.toUpperCase()} ${operation.path}; operationId: ${operation.operationId})`;
}

function findOrCreateGroup(program: Command, group: string, tag?: string): Command {
  const existing = program.commands.find((command) => command.name() === group);
  if (existing) return existing;
  return program.command(group).description(`Generated commands for ${tag ?? group} endpoints.`);
}

function hasSubcommand(command: Command, name: string): boolean {
  return command.commands.some((subcommand) => subcommand.name() === name);
}
