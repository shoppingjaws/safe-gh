import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { ConfigSchema, type Config } from "./types.ts";

const CONFIG_DIR = join(homedir(), ".config", "safe-gh");
const CONFIG_PATH = join(CONFIG_DIR, "config.jsonc");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found: ${CONFIG_PATH}\nRun 'safe-gh config init' to create a template.`
    );
  }

  const content = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = parseJsonc(content);

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid config file:\n${errors}`);
  }

  return result.data;
}

export function validateConfig(configPath?: string): {
  valid: boolean;
  errors?: string[];
} {
  const path = configPath ?? CONFIG_PATH;

  if (!existsSync(path)) {
    return { valid: false, errors: [`Config file not found: ${path}`] };
  }

  try {
    const content = readFileSync(path, "utf-8");
    const parsed = parseJsonc(content);
    const result = ConfigSchema.safeParse(parsed);

    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map(
          (e) => `${e.path.join(".")}: ${e.message}`
        ),
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

export function initConfig(): string {
  if (existsSync(CONFIG_PATH)) {
    throw new Error(`Config file already exists: ${CONFIG_PATH}`);
  }

  const template = `{
  // Safe GH - Configuration
  // Each section (issueRules / prRules / searchRules / projectRules)
  // has its own set of operations and conditions.
  // Rules are evaluated in order; first matching rule applies.

  "issueRules": [
    {
      "name": "Read only",
      "operations": ["read"]
    },
    {
      "name": "Comment and manage own comments",
      "operations": ["comment", "comment:edit", "comment:delete"]
    },
    {
      "name": "Manage assigned issues",
      "operations": ["update", "close", "reopen"],
      "condition": { "assignee": "self" }
    }
  ],

  "prRules": [
    {
      "name": "Read only",
      "operations": ["read"]
    },
    {
      "name": "Comment and manage own comments",
      "operations": ["comment", "comment:edit", "comment:delete"]
    }
  ],

  "searchRules": [
    {
      "name": "Search all",
      "operations": ["code", "issues", "prs", "repos", "commits"]
    }
  ],

  "projectRules": [
    {
      "name": "Read all projects",
      "operations": ["read"]
    }
  ],

  // AI marker settings for comments
  "aiMarker": {
    "enabled": true,
    "visiblePrefix": "🤖 "
  },
  // GitHub user ID for "createdBy": "self" / "assignee": "self" conditions
  // Get your user ID with: gh api user --jq .login
  "selfUserId": "",
  // Default behavior when no rule matches: "deny" or "read"
  "defaultPermission": "deny"
}
`;

  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, template, "utf-8");

  return CONFIG_PATH;
}

export function showConfig(): Config | null {
  try {
    return loadConfig();
  } catch {
    return null;
  }
}
