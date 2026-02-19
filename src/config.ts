import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { ConfigSchema, type Config } from "./types.ts";

const CONFIG_DIR = join(homedir(), ".config", "safe-gh");
const CONFIG_PATH = join(CONFIG_DIR, "config.jsonc");

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found: ${CONFIG_PATH}\nCreate one from config.sample.jsonc.`
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

  cached = result.data;
  return cached;
}
