import type { ErrorResponse } from "../types.ts";

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function handleError(error: unknown): never {
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

  // gh CLI errors
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

function isGhCliError(
  error: unknown
): error is { stderr: string; exitCode: number; code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    "exitCode" in error &&
    "code" in error
  );
}
