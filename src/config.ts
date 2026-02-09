import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

function resolveGhLogin(): string {
  try {
    return execFileSync("gh", ["api", "user", "--jq", ".login"], {
      encoding: "utf-8",
      timeout: 10_000,
    }).trim();
  } catch {
    return "";
  }
}

export function initConfig(): string {
  if (existsSync(CONFIG_PATH)) {
    throw new Error(`Config file already exists: ${CONFIG_PATH}`);
  }

  const selfUserId = resolveGhLogin();

  const template = `{
  "$schema": "https://raw.githubusercontent.com/shoppingjaws/safe-gh/refs/heads/main/config.schema.json",
  // Safe GH - Configuration
  // Each section (issueRules / prRules / searchRules / projectRules)
  // has its own set of operations and conditions.
  // Rules are evaluated in order; first matching rule applies.

  "issueRules": [
    {
      "name": "Read only",
      "operations": ["list", "view", "list:comments"],
      "condition": { "owners": ["my-org"] }
    },
    {
      "name": "Comment and manage own comments",
      "operations": ["comment", "comment:edit", "comment:delete"],
      "condition": { "owners": ["my-org"] }
    },
    {
      "name": "Manage assigned issues",
      "operations": ["update", "close", "reopen"],
      "condition": { "assignee": "self", "owners": ["my-org"] }
    }
  ],

  "prRules": [
    {
      "name": "Read only",
      "operations": ["list", "view", "diff", "checks", "list:comments"],
      "condition": { "owners": ["my-org"] }
    },
    {
      "name": "Comment and manage own comments",
      "operations": ["comment", "comment:edit", "comment:delete"],
      "condition": { "owners": ["my-org"] }
    }
  ],

  "searchRules": [
    {
      "name": "Search within org",
      "operations": ["code", "issues", "prs", "repos", "commits"],
      "condition": { "owners": ["my-org"] }
    }
  ],

  "projectRules": [
    {
      "name": "Read all projects",
      "operations": ["list", "view", "item:list", "field:list"]
    }
  ],

  // GitHub user ID for "createdBy": "self" / "assignee": "self" conditions
  "selfUserId": "${selfUserId}",
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
