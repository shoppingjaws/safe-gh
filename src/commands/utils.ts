import type { ErrorResponse } from "../types.ts";
import { DryRunResult, isGhCliError } from "../gh.ts";

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
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
