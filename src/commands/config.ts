import { Command } from "commander";
import {
  defaultConfigPath,
  loadConfigFile,
  normalizeBaseUrl,
  normalizeConfigKey,
  redact,
  redactConfig,
  saveConfigFile
} from "../runtime/config.js";
import { successEnvelope } from "../runtime/output.js";
import { emitResult } from "../runtime/program.js";
import { GlobalOptions } from "./executor.js";

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage e621 CLI profiles and credentials.");

  config
    .command("init")
    .description("Create or update a profile.")
    .option("--profile <name>", "Profile name", "default")
    .option("--base-url <url>", "Base URL", "https://e621.net")
    .requiredOption("--username <name>", "e621 username used for auth and the fixed User-Agent")
    .option("--api-key <key>", "e621 API key")
    .action(async (options) => {
      const globals = program.opts<GlobalOptions>();
      const configPath = globals.config ?? defaultConfigPath();
      const file = await loadConfigFile(configPath);
      file.defaultProfile = options.profile;
      file.profiles[options.profile] = {
        ...(file.profiles[options.profile] ?? {}),
        baseUrl: normalizeBaseUrl(options.baseUrl),
        username: options.username,
        apiKey: options.apiKey
      };
      await saveConfigFile(file, configPath);
      emitResult(program, successEnvelope(redactConfig(file), { command: "config.init", configPath }));
    });

  config
    .command("set")
    .argument("<key>", "base-url, username, or api-key")
    .argument("<value>", "Value")
    .option("--profile <name>", "Profile name")
    .description("Set a profile value.")
    .action(async (key: string, value: string, options) => {
      const globals = program.opts<GlobalOptions>();
      const configPath = globals.config ?? defaultConfigPath();
      const file = await loadConfigFile(configPath);
      const profile = options.profile ?? globals.profile ?? file.defaultProfile ?? "default";
      const configKey = normalizeConfigKey(key);
      file.defaultProfile ??= profile;
      file.profiles[profile] ??= {};
      file.profiles[profile][configKey] = configKey === "baseUrl" ? normalizeBaseUrl(value) : value;
      await saveConfigFile(file, configPath);
      emitResult(program, successEnvelope(redactConfig(file.profiles[profile]), { command: "config.set", profile, configPath }));
    });

  config
    .command("get")
    .argument("[key]", "Optional key")
    .option("--profile <name>", "Profile name")
    .option("--show-secrets", "Print secrets without redaction.")
    .description("Get profile config.")
    .action(async (key: string | undefined, options) => {
      const globals = program.opts<GlobalOptions>();
      const configPath = globals.config ?? defaultConfigPath();
      const file = await loadConfigFile(configPath);
      const profile = options.profile ?? globals.profile ?? file.defaultProfile ?? "default";
      const data = key ? file.profiles[profile]?.[normalizeConfigKey(key)] : file.profiles[profile];
      emitResult(program, successEnvelope(options.showSecrets ? data : redact(data ?? {}), { command: "config.get", profile, configPath }));
    });

  config
    .command("list")
    .option("--show-secrets", "Print secrets without redaction.")
    .description("List configured profiles.")
    .action(async (options) => {
      const globals = program.opts<GlobalOptions>();
      const configPath = globals.config ?? defaultConfigPath();
      const file = await loadConfigFile(configPath);
      emitResult(program, successEnvelope(options.showSecrets ? file : redactConfig(file), { command: "config.list", configPath }));
    });

  config
    .command("profile")
    .argument("[name]", "Profile to set as default")
    .description("Show or set the default profile.")
    .action(async (name: string | undefined) => {
      const globals = program.opts<GlobalOptions>();
      const configPath = globals.config ?? defaultConfigPath();
      const file = await loadConfigFile(configPath);
      if (name) {
        file.defaultProfile = name;
        file.profiles[name] ??= {};
        await saveConfigFile(file, configPath);
      }
      emitResult(program, successEnvelope({ defaultProfile: file.defaultProfile ?? "default" }, { command: "config.profile", configPath }));
    });
}
