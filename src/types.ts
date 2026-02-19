import { z } from "zod";

// ============================================================
// Condition schemas
// ============================================================

export const LabelConditionSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});
export type LabelCondition = z.infer<typeof LabelConditionSchema>;

export const IssueConditionSchema = z.object({
  createdBy: z.literal("self").optional(),
  assignee: z.literal("self").optional(),
  labels: LabelConditionSchema.optional(),
  repos: z.array(z.string()).optional(),
  owners: z.array(z.string()).optional(),
  parentIssue: z.number().optional(),
});
export type IssueCondition = z.infer<typeof IssueConditionSchema>;

// ============================================================
// Enforce schema
// ============================================================

export const EnforceSchema = z.object({
  addLabels: z.array(z.string()).optional(),
  removeLabels: z.array(z.string()).optional(),
  addAssignees: z.array(z.string()).optional(),
  removeAssignees: z.array(z.string()).optional(),
});
export type Enforce = z.infer<typeof EnforceSchema>;

// ============================================================
// Rule schemas
// ============================================================

export const IssueRuleSchema = z.object({
  name: z.string(),
  condition: IssueConditionSchema.optional(),
  enforce: EnforceSchema.optional(),
});
export type IssueRule = z.infer<typeof IssueRuleSchema>;

// ============================================================
// Config schema
// ============================================================

export const ConfigSchema = z.object({
  allowedOwners: z.array(z.string()).optional(),
  issueEdit: z.array(IssueRuleSchema).default([]),
  issueComment: z.array(IssueRuleSchema).default([]),
  issueCreate: z.array(IssueRuleSchema).default([]),
  issueSubIssue: z.array(IssueRuleSchema).default([]),
  issueDependency: z.array(IssueRuleSchema).default([]),
  selfUserId: z.string().optional(),
  defaultPermission: z.literal("deny").default("deny"),
});
export type Config = z.infer<typeof ConfigSchema>;

// ============================================================
// Issue context
// ============================================================

export interface IssueContext {
  repo: string;
  issueNumber: number;
  issueAuthor: string;
  labels: string[];
  assignees: string[];
  parentIssueNumber: number | null;
}

// ============================================================
// Permission check result
// ============================================================

export interface PermissionCheckResult {
  allowed: boolean;
  ruleName?: string;
  reason: string;
  enforce?: Enforce;
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
  | "UNSUPPORTED_COMMAND"
  | "ENFORCE_ERROR"
  | "GRAPHQL_ERROR"
  | "UNKNOWN_ERROR";

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
}
