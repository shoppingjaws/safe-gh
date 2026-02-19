import { Command } from "commander";
import { loadConfig } from "../config.ts";
import {
  resolveRepo,
  fetchIssueContext,
  fetchIssueNodeId,
  execGraphQLMutation,
  isDryRun,
  DryRunResult,
} from "../gh.ts";
import { checkAllowedOwners, evaluateRules } from "../conditions.ts";
import type { Config, IssueContext, ErrorResponse, PermissionCheckResult } from "../types.ts";
import { outputJson, handleError } from "./utils.ts";
import { parseIssueRef } from "./issue-ref.ts";

const SUB_ISSUE_HEADERS = { "GraphQL-Features": "sub_issues" };

const ADD_DEPENDENCY_MUTATION = `
mutation($issueId: ID!, $blockingIssueId: ID!) {
  addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
    issue { id number }
    blockingIssue { id number }
  }
}`;

const REMOVE_DEPENDENCY_MUTATION = `
mutation($issueId: ID!, $blockingIssueId: ID!) {
  removeBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
    issue { id number }
    blockingIssue { id number }
  }
}`;

function checkPermission(config: Config, context: IssueContext): PermissionCheckResult {
  const ownerBlock = checkAllowedOwners(config, context.repo);
  if (ownerBlock) return ownerBlock;

  return evaluateRules(config.issueDependency, context, config.selfUserId);
}

export function createIssueDependencyCommand(): Command {
  const dependency = new Command("dependency").description("Manage issue dependencies");

  dependency
    .command("add")
    .description("Add a dependency (blocked-by relationship)")
    .argument("<number>", "Issue number that is blocked")
    .argument("<blocked-by>", "Blocking issue: number or owner/repo#number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, blockedBy: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        if (isNaN(issueNumber)) {
          throw {
            error: "Invalid issue number",
            code: "VALIDATION_ERROR",
          } satisfies ErrorResponse;
        }

        const repo = await resolveRepo(options.repo);
        const blockedByRef = parseIssueRef(blockedBy, repo);

        const context = await fetchIssueContext(issueNumber, repo);
        const config = loadConfig();
        const result = checkPermission(config, context);

        if (isDryRun()) {
          throw new DryRunResult("issue dependency add", context, result);
        }

        if (!result.allowed) {
          throw {
            error: result.reason,
            code: "PERMISSION_DENIED",
            details: { context },
          } satisfies ErrorResponse;
        }

        // Check allowedOwners for cross-repo dependency
        if (blockedByRef.repo !== repo) {
          const targetOwnerBlock = checkAllowedOwners(config, blockedByRef.repo);
          if (targetOwnerBlock) {
            throw {
              error: targetOwnerBlock.reason,
              code: "NOT_OWNER",
              details: { targetRepo: blockedByRef.repo },
            } satisfies ErrorResponse;
          }
        }

        const dependentNodeId = await fetchIssueNodeId(issueNumber, repo);
        const dependsOnNodeId = await fetchIssueNodeId(blockedByRef.number, blockedByRef.repo);

        await execGraphQLMutation(
          ADD_DEPENDENCY_MUTATION,
          { issueId: dependentNodeId, blockingIssueId: dependsOnNodeId },
          SUB_ISSUE_HEADERS
        );

        outputJson({
          success: true,
          issueNumber,
          blockedByIssueNumber: blockedByRef.number,
          blockedByRepo: blockedByRef.repo,
          message: "Dependency added successfully",
        });
      } catch (error) {
        handleError(error);
      }
    });

  dependency
    .command("remove")
    .description("Remove a dependency (blocked-by relationship)")
    .argument("<number>", "Issue number that is blocked")
    .argument("<blocked-by>", "Blocking issue: number or owner/repo#number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, blockedBy: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        if (isNaN(issueNumber)) {
          throw {
            error: "Invalid issue number",
            code: "VALIDATION_ERROR",
          } satisfies ErrorResponse;
        }

        const repo = await resolveRepo(options.repo);
        const blockedByRef = parseIssueRef(blockedBy, repo);

        const context = await fetchIssueContext(issueNumber, repo);
        const config = loadConfig();
        const result = checkPermission(config, context);

        if (isDryRun()) {
          throw new DryRunResult("issue dependency remove", context, result);
        }

        if (!result.allowed) {
          throw {
            error: result.reason,
            code: "PERMISSION_DENIED",
            details: { context },
          } satisfies ErrorResponse;
        }

        // Check allowedOwners for cross-repo dependency
        if (blockedByRef.repo !== repo) {
          const targetOwnerBlock = checkAllowedOwners(config, blockedByRef.repo);
          if (targetOwnerBlock) {
            throw {
              error: targetOwnerBlock.reason,
              code: "NOT_OWNER",
              details: { targetRepo: blockedByRef.repo },
            } satisfies ErrorResponse;
          }
        }

        const dependentNodeId = await fetchIssueNodeId(issueNumber, repo);
        const dependsOnNodeId = await fetchIssueNodeId(blockedByRef.number, blockedByRef.repo);

        await execGraphQLMutation(
          REMOVE_DEPENDENCY_MUTATION,
          { issueId: dependentNodeId, blockingIssueId: dependsOnNodeId },
          SUB_ISSUE_HEADERS
        );

        outputJson({
          success: true,
          issueNumber,
          blockedByIssueNumber: blockedByRef.number,
          blockedByRepo: blockedByRef.repo,
          message: "Dependency removed successfully",
        });
      } catch (error) {
        handleError(error);
      }
    });

  return dependency;
}
