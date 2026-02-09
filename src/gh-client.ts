import { loadConfig } from "./config.ts";
import { checkPermission, operationNeedsContext } from "./permissions.ts";
import type {
  Config,
  OperationContext,
  Issue,
  PullRequest,
  Comment,
  ErrorResponse,
  ResourceType,
  IssueOperation,
  PrOperation,
  SearchOperation,
  ProjectOperation,
} from "./types.ts";

let configInstance: Config | null = null;

function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

interface GhCliError {
  stderr: string;
  exitCode: number;
  code: "GH_CLI_ERROR";
}

function isGhCliError(error: unknown): error is GhCliError {
  return (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    "exitCode" in error &&
    "code" in error
  );
}

async function execGh(args: string[]): Promise<string> {
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
// Permission helpers
// ============================================================

function ensurePermission(
  resource: "issue",
  operation: IssueOperation,
  context: OperationContext
): void;
function ensurePermission(
  resource: "pr",
  operation: PrOperation,
  context: OperationContext
): void;
function ensurePermission(
  resource: "search",
  operation: SearchOperation,
  context: OperationContext
): void;
function ensurePermission(
  resource: "project",
  operation: ProjectOperation,
  context: OperationContext
): void;
function ensurePermission(
  resource: ResourceType,
  operation: string,
  context: OperationContext
): void {
  const config = getConfig();
  const result = checkPermission(
    config,
    resource as "issue",
    operation as IssueOperation,
    context
  );

  if (!result.allowed) {
    const error: ErrorResponse = {
      error: result.reason,
      code: "PERMISSION_DENIED",
      details: { resource, operation, context },
    };
    throw error;
  }
}

// ============================================================
// Context fetchers
// ============================================================

async function getIssueContext(
  issueNumber: number,
  repo?: string
): Promise<OperationContext> {
  const args = [
    "issue",
    "view",
    String(issueNumber),
    "--json",
    "author,labels,assignees",
  ];
  if (repo) args.push("-R", repo);

  const result = await execGh(args);
  const issue = JSON.parse(result) as {
    author: { login: string };
    labels: Array<{ name: string }>;
    assignees: Array<{ login: string }>;
  };

  return {
    repo,
    issueNumber,
    issueAuthor: issue.author.login,
    labels: issue.labels.map((l) => l.name),
    assignees: issue.assignees.map((a) => a.login),
  };
}

async function getPrContext(
  prNumber: number,
  repo?: string
): Promise<OperationContext> {
  const args = [
    "pr",
    "view",
    String(prNumber),
    "--json",
    "author,labels,assignees,isDraft,baseRefName,headRefName,reviewDecision",
  ];
  if (repo) args.push("-R", repo);

  const result = await execGh(args);
  const pr = JSON.parse(result) as {
    author: { login: string };
    labels: Array<{ name: string }>;
    assignees: Array<{ login: string }>;
    isDraft: boolean;
    baseRefName: string;
    headRefName: string;
    reviewDecision?: string;
  };

  return {
    repo,
    prNumber,
    prAuthor: pr.author.login,
    labels: pr.labels.map((l) => l.name),
    assignees: pr.assignees.map((a) => a.login),
    draft: pr.isDraft,
    baseBranch: pr.baseRefName,
    headBranch: pr.headRefName,
    reviewDecision: pr.reviewDecision ?? undefined,
  };
}

// ============================================================
// Issue operations
// ============================================================

export async function listIssues(repo?: string): Promise<Issue[]> {
  const context: OperationContext = { repo };
  ensurePermission("issue", "read", context);

  const args = [
    "issue",
    "list",
    "--json",
    "number,title,state,author,labels,assignees,body,url,createdAt,updatedAt",
  ];
  if (repo) args.push("-R", repo);

  const result = await execGh(args);
  return JSON.parse(result) as Issue[];
}

export async function viewIssue(
  issueNumber: number,
  repo?: string
): Promise<Issue> {
  const context: OperationContext = { repo, issueNumber };
  ensurePermission("issue", "read", context);

  const args = [
    "issue",
    "view",
    String(issueNumber),
    "--json",
    "number,title,state,author,labels,assignees,body,url,createdAt,updatedAt",
  ];
  if (repo) args.push("-R", repo);

  const result = await execGh(args);
  return JSON.parse(result) as Issue;
}

export async function createIssue(
  title: string,
  opts: { body?: string; labels?: string[]; assignees?: string[]; repo?: string }
): Promise<string> {
  const context: OperationContext = {
    repo: opts.repo,
    labels: opts.labels,
  };
  ensurePermission("issue", "create", context);

  const args = ["issue", "create", "--title", title];
  if (opts.body) args.push("--body", opts.body);
  if (opts.labels?.length) args.push("--label", opts.labels.join(","));
  if (opts.assignees?.length) args.push("--assignee", opts.assignees.join(","));
  if (opts.repo) args.push("-R", opts.repo);

  return await execGh(args);
}

export async function editIssue(
  issueNumber: number,
  opts: { title?: string; body?: string; addLabels?: string[]; removeLabels?: string[]; addAssignees?: string[]; removeAssignees?: string[]; repo?: string }
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("issue", "update")) {
    context = await getIssueContext(issueNumber, opts.repo);
  } else {
    context = { repo: opts.repo, issueNumber };
  }
  ensurePermission("issue", "update", context);

  const args = ["issue", "edit", String(issueNumber)];
  if (opts.title) args.push("--title", opts.title);
  if (opts.body) args.push("--body", opts.body);
  if (opts.addLabels?.length) args.push("--add-label", opts.addLabels.join(","));
  if (opts.removeLabels?.length) args.push("--remove-label", opts.removeLabels.join(","));
  if (opts.addAssignees?.length) args.push("--add-assignee", opts.addAssignees.join(","));
  if (opts.removeAssignees?.length) args.push("--remove-assignee", opts.removeAssignees.join(","));
  if (opts.repo) args.push("-R", opts.repo);

  await execGh(args);
}

