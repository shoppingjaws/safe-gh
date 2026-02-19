import type { Enforce, ErrorResponse } from "../types.ts";
import { DryRunResult, isGhCliError } from "../gh.ts";

export function appendMarker(body: string): string {
  return `${body}\n<!-- safe-gh: ${new Date().toISOString()} -->`;
}

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function buildEnforceArgs(
  enforce: Enforce,
  selfUserId: string | undefined
): string[] {
  const args: string[] = [];

  function resolveSelf(value: string): string {
    if (value === "self") {
      if (!selfUserId) {
        throw {
          error:
            'enforce uses "self" but selfUserId is not configured. Set selfUserId in config.',
          code: "CONFIG_ERROR",
        } satisfies ErrorResponse;
      }
      return selfUserId;
    }
    return value;
  }

  if (enforce.addLabels) {
    for (const label of enforce.addLabels) {
      args.push("--add-label", label);
    }
  }
  if (enforce.removeLabels) {
    for (const label of enforce.removeLabels) {
      args.push("--remove-label", label);
    }
  }
  if (enforce.addAssignees) {
    for (const assignee of enforce.addAssignees) {
      args.push("--add-assignee", resolveSelf(assignee));
    }
  }
  if (enforce.removeAssignees) {
    for (const assignee of enforce.removeAssignees) {
      args.push("--remove-assignee", resolveSelf(assignee));
    }
  }

  return args;
}

export function handleError(error: unknown): never {
  if (error instanceof DryRunResult) {
    outputJson({
      dryRun: true,
      command: error.command,
      context: error.context,
      allowed: error.result.allowed,
      ruleName: error.result.ruleName,
      reason: error.result.reason,
      enforce: error.result.enforce,
    });
    process.exit(0);
  }

  if (isErrorResponse(error)) {
    outputJson(error);
    process.exit(1);
  }

  if (error instanceof Error) {
    const response: ErrorResponse = {
      error: error.message,
      code: "UNKNOWN_ERROR",
    };
    outputJson(response);
    process.exit(1);
  }

  if (isGhCliError(error)) {
    const response: ErrorResponse = {
      error: error.stderr || "gh CLI error",
      code: "GH_CLI_ERROR",
      details: { exitCode: error.exitCode },
    };
    outputJson(response);
    process.exit(1);
  }

  const response: ErrorResponse = {
    error: String(error),
    code: "UNKNOWN_ERROR",
  };
  outputJson(response);
  process.exit(1);
}

function isErrorResponse(error: unknown): error is ErrorResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    "code" in error
  );
}
