import type { ErrorResponse, IssueContext, PermissionCheckResult } from "./types.ts";

// ============================================================
// Dry-run support
// ============================================================

let dryRunEnabled = false;

export function setDryRun(enabled: boolean): void {
  dryRunEnabled = enabled;
}

export function isDryRun(): boolean {
  return dryRunEnabled;
}

export class DryRunResult {
  readonly command: string;
  readonly context: IssueContext;
  readonly result: PermissionCheckResult;

  constructor(
    command: string,
    context: IssueContext,
    result: PermissionCheckResult
  ) {
    this.command = command;
    this.context = context;
    this.result = result;
  }
}

// ============================================================
// gh CLI execution
// ============================================================

interface GhCliError {
  stderr: string;
  exitCode: number;
  code: "GH_CLI_ERROR";
}

export function isGhCliError(error: unknown): error is GhCliError {
  return (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    "exitCode" in error &&
    "code" in error &&
    (error as GhCliError).code === "GH_CLI_ERROR"
  );
}

export async function execGh(args: string[]): Promise<string> {
  const proc = Bun.spawn(["gh", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw {
      stderr: stderr.trim(),
      exitCode,
      code: "GH_CLI_ERROR",
    } as GhCliError;
  }

  return stdout;
}

// ============================================================
// Repo resolution
// ============================================================

export async function resolveRepo(repoFlag?: string): Promise<string> {
  if (repoFlag) return repoFlag;

  const result = await execGh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  return result.trim();
}

// ============================================================
// GraphQL context fetch
// ============================================================

const ISSUE_CONTEXT_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      author { login }
      labels(first: 50) { nodes { name } }
      assignees(first: 20) { nodes { login } }
    }
  }
}`;

interface GraphQLIssueResponse {
  data: {
    repository: {
      issue: {
        author: { login: string };
        labels: { nodes: Array<{ name: string }> };
        assignees: { nodes: Array<{ login: string }> };
      };
    };
  };
}

export async function fetchIssueContext(
  issueNumber: number,
  repo: string
): Promise<IssueContext> {
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    throw new Error(`Invalid repo format: ${repo}. Expected owner/repo`);
  }

  const result = await execGh([
    "api",
    "graphql",
    "-f",
    `query=${ISSUE_CONTEXT_QUERY}`,
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${repoName}`,
    "-F",
    `number=${issueNumber}`,
  ]);

  const response = JSON.parse(result) as GraphQLIssueResponse;
  const issue = response.data.repository.issue;

  return {
    repo,
    issueNumber,
    issueAuthor: issue.author.login,
    labels: issue.labels.nodes.map((l) => l.name),
    assignees: issue.assignees.nodes.map((a) => a.login),
  };
}

// ============================================================
// Issue node ID fetch
// ============================================================

const ISSUE_NODE_ID_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) { id }
  }
}`;

interface GraphQLNodeIdResponse {
  data: {
    repository: {
      issue: { id: string };
    };
  };
  errors?: Array<{ message: string }>;
}

export async function fetchIssueNodeId(
  issueNumber: number,
  repo: string
): Promise<string> {
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    throw new Error(`Invalid repo format: ${repo}. Expected owner/repo`);
  }

  const result = await execGh([
    "api",
    "graphql",
    "-f",
    `query=${ISSUE_NODE_ID_QUERY}`,
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${repoName}`,
    "-F",
    `number=${issueNumber}`,
  ]);

  const response = JSON.parse(result) as GraphQLNodeIdResponse;

  if (response.errors && response.errors.length > 0) {
    throw {
      error: response.errors.map((e) => e.message).join("; "),
      code: "GRAPHQL_ERROR",
    } satisfies ErrorResponse;
  }

  return response.data.repository.issue.id;
}

// ============================================================
// GraphQL mutation execution
// ============================================================

interface GraphQLMutationResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

export async function execGraphQLMutation(
  query: string,
  variables: Record<string, string>,
  headers?: Record<string, string>
): Promise<string> {
  const args = ["api", "graphql", "-f", `query=${query}`];

  for (const [key, value] of Object.entries(variables)) {
    args.push("-F", `${key}=${value}`);
  }

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      args.push("-H", `${key}: ${value}`);
    }
  }

  const result = await execGh(args);
  const response = JSON.parse(result) as GraphQLMutationResponse;

  if (response.errors && response.errors.length > 0) {
    throw {
      error: response.errors.map((e) => e.message).join("; "),
      code: "GRAPHQL_ERROR",
    } satisfies ErrorResponse;
  }

  return result;
}