export async function closeIssue(
  issueNumber: number,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("issue", "close")) {
    context = await getIssueContext(issueNumber, repo);
  } else {
    context = { repo, issueNumber };
  }
  ensurePermission("issue", "close", context);

  const args = ["issue", "close", String(issueNumber)];
  if (repo) args.push("-R", repo);

  await execGh(args);
}

export async function reopenIssue(
  issueNumber: number,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("issue", "reopen")) {
    context = await getIssueContext(issueNumber, repo);
  } else {
    context = { repo, issueNumber };
  }
  ensurePermission("issue", "reopen", context);

  const args = ["issue", "reopen", String(issueNumber)];
  if (repo) args.push("-R", repo);

  await execGh(args);
}

export async function deleteIssue(
  issueNumber: number,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("issue", "delete")) {
    context = await getIssueContext(issueNumber, repo);
  } else {
    context = { repo, issueNumber };
  }
  ensurePermission("issue", "delete", context);

  const args = ["issue", "delete", String(issueNumber), "--yes"];
  if (repo) args.push("-R", repo);

  await execGh(args);
}

export async function commentIssue(
  issueNumber: number,
  body: string,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("issue", "comment")) {
    context = await getIssueContext(issueNumber, repo);
  } else {
    context = { repo, issueNumber };
  }
  ensurePermission("issue", "comment", context);

  const args = ["issue", "comment", String(issueNumber), "--body", body];
  if (repo) args.push("-R", repo);

  await execGh(args);
}

export async function getComment(
  issueNumber: number,
  commentId: number,
  repo?: string
): Promise<Comment> {
  const apiPath = repo
    ? `/repos/${repo}/issues/comments/${commentId}`
    : `/repos/{owner}/{repo}/issues/comments/${commentId}`;

  const args = ["api", apiPath, "--jq", "."];

  const result = await execGh(args);
  const comment = JSON.parse(result) as {
    id: number;
    body: string;
    user: { login: string };
    created_at: string;
    updated_at: string;
  };

  return {
    id: comment.id,
    body: comment.body,
    author: { login: comment.user.login },
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
}

export async function editComment(
  issueNumber: number,
  commentId: number,
  newBody: string,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("issue", "comment:edit")) {
    context = await getIssueContext(issueNumber, repo);
  } else {
    context = { repo, issueNumber };
  }
  ensurePermission("issue", "comment:edit", context);

  const apiPath = repo
    ? `/repos/${repo}/issues/comments/${commentId}`
    : `/repos/{owner}/{repo}/issues/comments/${commentId}`;

  await execGh(["api", apiPath, "-X", "PATCH", "-f", `body=${newBody}`]);
}

