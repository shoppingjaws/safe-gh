import type {
  Config,
  IssueCondition,
  IssueContext,
  IssueRuleWithEnforce,
  PermissionCheckResult,
} from "./types.ts";

// ============================================================
// Global allowedOwners check
// ============================================================

export function checkAllowedOwners(
  config: Config,
  repo: string
): PermissionCheckResult | null {
  if (!config.allowedOwners) return null;
  if (config.allowedOwners.length === 0) {
    return { allowed: false, reason: "Blocked by global allowedOwners: no owners are allowed (empty list)" };
  }

  const owner = repo.split("/")[0];
  if (!owner) {
    return {
      allowed: false,
      reason: "Could not determine owner from repo",
    };
  }

  if (!config.allowedOwners.includes(owner)) {
    return {
      allowed: false,
      reason: `Blocked by global allowedOwners: owner '${owner}' is not in [${config.allowedOwners.join(", ")}]`,
    };
  }

  return null;
}

// ============================================================
// Condition matcher
// ============================================================

export function checkIssueCondition(
  condition: IssueCondition,
  context: IssueContext,
  selfUserId: string | undefined
): boolean {
  // createdBy
  if (condition.createdBy === "self") {
    if (!selfUserId || context.issueAuthor !== selfUserId) return false;
  }

  // assignee
  if (condition.assignee === "self") {
    if (!selfUserId) return false;
    if (!context.assignees.includes(selfUserId)) return false;
  }

  // labels
  if (condition.labels) {
    if (condition.labels.include) {
      if (!condition.labels.include.some((l) => context.labels.includes(l))) {
        return false;
      }
    }
    if (condition.labels.exclude && condition.labels.exclude.length > 0) {
      if (condition.labels.exclude.some((l) => context.labels.includes(l))) {
        return false;
      }
    }
  }

  // repos
  if (condition.repos) {
    if (!condition.repos.includes(context.repo)) return false;
  }

  // owners
  if (condition.owners) {
    const owner = context.repo.split("/")[0];
    if (!owner || !condition.owners.includes(owner)) return false;
  }

  // titlePrefix
  if (condition.titlePrefix !== undefined) {
    if (!context.issueTitle.startsWith(condition.titlePrefix)) return false;
  }

  // parentIssue
  if (condition.parentIssue !== undefined) {
    if (context.parentIssueNumber === null) return false;
    if (condition.parentIssue.number !== undefined) {
      if (context.parentIssueNumber !== condition.parentIssue.number) return false;
    }
    if (condition.parentIssue.assignee === "self") {
      if (!selfUserId) return false;
      if (!context.parentIssueAssignees.includes(selfUserId)) return false;
    }
    if (condition.parentIssue.labels) {
      if (condition.parentIssue.labels.include && condition.parentIssue.labels.include.length > 0) {
        if (!condition.parentIssue.labels.include.some((l) => context.parentIssueLabels.includes(l))) {
          return false;
        }
      }
      if (condition.parentIssue.labels.exclude && condition.parentIssue.labels.exclude.length > 0) {
        if (condition.parentIssue.labels.exclude.some((l) => context.parentIssueLabels.includes(l))) {
          return false;
        }
      }
    }
    if (condition.parentIssue.titlePrefix !== undefined) {
      if (!context.parentIssueTitle || !context.parentIssueTitle.startsWith(condition.parentIssue.titlePrefix)) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================
// Rule evaluation
// ============================================================

export function evaluateRules(
  rules: IssueRuleWithEnforce[],
  context: IssueContext,
  selfUserId: string | undefined
): PermissionCheckResult {
  for (const rule of rules) {
    if (rule.condition) {
      if (!checkIssueCondition(rule.condition, context, selfUserId)) continue;
    }

    return {
      allowed: true,
      ruleName: rule.name,
      reason: `Allowed by rule '${rule.name}'`,
      enforce: rule.enforce,
    };
  }

  return {
    allowed: false,
    reason: "No matching rule and default permission is deny",
  };
}
