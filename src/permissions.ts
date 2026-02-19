import type {
  Config,
  PermissionCheckResult,
  OperationContext,
  IssueOperation,
  PrOperation,
  SearchOperation,
  ProjectOperation,
  IssueCondition,
  PrCondition,
  SearchCondition,
  ProjectCondition,
  ResourceType,
} from "./types.ts";

// ============================================================
// Condition checkers
// ============================================================

function checkCommonCondition(
  condition: { createdBy?: "self"; assignee?: "self"; labels?: { include?: string[]; exclude?: string[] }; repos?: string[]; owners?: string[] },
  context: OperationContext,
  selfUserId: string | undefined
): boolean {
  // createdBy
  if (condition.createdBy === "self") {
    const author = context.issueAuthor ?? context.prAuthor;
    if (!selfUserId || !author) return false;
    if (author !== selfUserId) return false;
  }

  // assignee
  if (condition.assignee === "self") {
    if (!selfUserId) return false;
    const assignees = context.assignees ?? [];
    if (!assignees.includes(selfUserId)) return false;
  }

  // labels
  if (condition.labels) {
    const contextLabels = context.labels ?? [];
    if (condition.labels.include && condition.labels.include.length > 0) {
      if (!condition.labels.include.some((l) => contextLabels.includes(l))) {
        return false;
      }
    }
    if (condition.labels.exclude && condition.labels.exclude.length > 0) {
      if (condition.labels.exclude.some((l) => contextLabels.includes(l))) {
        return false;
      }
    }
  }

  // repos
  if (condition.repos && condition.repos.length > 0) {
    if (!context.repo) return false;
    if (!condition.repos.includes(context.repo)) return false;
  }

  // owners
  if (condition.owners && condition.owners.length > 0) {
    if (!context.repo) return false;
    const owner = context.repo.split("/")[0];
    if (!owner || !condition.owners.includes(owner)) return false;
  }

  return true;
}

function checkPrCondition(
  condition: PrCondition,
  context: OperationContext,
  selfUserId: string | undefined
): boolean {
  if (!checkCommonCondition(condition, context, selfUserId)) return false;

  // draft
  if (condition.draft !== undefined) {
    if (context.draft === undefined) return false;
    if (context.draft !== condition.draft) return false;
  }

  // baseBranch
  if (condition.baseBranch && condition.baseBranch.length > 0) {
    if (!context.baseBranch) return false;
    const matches = condition.baseBranch.some((pattern) =>
      matchBranchPattern(context.baseBranch!, pattern)
    );
    if (!matches) return false;
  }

  // headBranch
  if (condition.headBranch && condition.headBranch.length > 0) {
    if (!context.headBranch) return false;
    const matches = condition.headBranch.some((pattern) =>
      matchBranchPattern(context.headBranch!, pattern)
    );
    if (!matches) return false;
  }

  // reviewDecision
  if (condition.reviewDecision !== undefined) {
    if (context.reviewDecision !== condition.reviewDecision) return false;
  }

  return true;
}

function checkSearchCondition(
  condition: SearchCondition,
  context: OperationContext
): boolean {
  if (condition.repos && condition.repos.length > 0) {
    if (!context.repo) return false;
    if (!condition.repos.includes(context.repo)) return false;
  }
  if (condition.owners && condition.owners.length > 0) {
    if (!context.repo) return false;
    const owner = context.repo.split("/")[0];
    if (!owner || !condition.owners.includes(owner)) return false;
  }
  return true;
}

function checkProjectCondition(
  condition: ProjectCondition,
  context: OperationContext
): boolean {
  if (condition.owner && condition.owner.length > 0) {
    if (!context.projectOwner) return false;
    if (!condition.owner.includes(context.projectOwner)) return false;
  }
  if (condition.projectNumbers && condition.projectNumbers.length > 0) {
    if (context.projectNumber === undefined) return false;
    if (!condition.projectNumbers.includes(context.projectNumber)) return false;
  }
  return true;
}

function matchBranchPattern(branch: string, pattern: string): boolean {
  if (!pattern.includes("*")) return branch === pattern;
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*") + "$"
  );
  return regex.test(branch);
}

// ============================================================
// Global allowedOwners check
// ============================================================

