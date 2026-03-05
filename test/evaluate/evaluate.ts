import { checkAllowedOwners, evaluateRules } from "../../src/conditions.ts";
import { buildEnforceArgs, appendMarker } from "../../src/commands/utils.ts";
import type {
  Config,
  IssueContext,
  IssueRuleWithEnforce,
  PermissionCheckResult,
} from "../../src/types.ts";

// ============================================================
// Input types (discriminated union)
// ============================================================

export type CommandInput =
  | {
      command: "issue edit";
      context: IssueContext;
      options: {
        title?: string;
        body?: string;
        addLabel?: string;
        removeLabel?: string;
        addAssignee?: string;
        removeAssignee?: string;
      };
    }
  | { command: "issue comment"; context: IssueContext; options: { body: string } }
  | {
      command: "issue create";
      repo: string;
      options: { title: string; body: string; label?: string; assignee?: string };
    }
  | { command: "issue sub-issue add"; context: IssueContext; child: { repo: string; number: number } }
  | { command: "issue sub-issue remove"; context: IssueContext; child: { repo: string; number: number } }
  | { command: "issue dependency add"; context: IssueContext; blockedBy: { repo: string; number: number } }
  | { command: "issue dependency remove"; context: IssueContext; blockedBy: { repo: string; number: number } };

// ============================================================
// Execution types
// ============================================================

export interface GhCliExecution {
  type: "gh-cli";
  args: string[];
}

export interface GraphQLExecution {
  type: "graphql";
  mutation: string;
  variables: Record<string, string>;
  headers?: Record<string, string>;
}

export type Execution = GhCliExecution | GraphQLExecution;

// ============================================================
// Result type
// ============================================================

export interface EvaluateResult {
  permission: PermissionCheckResult;
  context: IssueContext;
  execution: Execution | null;
  enforceExecution: GhCliExecution | null;
}

// ============================================================
// Helpers
// ============================================================

function checkPermission(
  config: Config,
  rules: IssueRuleWithEnforce[],
  context: IssueContext
): PermissionCheckResult {
  const ownerBlock = checkAllowedOwners(config, context.repo);
  if (ownerBlock) return ownerBlock;
  return evaluateRules(rules, context, config.selfUserId);
}

function buildCreateContext(
  config: Config,
  input: Extract<CommandInput, { command: "issue create" }>
): IssueContext {
  const requestedLabels = input.options.label
    ? input.options.label.split(",").map((l) => l.trim())
    : [];
  const requestedAssignees = input.options.assignee
    ? input.options.assignee.split(",").map((a) => a.trim())
    : [];
  return {
    repo: input.repo,
    issueNumber: 0,
    issueTitle: input.options.title,
    issueAuthor: config.selfUserId ?? "",
    labels: requestedLabels,
    assignees: requestedAssignees,
    parentIssueNumber: null,
    parentIssueAssignees: [],
    parentIssueLabels: [],
    parentIssueTitle: null,
  };
}

function buildIssueEditArgs(
  context: IssueContext,
  options: Extract<CommandInput, { command: "issue edit" }>["options"],
  permission: PermissionCheckResult,
  selfUserId: string | undefined
): string[] {
  const args = ["issue", "edit", String(context.issueNumber), "-R", context.repo];

  if (permission.enforce?.titlePrefix) {
    const currentTitle = options.title ?? context.issueTitle;
    if (!currentTitle.startsWith(permission.enforce.titlePrefix)) {
      args.push("--title", `${permission.enforce.titlePrefix}${currentTitle}`);
    } else if (options.title) {
      args.push("--title", options.title);
    }
  } else if (options.title) {
    args.push("--title", options.title);
  }
  if (options.body) args.push("--body", appendMarker(options.body));
  if (options.addLabel) args.push("--add-label", options.addLabel);
  if (options.removeLabel) args.push("--remove-label", options.removeLabel);
  if (options.addAssignee) args.push("--add-assignee", options.addAssignee);
  if (options.removeAssignee) args.push("--remove-assignee", options.removeAssignee);

  if (permission.enforce) {
    args.push(...buildEnforceArgs(permission.enforce, selfUserId));
  }

  return args;
}

function nodeIdPlaceholder(repo: string, number: number): string {
  return `<node-id:${repo}#${number}>`;
}

/**
 * Returns a denied permission result if the target repo's owner is not allowed, null otherwise.
 */
function checkCrossRepoOwner(
  config: Config,
  parentRepo: string,
  targetRepo: string
): PermissionCheckResult | null {
  if (targetRepo === parentRepo) return null;
  const block = checkAllowedOwners(config, targetRepo);
  if (block) return { allowed: false, reason: block.reason };
  return null;
}

// ============================================================
// Main function
// ============================================================