export async function deleteComment(
  issueNumber: number,
  commentId: number,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("issue", "comment:delete")) {
    context = await getIssueContext(issueNumber, repo);
  } else {
    context = { repo, issueNumber };
  }
  ensurePermission("issue", "comment:delete", context);

  const apiPath = repo
    ? `/repos/${repo}/issues/comments/${commentId}`
    : `/repos/{owner}/{repo}/issues/comments/${commentId}`;

  await execGh(["api", apiPath, "-X", "DELETE"]);
}

export async function listComments(
  issueNumber: number,
  repo?: string
): Promise<Comment[]> {
  const context: OperationContext = { repo, issueNumber };
  ensurePermission("issue", "read", context);

  const apiPath = repo
    ? `/repos/${repo}/issues/${issueNumber}/comments`
    : `/repos/{owner}/{repo}/issues/${issueNumber}/comments`;

  const result = await execGh(["api", apiPath, "--jq", "."]);
  const comments = JSON.parse(result) as Array<{
    id: number;
    body: string;
    user: { login: string };
    created_at: string;
    updated_at: string;
  }>;

  return comments.map((c) => ({
    id: c.id,
    body: c.body,
    author: { login: c.user.login },
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

// ============================================================
// PR operations
// ============================================================

export async function listPrs(repo?: string): Promise<PullRequest[]> {
  const context: OperationContext = { repo };
  ensurePermission("pr", "read", context);

  const args = [
    "pr",
    "list",
    "--json",
    "number,title,state,author,labels,assignees,isDraft,baseRefName,headRefName,reviewDecision,body,url,createdAt,updatedAt",
  ];
  if (repo) args.push("-R", repo);

  const result = await execGh(args);
  return JSON.parse(result) as PullRequest[];
}

export async function viewPr(
  prNumber: number,
  repo?: string
): Promise<PullRequest> {
  const context: OperationContext = { repo, prNumber };
  ensurePermission("pr", "read", context);

  const args = [
    "pr",
    "view",
    String(prNumber),
    "--json",
    "number,title,state,author,labels,assignees,isDraft,baseRefName,headRefName,reviewDecision,body,url,createdAt,updatedAt",
  ];
  if (repo) args.push("-R", repo);

  const result = await execGh(args);
  return JSON.parse(result) as PullRequest;
}

export async function createPr(opts: {
  title: string;
  body?: string;
  base?: string;
  head?: string;
  draft?: boolean;
  labels?: string[];
  assignees?: string[];
  repo?: string;
}): Promise<string> {
  // pr:create uses CLI args to synthesize context (no existing PR to fetch)
  const context: OperationContext = {
    repo: opts.repo,
    baseBranch: opts.base,
    headBranch: opts.head,
    draft: opts.draft,
    labels: opts.labels,
  };
  ensurePermission("pr", "create", context);

  const args = ["pr", "create", "--title", opts.title];
  if (opts.body) args.push("--body", opts.body);
  if (opts.base) args.push("--base", opts.base);
  if (opts.head) args.push("--head", opts.head);
  if (opts.draft) args.push("--draft");
  if (opts.labels?.length) args.push("--label", opts.labels.join(","));
  if (opts.assignees?.length) args.push("--assignee", opts.assignees.join(","));
  if (opts.repo) args.push("-R", opts.repo);

  return await execGh(args);
}

export async function editPr(
  prNumber: number,
  opts: { title?: string; body?: string; base?: string; addLabels?: string[]; removeLabels?: string[]; addAssignees?: string[]; removeAssignees?: string[]; repo?: string }
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("pr", "update")) {
    context = await getPrContext(prNumber, opts.repo);
  } else {
    context = { repo: opts.repo, prNumber };
  }
  ensurePermission("pr", "update", context);

  const args = ["pr", "edit", String(prNumber)];
  if (opts.title) args.push("--title", opts.title);
  if (opts.body) args.push("--body", opts.body);
  if (opts.base) args.push("--base", opts.base);
  if (opts.addLabels?.length) args.push("--add-label", opts.addLabels.join(","));
  if (opts.removeLabels?.length) args.push("--remove-label", opts.removeLabels.join(","));
  if (opts.addAssignees?.length) args.push("--add-assignee", opts.addAssignees.join(","));
  if (opts.removeAssignees?.length) args.push("--remove-assignee", opts.removeAssignees.join(","));
  if (opts.repo) args.push("-R", opts.repo);

  await execGh(args);
}

export async function closePr(
  prNumber: number,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("pr", "close")) {
    context = await getPrContext(prNumber, repo);
  } else {
    context = { repo, prNumber };
  }
  ensurePermission("pr", "close", context);

  const args = ["pr", "close", String(prNumber)];
  if (repo) args.push("-R", repo);

  await execGh(args);
}

export async function reopenPr(
  prNumber: number,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("pr", "reopen")) {
    context = await getPrContext(prNumber, repo);
  } else {
    context = { repo, prNumber };
  }
  ensurePermission("pr", "reopen", context);

  const args = ["pr", "reopen", String(prNumber)];
  if (repo) args.push("-R", repo);

  await execGh(args);
}

export async function mergePr(
  prNumber: number,
  opts: { method?: "merge" | "squash" | "rebase"; deleteRemoteBranch?: boolean; repo?: string }
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("pr", "merge")) {
    context = await getPrContext(prNumber, opts.repo);
  } else {
    context = { repo: opts.repo, prNumber };
  }
  ensurePermission("pr", "merge", context);

  const args = ["pr", "merge", String(prNumber)];
  if (opts.method === "squash") args.push("--squash");
  else if (opts.method === "rebase") args.push("--rebase");
  else args.push("--merge");
  if (opts.deleteRemoteBranch) args.push("--delete-branch");
  if (opts.repo) args.push("-R", opts.repo);

  await execGh(args);
}

