import { Command } from "commander";
import { successEnvelope } from "../runtime/output.js";
import { emitResult } from "../runtime/program.js";
import { apiCommandSummaries } from "./api.js";
import { curatedCommandMetadata } from "./curated-metadata.js";
import { resourceAliasSummaries } from "./resource-aliases.js";

export function registerCommandsCommand(program: Command): void {
  program
    .command("commands")
    .description("List AI-readable CLI capabilities.")
    .option("--json", "Force JSON output. The CLI defaults to JSON envelope already.")
    .action(async () => {
      const api = await apiCommandSummaries();
      const resourceAliases = await resourceAliasSummaries();
      emitResult(
        program,
        successEnvelope(
          {
            curated: curatedCommandMetadata,
            resourceAliases,
            generatedApi: api,
            conventions: {
              defaultOutput: "{ ok, data, meta }",
              help: "Use `e621 <resource> <action> --help` for complete method usage.",
              schemaCommand: "e621 api schema <operationId>",
              userAgent: "Requests use e621-cli/1.0 (by <username> on e621), derived from config username.",
              writeSafety: "Non-GET operations require --dry-run or --confirm <operationId>.",
              postDefaults: "Post endpoints use v2=true and mode=basic unless --legacy-v1 or --mode is supplied."
            }
          },
          { command: "commands" }
        )
      );
    });
}