export function evaluateCommand(config: Config, input: CommandInput): EvaluateResult {
  switch (input.command) {
    case "issue edit": {
      const permission = checkPermission(config, config.issueEdit, input.context);
      if (!permission.allowed) {
        return { permission, context: input.context, execution: null, enforceExecution: null };
      }
      const args = buildIssueEditArgs(input.context, input.options, permission, config.selfUserId);
      return {
        permission,
        context: input.context,
        execution: { type: "gh-cli", args },
        enforceExecution: null,
      };
    }

    case "issue comment": {
      const permission = checkPermission(config, config.issueComment, input.context);
      if (!permission.allowed) {
        return { permission, context: input.context, execution: null, enforceExecution: null };
      }
      return {
        permission,
        context: input.context,
        execution: {
          type: "gh-cli",
          args: [
            "issue", "comment", String(input.context.issueNumber),
            "--body", appendMarker(input.options.body),
            "-R", input.context.repo,
          ],
        },
        enforceExecution: null,
      };
    }

    case "issue create": {
      const context = buildCreateContext(config, input);
      const permission = checkPermission(config, config.issueCreate, context);
      if (!permission.allowed) {
        return { permission, context, execution: null, enforceExecution: null };
      }

      let title = input.options.title;
      if (permission.enforce?.titlePrefix && !title.startsWith(permission.enforce.titlePrefix)) {
        title = `${permission.enforce.titlePrefix}${title}`;
      }

      const args = [
        "issue", "create",
        "--title", title,
        "--body", appendMarker(input.options.body),
        "-R", input.repo,
      ];
      if (input.options.label) args.push("--label", input.options.label);
      if (input.options.assignee) args.push("--assignee", input.options.assignee);

      let enforceExecution: GhCliExecution | null = null;
      if (permission.enforce) {
        const enforceArgs = buildEnforceArgs(permission.enforce, config.selfUserId);
        if (enforceArgs.length > 0) {
          enforceExecution = {
            type: "gh-cli",
            args: ["issue", "edit", "<created-issue-number>", "-R", input.repo, ...enforceArgs],
          };
        }
      }

      return { permission, context, execution: { type: "gh-cli", args }, enforceExecution };
    }

    case "issue sub-issue add": {
      const permission = checkPermission(config, config.issueSubIssue, input.context);
      if (!permission.allowed) {
        return { permission, context: input.context, execution: null, enforceExecution: null };
      }
      const crossBlock = checkCrossRepoOwner(config, input.context.repo, input.child.repo);
      if (crossBlock) {
        return { permission: crossBlock, context: input.context, execution: null, enforceExecution: null };
      }
      return {
        permission,
        context: input.context,
        execution: {
          type: "graphql",
          mutation: "addSubIssue",
          variables: {
            issueId: nodeIdPlaceholder(input.context.repo, input.context.issueNumber),
            subIssueId: nodeIdPlaceholder(input.child.repo, input.child.number),
          },
          headers: { "GraphQL-Features": "sub_issues" },
        },
        enforceExecution: null,
      };
    }

    case "issue sub-issue remove": {
      const permission = checkPermission(config, config.issueSubIssue, input.context);
      if (!permission.allowed) {
        return { permission, context: input.context, execution: null, enforceExecution: null };
      }
      const crossBlock = checkCrossRepoOwner(config, input.context.repo, input.child.repo);
      if (crossBlock) {
        return { permission: crossBlock, context: input.context, execution: null, enforceExecution: null };
      }
      return {
        permission,
        context: input.context,
        execution: {
          type: "graphql",
          mutation: "removeSubIssue",
          variables: {
            issueId: nodeIdPlaceholder(input.context.repo, input.context.issueNumber),
            subIssueId: nodeIdPlaceholder(input.child.repo, input.child.number),
          },
          headers: { "GraphQL-Features": "sub_issues" },
        },
        enforceExecution: null,
      };
    }

    case "issue dependency add": {
      const permission = checkPermission(config, config.issueDependency, input.context);
      if (!permission.allowed) {
        return { permission, context: input.context, execution: null, enforceExecution: null };
      }
      const crossBlock = checkCrossRepoOwner(config, input.context.repo, input.blockedBy.repo);
      if (crossBlock) {
        return { permission: crossBlock, context: input.context, execution: null, enforceExecution: null };
      }
      return {
        permission,
        context: input.context,
        execution: {
          type: "graphql",
          mutation: "addBlockedBy",
          variables: {
            issueId: nodeIdPlaceholder(input.context.repo, input.context.issueNumber),
            blockingIssueId: nodeIdPlaceholder(input.blockedBy.repo, input.blockedBy.number),
          },
          headers: { "GraphQL-Features": "sub_issues" },
        },
        enforceExecution: null,
      };
    }

    case "issue dependency remove": {
      const permission = checkPermission(config, config.issueDependency, input.context);
      if (!permission.allowed) {
        return { permission, context: input.context, execution: null, enforceExecution: null };
      }
      const crossBlock = checkCrossRepoOwner(config, input.context.repo, input.blockedBy.repo);
      if (crossBlock) {
        return { permission: crossBlock, context: input.context, execution: null, enforceExecution: null };
      }
      return {
        permission,
        context: input.context,
        execution: {
          type: "graphql",
          mutation: "removeBlockedBy",
          variables: {
            issueId: nodeIdPlaceholder(input.context.repo, input.context.issueNumber),
            blockingIssueId: nodeIdPlaceholder(input.blockedBy.repo, input.blockedBy.number),
          },
          headers: { "GraphQL-Features": "sub_issues" },
        },
        enforceExecution: null,
      };
    }
  }
}