export async function reviewPr(
  prNumber: number,
  opts: { approve?: boolean; requestChanges?: boolean; comment?: boolean; body?: string; repo?: string }
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("pr", "review")) {
    context = await getPrContext(prNumber, opts.repo);
  } else {
    context = { repo: opts.repo, prNumber };
  }
  ensurePermission("pr", "review", context);

  const args = ["pr", "review", String(prNumber)];
  if (opts.approve) args.push("--approve");
  else if (opts.requestChanges) args.push("--request-changes");
  else if (opts.comment) args.push("--comment");
  if (opts.body) args.push("--body", opts.body);
  if (opts.repo) args.push("-R", opts.repo);

  await execGh(args);
}

export async function diffPr(
  prNumber: number,
  repo?: string
): Promise<string> {
  const context: OperationContext = { repo, prNumber };
  ensurePermission("pr", "read", context);

  const args = ["pr", "diff", String(prNumber)];
  if (repo) args.push("-R", repo);

  return await execGh(args);
}

export async function checksPr(
  prNumber: number,
  repo?: string
): Promise<string> {
  const context: OperationContext = { repo, prNumber };
  ensurePermission("pr", "read", context);

  const args = ["pr", "checks", String(prNumber)];
  if (repo) args.push("-R", repo);

  return await execGh(args);
}

export async function updateBranchPr(
  prNumber: number,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("pr", "update-branch")) {
    context = await getPrContext(prNumber, repo);
  } else {
    context = { repo, prNumber };
  }
  ensurePermission("pr", "update-branch", context);

  const args = ["pr", "update-branch", String(prNumber)];
  if (repo) args.push("-R", repo);

  await execGh(args);
}

export async function commentPr(
  prNumber: number,
  body: string,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("pr", "comment")) {
    context = await getPrContext(prNumber, repo);
  } else {
    context = { repo, prNumber };
  }
  ensurePermission("pr", "comment", context);

  const args = ["pr", "comment", String(prNumber), "--body", body];
  if (repo) args.push("-R", repo);

  await execGh(args);
}

