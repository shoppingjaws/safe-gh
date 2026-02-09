import { z } from "zod";

// ============================================================
// Operation values per resource
// ============================================================

export const IssueOperationValues = [
  "list",
  "view",
  "list:comments",
  "create",
  "update",
  "close",
  "reopen",
  "delete",
  "comment",
  "comment:edit",
  "comment:delete",
] as const;

export const PrOperationValues = [
  "list",
  "view",
  "diff",
  "checks",
  "list:comments",
  "create",
  "update",
  "close",
  "reopen",
  "merge",
  "review",
  "update-branch",
  "comment",
  "comment:edit",
  "comment:delete",
] as const;

export const SearchOperationValues = [
  "code",
  "issues",
  "prs",
  "repos",
  "commits",
] as const;

export const ProjectOperationValues = [
  "list",
  "view",
  "field:list",
  "item:list",
  "create",
  "edit",
  "close",
  "delete",
  "item:add",
  "item:create",
  "item:edit",
  "item:delete",
  "item:archive",
  "field:create",
  "field:delete",
] as const;

export type IssueOperation = (typeof IssueOperationValues)[number];
export type PrOperation = (typeof PrOperationValues)[number];
export type SearchOperation = (typeof SearchOperationValues)[number];
export type ProjectOperation = (typeof ProjectOperationValues)[number];

// ============================================================
// Condition schemas per resource
// ============================================================

export const LabelConditionSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});
export type LabelCondition = z.infer<typeof LabelConditionSchema>;

const CommonConditionSchema = z.object({
  createdBy: z.literal("self").optional(),
  assignee: z.literal("self").optional(),
  labels: LabelConditionSchema.optional(),
  repos: z.array(z.string()).optional(),
  owners: z.array(z.string()).optional(),
});

export const IssueConditionSchema = CommonConditionSchema;
export type IssueCondition = z.infer<typeof IssueConditionSchema>;

export const PrConditionSchema = CommonConditionSchema.extend({
  draft: z.boolean().optional(),
  baseBranch: z.array(z.string()).optional(),
  headBranch: z.array(z.string()).optional(),
  reviewDecision: z
    .enum(["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"])
    .optional(),
});
export type PrCondition = z.infer<typeof PrConditionSchema>;

export const SearchConditionSchema = z.object({
  repos: z.array(z.string()).optional(),
  owners: z.array(z.string()).optional(),
});
export type SearchCondition = z.infer<typeof SearchConditionSchema>;

export const ProjectConditionSchema = z.object({
  owner: z.array(z.string()).optional(),
  projectNumbers: z.array(z.number()).optional(),
});
export type ProjectCondition = z.infer<typeof ProjectConditionSchema>;

// ============================================================
// Rule schemas per resource
// ============================================================

export const IssueRuleSchema = z.object({
  name: z.string(),
  operations: z.array(z.enum(IssueOperationValues)),
  condition: IssueConditionSchema.optional(),
});
export type IssueRule = z.infer<typeof IssueRuleSchema>;

export const PrRuleSchema = z.object({
  name: z.string(),
  operations: z.array(z.enum(PrOperationValues)),
  condition: PrConditionSchema.optional(),
});
export type PrRule = z.infer<typeof PrRuleSchema>;

export const SearchRuleSchema = z.object({
  name: z.string(),
  operations: z.array(z.enum(SearchOperationValues)),
  condition: SearchConditionSchema.optional(),
});
export type SearchRule = z.infer<typeof SearchRuleSchema>;

export const ProjectRuleSchema = z.object({
  name: z.string(),
  operations: z.array(z.enum(ProjectOperationValues)),
  condition: ProjectConditionSchema.optional(),
});
export type ProjectRule = z.infer<typeof ProjectRuleSchema>;

// ============================================================
// Config schema
// ============================================================

export const ConfigSchema = z.object({
  issueRules: z.array(IssueRuleSchema).default([]),
  prRules: z.array(PrRuleSchema).default([]),
  searchRules: z.array(SearchRuleSchema).default([]),
  projectRules: z.array(ProjectRuleSchema).default([]),
  selfUserId: z.string().optional(),
  defaultPermission: z.enum(["deny", "read"]).default("deny"),
});
export type Config = z.infer<typeof ConfigSchema>;

// ============================================================
// Permission check result
// ============================================================

export interface PermissionCheckResult {
  allowed: boolean;
  ruleName?: string;
  reason: string;
}

// ============================================================
// Error types
// ============================================================

export type ErrorCode =
  | "PERMISSION_DENIED"
  | "NOT_OWNER"
  | "CONFIG_ERROR"
  | "GH_CLI_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
}

// ============================================================
// Resource type
// ============================================================

export type ResourceType = "issue" | "pr" | "search" | "project";

// ============================================================
// Operation context (internal)
// ============================================================

export interface OperationContext {
  repo?: string;
  // Issue
  issueNumber?: number;
  issueAuthor?: string;
  // PR
  prNumber?: number;
  prAuthor?: string;
  // Common (Issue/PR)
  labels?: string[];
  assignees?: string[];
  // PR-specific
  draft?: boolean;
  baseBranch?: string;
  headBranch?: string;
  reviewDecision?: string;
  // Project
  projectNumber?: number;
  projectOwner?: string;
}

// ============================================================
// GitHub data types
// ============================================================

export interface Issue {
  number: number;
  title: string;
  state: string;
  author: {
    login: string;
  };
  labels: Array<{
    name: string;
  }>;
  assignees: Array<{
    login: string;
  }>;
  body?: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  author: {
    login: string;
  };
  labels: Array<{
    name: string;
  }>;
  assignees: Array<{
    login: string;
  }>;
  isDraft: boolean;
  baseRefName: string;
  headRefName: string;
  reviewDecision?: string;
  body?: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: number;
  body: string;
  author: {
    login: string;
  };
  createdAt: string;
  updatedAt: string;
}
