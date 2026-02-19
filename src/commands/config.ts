import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { outputJson, handleError } from "./utils.ts";

const CONFIG_DIR = join(homedir(), ".config", "safe-gh");
const CONFIG_PATH = join(CONFIG_DIR, "config.jsonc");

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

export function createConfigCommand(): Command {
  const config = new Command("config").description("Configuration management");

  config
    .command("init")
    .description("Create a config template")
    .action(() => {
      try {
        if (existsSync(CONFIG_PATH)) {
          throw new Error(`Config file already exists: ${CONFIG_PATH}`);
        }

        const selfUserId = resolveGhLogin();

        const template = `{
  "$schema": "https://raw.githubusercontent.com/shoppingjaws/safe-gh/refs/heads/main/config.schema.json",
  // Safe GH - Configuration
  // issueEdit / issueComment sections define rules for each command.
  // Rules are evaluated in order; first matching rule applies.

  // Global owner restriction: only these orgs/users are allowed
  "allowedOwners": ["my-org"],

  "issueEdit": [
    {
      "name": "Edit assigned issues",
      "condition": { "assignee": "self" }
    }
  ],

  "issueComment": [
    {
      "name": "Comment on any issue"
    }
  ],

  // GitHub user ID for "createdBy": "self" / "assignee": "self" conditions
  "selfUserId": "${selfUserId}",
  // Default behavior when no rule matches
  "defaultPermission": "deny"
}
`;

        mkdirSync(dirname(CONFIG_PATH), { recursive: true });
        writeFileSync(CONFIG_PATH, template, "utf-8");

        outputJson({ success: true, path: CONFIG_PATH });
      } catch (error) {
        handleError(error);
      }
    });

  return config;
}