export async function listPrComments(
  prNumber: number,
  repo?: string
): Promise<Comment[]> {
  const context: OperationContext = { repo, prNumber };
  ensurePermission("pr", "read", context);

  // PRs use issue comments API (PR is also an issue on GitHub)
  const apiPath = repo
    ? `/repos/${repo}/issues/${prNumber}/comments`
    : `/repos/{owner}/{repo}/issues/${prNumber}/comments`;

  const result = await execGh(["api", apiPath, "--jq", "."]);
  const comments = JSON.parse(result) as Array<{
    id: number;
    body: string;
    user: { login: string };
    created_at: string;
    updated_at: string;
  }>;

  return comments.map((c) => ({
    id: c.id,
    body: c.body,
    author: { login: c.user.login },
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

export async function editPrComment(
  prNumber: number,
  commentId: number,
  newBody: string,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("pr", "comment:edit")) {
    context = await getPrContext(prNumber, repo);
  } else {
    context = { repo, prNumber };
  }
  ensurePermission("pr", "comment:edit", context);

  const apiPath = repo
    ? `/repos/${repo}/issues/comments/${commentId}`
    : `/repos/{owner}/{repo}/issues/comments/${commentId}`;

  await execGh(["api", apiPath, "-X", "PATCH", "-f", `body=${newBody}`]);
}

export async function deletePrComment(
  prNumber: number,
  commentId: number,
  repo?: string
): Promise<void> {
  let context: OperationContext;
  if (operationNeedsContext("pr", "comment:delete")) {
    context = await getPrContext(prNumber, repo);
  } else {
    context = { repo, prNumber };
  }
  ensurePermission("pr", "comment:delete", context);

  const apiPath = repo
    ? `/repos/${repo}/issues/comments/${commentId}`
    : `/repos/{owner}/{repo}/issues/comments/${commentId}`;

  await execGh(["api", apiPath, "-X", "DELETE"]);
}

// ============================================================
// Search operations
// ============================================================

export async function searchCode(
  query: string,
  repo?: string
): Promise<string> {
  const context: OperationContext = { repo };
  ensurePermission("search", "code", context);

  const args = ["search", "code", repo ? `${query} repo:${repo}` : query];
  return await execGh(args);
}

export async function searchIssues(
  query: string,
  repo?: string
): Promise<string> {
  const context: OperationContext = { repo };
  ensurePermission("search", "issues", context);

  const args = ["search", "issues", repo ? `${query} repo:${repo}` : query];
  return await execGh(args);
}

export async function searchPrs(
  query: string,
  repo?: string
): Promise<string> {
  const context: OperationContext = { repo };
  ensurePermission("search", "prs", context);

  const args = ["search", "prs", repo ? `${query} repo:${repo}` : query];
  return await execGh(args);
}

export async function searchRepos(query: string): Promise<string> {
  const context: OperationContext = {};
  ensurePermission("search", "repos", context);

  const args = ["search", "repos", query];
  return await execGh(args);
}

export async function searchCommits(
  query: string,
  repo?: string
): Promise<string> {
  const context: OperationContext = { repo };
  ensurePermission("search", "commits", context);

  const args = ["search", "commits", repo ? `${query} repo:${repo}` : query];
  return await execGh(args);
}

// ============================================================
// Project operations
// ============================================================

export async function listProjects(owner?: string): Promise<string> {
  const context: OperationContext = { projectOwner: owner };
  ensurePermission("project", "read", context);

  const args = ["project", "list"];
  if (owner) args.push("--owner", owner);
  args.push("--format", "json");

  return await execGh(args);
}

export async function viewProject(
  projectNumber: number,
  owner?: string
): Promise<string> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "read", context);

  const args = ["project", "view", String(projectNumber)];
  if (owner) args.push("--owner", owner);
  args.push("--format", "json");

  return await execGh(args);
}

export async function projectFieldList(
  projectNumber: number,
  owner?: string
): Promise<string> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "read", context);

  const args = ["project", "field-list", String(projectNumber)];
  if (owner) args.push("--owner", owner);
  args.push("--format", "json");

  return await execGh(args);
}

export async function projectItemList(
  projectNumber: number,
  owner?: string
): Promise<string> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "read", context);

  const args = ["project", "item-list", String(projectNumber)];
  if (owner) args.push("--owner", owner);
  args.push("--format", "json");

  return await execGh(args);
}

export async function projectCreate(
  title: string,
  owner?: string
): Promise<string> {
  const context: OperationContext = { projectOwner: owner };
  ensurePermission("project", "create", context);

  const args = ["project", "create", "--title", title];
  if (owner) args.push("--owner", owner);
  args.push("--format", "json");

  return await execGh(args);
}

