import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { CliError } from "./errors.js";

export type ProfileConfig = {
  baseUrl?: string;
  username?: string;
  /** @deprecated Use username. Kept so older config files continue to work. */
  login?: string;
  apiKey?: string;
  /** @deprecated User-Agent is derived from username and is no longer configurable. */
  userAgent?: string;
};

export type ConfigFile = {
  defaultProfile?: string;
  profiles: Record<string, ProfileConfig>;
};

export type ConfigLoadOptions = {
  configPath?: string;
  profile?: string;
};

export type ResolvedConfig = Required<Pick<ProfileConfig, "baseUrl">> &
  Omit<ProfileConfig, "userAgent"> & {
    profile: string;
    configPath: string;
  };

const defaultBaseUrl = "https://e621.net";
const fixedUserAgentVersion = "1.0";

export function defaultConfigPath(): string {
  if (process.env.E621_CONFIG_PATH) return process.env.E621_CONFIG_PATH;
  if (process.env.E621_CONFIG_DIR) return join(process.env.E621_CONFIG_DIR, "config.json");
  if (process.platform === "win32" && process.env.APPDATA) return join(process.env.APPDATA, "e621-cli", "config.json");
  if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, "e621-cli", "config.json");
  return join(homedir(), ".config", "e621-cli", "config.json");
}

export async function loadConfigFile(configPath = defaultConfigPath()): Promise<ConfigFile> {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as ConfigFile;
    return {
      defaultProfile: parsed.defaultProfile,
      profiles: parsed.profiles ?? {}
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { defaultProfile: "default", profiles: {} };
    }
    if (error instanceof SyntaxError) {
      throw new CliError(`Invalid JSON config at ${configPath}`, { type: "ConfigError" });
    }
    throw error;
  }
}

export async function saveConfigFile(config: ConfigFile, configPath = defaultConfigPath()): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function resolveConfig(options: ConfigLoadOptions = {}): Promise<ResolvedConfig> {
  const configPath = options.configPath ?? defaultConfigPath();
  const file = await loadConfigFile(configPath);
  const profileName = process.env.E621_PROFILE ?? options.profile ?? file.defaultProfile ?? "default";
  const profile = file.profiles[profileName] ?? {};

  return {
    profile: profileName,
    configPath,
    baseUrl: normalizeBaseUrl(process.env.E621_BASE_URL ?? profile.baseUrl ?? defaultBaseUrl),
    username: process.env.E621_USERNAME ?? process.env.E621_LOGIN ?? profile.username ?? profile.login,
    login: process.env.E621_LOGIN ?? profile.login,
    apiKey: process.env.E621_API_KEY ?? profile.apiKey
  };
}

export function buildUserAgent(config: Pick<ResolvedConfig, "username" | "login">): string {
  const username = authUsername(config);
  if (!username) {
    throw new CliError(
      "An e621 username is required to build the User-Agent. Set E621_USERNAME or run `e621 config set username <name>`.",
      { type: "MissingUsername" }
    );
  }

  if (/[\r\n]/.test(username)) {
    throw new CliError("Username cannot contain newlines.", {
      type: "InvalidUsername"
    });
  }

  return `e621-cli/${fixedUserAgentVersion} (by ${username} on e621)`;
}

export function hasAuth(config: ResolvedConfig): boolean {
  return Boolean(authUsername(config) && config.apiKey);
}

export function authUsername(config: Pick<ResolvedConfig, "username" | "login">): string | undefined {
  return config.username?.trim() || config.login?.trim() || undefined;
}

export function redactConfig<T extends ProfileConfig | ResolvedConfig | ConfigFile>(value: T): T {
  return redact(value) as T;
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/api[-_]?key|password|token|secret/i.test(key)) {
      result[key] = item ? "[redacted]" : item;
    } else {
      result[key] = redact(item);
    }
  }
  return result;
}

export function normalizeConfigKey(key: string): keyof ProfileConfig {
  const normalized = key.trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "base-url" || normalized === "baseurl") return "baseUrl";
  if (normalized === "login" || normalized === "username" || normalized === "user") return "username";
  if (normalized === "api-key" || normalized === "apikey" || normalized === "key") return "apiKey";
  throw new CliError(`Unknown config key "${key}". Use base-url, username, or api-key.`, { type: "InvalidArgument" });
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new CliError(`Invalid base URL "${baseUrl}". Include http:// or https://.`, { type: "ConfigError" });
  }
  return trimmed.replace(/\/+$/, "");
}