function checkAllowedOwners(
  config: Config,
  resource: ResourceType,
  context: OperationContext
): PermissionCheckResult | null {
  if (!config.allowedOwners || config.allowedOwners.length === 0) return null;

  let owner: string | undefined;

  if (resource === "project") {
    if (!context.projectOwner) return null;
    owner = context.projectOwner;
  } else if (resource === "search") {
    // search without -R is cross-repo; skip owner check
    if (!context.repo) return null;
    owner = context.repo.split("/")[0];
  } else {
    // issue / pr: require -R when allowedOwners is configured
    if (!context.repo) {
      return {
        allowed: false,
        reason:
          "Repository must be specified with -R owner/repo when allowedOwners is configured",
      };
    }
    owner = context.repo.split("/")[0];
  }

  if (!owner) return null;

  if (!config.allowedOwners.includes(owner)) {
    return {
      allowed: false,
      reason: `Blocked by global allowedOwners: owner '${owner}' is not in [${config.allowedOwners.join(", ")}]`,
    };
  }

  return null;
}

// ============================================================
// Main permission check
// ============================================================

export function checkPermission(
  config: Config,
  resource: "issue",
  operation: IssueOperation,
  context: OperationContext
): PermissionCheckResult;
export function checkPermission(
  config: Config,
  resource: "pr",
  operation: PrOperation,
  context: OperationContext
): PermissionCheckResult;
export function checkPermission(
  config: Config,
  resource: "search",
  operation: SearchOperation,
  context: OperationContext
): PermissionCheckResult;
export function checkPermission(
  config: Config,
  resource: "project",
  operation: ProjectOperation,
  context: OperationContext
): PermissionCheckResult;
export function checkPermission(
  config: Config,
  resource: ResourceType,
  operation: string,
  context: OperationContext
): PermissionCheckResult {
  // Global allowedOwners check (before rule evaluation)
  const ownerBlock = checkAllowedOwners(config, resource, context);
  if (ownerBlock) return ownerBlock;

  const rules = getRulesForResource(config, resource);

  for (const rule of rules) {
    const ops = rule.operations as readonly string[];
    if (!ops.includes(operation)) continue;

    if (rule.condition) {
      const met = checkConditionForResource(
        resource,
        rule.condition,
        context,
        config.selfUserId
      );
      if (!met) continue;
    }

    return {
      allowed: true,
      ruleName: rule.name,
      reason: `Allowed by rule '${rule.name}'`,
    };
  }

  // Default permission fallback
  const readOperations = [
    "list", "view", "list:comments",
    "diff", "checks",
    "field:list", "item:list",
  ];
  if (
    config.defaultPermission === "read" &&
    readOperations.includes(operation)
  ) {
    return {
      allowed: true,
      reason: "Allowed by default read permission",
    };
  }

  return {
    allowed: false,
    reason: "No matching rule and default permission is deny",
  };
}

function getRulesForResource(
  config: Config,
  resource: ResourceType
): Array<{ name: string; operations: readonly string[]; condition?: unknown }> {
  switch (resource) {
    case "issue":
      return config.issueRules;
    case "pr":
      return config.prRules;
    case "search":
      return config.searchRules;
    case "project":
      return config.projectRules;
  }
}

function checkConditionForResource(
  resource: ResourceType,
  condition: unknown,
  context: OperationContext,
  selfUserId: string | undefined
): boolean {
  switch (resource) {
    case "issue":
      return checkCommonCondition(
        condition as IssueCondition,
        context,
        selfUserId
      );
    case "pr":
      return checkPrCondition(
        condition as PrCondition,
        context,
        selfUserId
      );
    case "search":
      return checkSearchCondition(condition as SearchCondition, context);
    case "project":
      return checkProjectCondition(condition as ProjectCondition, context);
  }
}

// ============================================================
// Helpers
// ============================================================

export function operationNeedsContext(
  resource: ResourceType,
  operation: string
): boolean {
  if (resource === "issue") {
    return [
      "update",
      "close",
      "reopen",
      "delete",
      "comment",
      "comment:edit",
      "comment:delete",
    ].includes(operation);
  }
  if (resource === "pr") {
    return [
      "update",
      "close",
      "reopen",
      "merge",
      "review",
      "update-branch",
      "comment",
      "comment:edit",
      "comment:delete",
    ].includes(operation);
  }
  return false;
}
