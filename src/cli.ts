#!/usr/bin/env node
import { Command } from "commander";
import { registerApiCommands } from "./commands/api.js";
import { registerCommandsCommand } from "./commands/commands.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerCuratedCommands } from "./commands/curated.js";
import { registerResourceCommands } from "./commands/resource-aliases.js";
import { isMainModule } from "./runtime/main.js";
import { errorEnvelope, Envelope, ErrorEnvelope, OutputFormat, printEnvelope } from "./runtime/output.js";

export async function createProgram(): Promise<Command> {
  const program = new Command();
  program
    .name("e621")
    .description("AI-friendly command line client for the e621 API.")
    .version("0.1.0")
    .option("--config <path>", "Path to config file")
    .option("--profile <name>", "Profile name")
    .option("--format <format>", "Output format: json, pretty, or table", "json")
    .showHelpAfterError();

  program.on("e621:result", (envelope: Envelope | ErrorEnvelope, raw?: boolean) => {
    const options = program.opts<{ format: OutputFormat }>();
    printEnvelope(envelope, normalizeFormat(options.format), Boolean(raw));
  });

  registerCommandsCommand(program);
  registerConfigCommands(program);
  await registerCuratedCommands(program);
  await registerResourceCommands(program);
  await registerApiCommands(program);

  return program;
}

export async function run(argv = process.argv): Promise<void> {
  const program = await createProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const options = program.opts<{ format?: OutputFormat }>();
    printEnvelope(errorEnvelope(error), normalizeFormat(options.format ?? "json"));
    process.exitCode = 1;
  }
}

function normalizeFormat(format: string): OutputFormat {
  if (format === "json" || format === "pretty" || format === "table") return format;
  return "json";
}

if (isMainModule(import.meta.url)) {
  await run();
}
