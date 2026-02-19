import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

export interface DryRunOutput {
  dryRun: boolean;
  resource: string;
  operation: string;
  context: Record<string, unknown>;
  allowed: boolean;
  ruleName?: string;
  reason: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  parsed: DryRunOutput | null;
}

export function createConfigDir(config: Record<string, unknown>): {
  homeDir: string;
  cleanup: () => void;
} {
  const homeDir = join(tmpdir(), `safe-gh-test-${randomUUID()}`);
  const configDir = join(homeDir, ".config", "safe-gh");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, "config.jsonc"),
    JSON.stringify(config, null, 2),
    "utf-8"
  );
  return {
    homeDir,
    cleanup: () => rmSync(homeDir, { recursive: true, force: true }),
  };
}

export async function runSafeGh(
  args: string[],
  homeDir: string
): Promise<RunResult> {
  const proc = Bun.spawn(
    ["bun", "run", join(process.cwd(), "dist", "index.js"), "--dry-run", ...args],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOME: homeDir,
        GH_TOKEN: "",
        GITHUB_TOKEN: "",
        GH_ENTERPRISE_TOKEN: "",
      },
    }
  );

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  let parsed: DryRunOutput | null = null;
  try {
    const obj = JSON.parse(stdout);
    if (obj && typeof obj === "object" && "dryRun" in obj) {
      parsed = obj as DryRunOutput;
    }
  } catch {
    // not JSON or not dry-run output
  }

  return { stdout, stderr, exitCode, parsed };
}

export async function runSafeGhRaw(
  args: string[],
  homeDir: string
): Promise<RunResult> {
  const proc = Bun.spawn(
    ["bun", "run", join(process.cwd(), "dist", "index.js"), ...args],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOME: homeDir,
        GH_TOKEN: "",
        GITHUB_TOKEN: "",
        GH_ENTERPRISE_TOKEN: "",
      },
    }
  );

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  let parsed: DryRunOutput | null = null;
  try {
    const obj = JSON.parse(stdout);
    if (obj && typeof obj === "object" && "dryRun" in obj) {
      parsed = obj as DryRunOutput;
    }
  } catch {
    // not JSON
  }

  return { stdout, stderr, exitCode, parsed };
}