export async function projectEdit(
  projectNumber: number,
  opts: { title?: string; description?: string; visibility?: string; owner?: string }
): Promise<void> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: opts.owner,
  };
  ensurePermission("project", "edit", context);

  const args = ["project", "edit", String(projectNumber)];
  if (opts.title) args.push("--title", opts.title);
  if (opts.description) args.push("--description", opts.description);
  if (opts.visibility) args.push("--visibility", opts.visibility);
  if (opts.owner) args.push("--owner", opts.owner);

  await execGh(args);
}

export async function projectClose(
  projectNumber: number,
  owner?: string
): Promise<void> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "close", context);

  const args = ["project", "close", String(projectNumber)];
  if (owner) args.push("--owner", owner);

  await execGh(args);
}

export async function projectDelete(
  projectNumber: number,
  owner?: string
): Promise<void> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "delete", context);

  const args = ["project", "delete", String(projectNumber)];
  if (owner) args.push("--owner", owner);

  await execGh(args);
}

export async function projectItemAdd(
  projectNumber: number,
  itemUrl: string,
  owner?: string
): Promise<string> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "item:add", context);

  const args = ["project", "item-add", String(projectNumber), "--url", itemUrl];
  if (owner) args.push("--owner", owner);
  args.push("--format", "json");

  return await execGh(args);
}

export async function projectItemCreate(
  projectNumber: number,
  title: string,
  opts: { body?: string; owner?: string }
): Promise<string> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: opts.owner,
  };
  ensurePermission("project", "item:create", context);

  const args = [
    "project",
    "item-create",
    String(projectNumber),
    "--title",
    title,
  ];
  if (opts.body) args.push("--body", opts.body);
  if (opts.owner) args.push("--owner", opts.owner);
  args.push("--format", "json");

  return await execGh(args);
}

export async function projectItemEdit(
  projectNumber: number,
  itemId: string,
  opts: { fieldId: string; text?: string; number?: number; date?: string; singleSelectOptionId?: string; iterationId?: string; owner?: string }
): Promise<void> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: opts.owner,
  };
  ensurePermission("project", "item:edit", context);

  const args = [
    "project",
    "item-edit",
    "--id",
    itemId,
    "--project-id",
    String(projectNumber),
    "--field-id",
    opts.fieldId,
  ];
  if (opts.text !== undefined) args.push("--text", opts.text);
  if (opts.number !== undefined) args.push("--number", String(opts.number));
  if (opts.date) args.push("--date", opts.date);
  if (opts.singleSelectOptionId) args.push("--single-select-option-id", opts.singleSelectOptionId);
  if (opts.iterationId) args.push("--iteration-id", opts.iterationId);

  await execGh(args);
}

export async function projectItemDelete(
  projectNumber: number,
  itemId: string,
  owner?: string
): Promise<void> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "item:delete", context);

  const args = [
    "project",
    "item-delete",
    String(projectNumber),
    "--id",
    itemId,
  ];
  if (owner) args.push("--owner", owner);

  await execGh(args);
}

export async function projectItemArchive(
  projectNumber: number,
  itemId: string,
  owner?: string
): Promise<void> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "item:archive", context);

  const args = [
    "project",
    "item-archive",
    String(projectNumber),
    "--id",
    itemId,
  ];
  if (owner) args.push("--owner", owner);

  await execGh(args);
}

export async function projectFieldCreate(
  projectNumber: number,
  name: string,
  dataType: string,
  owner?: string
): Promise<string> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "field:create", context);

  const args = [
    "project",
    "field-create",
    String(projectNumber),
    "--name",
    name,
    "--data-type",
    dataType,
  ];
  if (owner) args.push("--owner", owner);

  return await execGh(args);
}

export async function projectFieldDelete(
  projectNumber: number,
  fieldId: string,
  owner?: string
): Promise<void> {
  const context: OperationContext = {
    projectNumber,
    projectOwner: owner,
  };
  ensurePermission("project", "field:delete", context);

  const args = [
    "project",
    "field-delete",
    String(projectNumber),
    "--id",
    fieldId,
  ];
  if (owner) args.push("--owner", owner);

  await execGh(args);
}

export { isGhCliError };
