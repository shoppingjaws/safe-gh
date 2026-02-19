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

const ADD_SUB_ISSUE_MUTATION = `
mutation($issueId: ID!, $subIssueId: ID!) {
  addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) {
    issue { id number }
    subIssue { id number }
  }
}`;

const REMOVE_SUB_ISSUE_MUTATION = `
mutation($issueId: ID!, $subIssueId: ID!) {
  removeSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) {
    issue { id number }
    subIssue { id number }
  }
}`;

function checkPermission(config: Config, context: IssueContext): PermissionCheckResult {
  const ownerBlock = checkAllowedOwners(config, context.repo);
  if (ownerBlock) return ownerBlock;

  return evaluateRules(config.issueSubIssue, context, config.selfUserId);
}

export function createIssueSubIssueCommand(): Command {
  const subIssue = new Command("sub-issue").description("Manage sub-issues");

  subIssue
    .command("add")
    .description("Add a sub-issue to a parent issue")
    .argument("<parent-number>", "Parent issue number")
    .argument("<child>", "Child issue: number or owner/repo#number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (parentNumber: string, child: string, options) => {
      try {
        const parentIssueNumber = parseInt(parentNumber, 10);
        if (isNaN(parentIssueNumber)) {
          throw {
            error: "Invalid parent issue number",
            code: "VALIDATION_ERROR",
          } satisfies ErrorResponse;
        }

        const repo = await resolveRepo(options.repo);
        const childRef = parseIssueRef(child, repo);

        const context = await fetchIssueContext(parentIssueNumber, repo);
        const config = loadConfig();
        const result = checkPermission(config, context);

        if (isDryRun()) {
          throw new DryRunResult("issue sub-issue add", context, result);
        }

        if (!result.allowed) {
          throw {
            error: result.reason,
            code: "PERMISSION_DENIED",
            details: { context },
          } satisfies ErrorResponse;
        }

        // Check allowedOwners for cross-repo child
        if (childRef.repo !== repo) {
          const childOwnerBlock = checkAllowedOwners(config, childRef.repo);
          if (childOwnerBlock) {
            throw {
              error: childOwnerBlock.reason,
              code: "NOT_OWNER",
              details: { targetRepo: childRef.repo },
            } satisfies ErrorResponse;
          }
        }

        const parentNodeId = await fetchIssueNodeId(parentIssueNumber, repo);
        const childNodeId = await fetchIssueNodeId(childRef.number, childRef.repo);

        await execGraphQLMutation(
          ADD_SUB_ISSUE_MUTATION,
          { issueId: parentNodeId, subIssueId: childNodeId },
          SUB_ISSUE_HEADERS
        );

        outputJson({
          success: true,
          parentIssueNumber,
          childIssueNumber: childRef.number,
          childRepo: childRef.repo,
          message: "Sub-issue added successfully",
        });
      } catch (error) {
        handleError(error);
      }
    });

  subIssue
    .command("remove")
    .description("Remove a sub-issue from a parent issue")
    .argument("<parent-number>", "Parent issue number")
    .argument("<child>", "Child issue: number or owner/repo#number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (parentNumber: string, child: string, options) => {
      try {
        const parentIssueNumber = parseInt(parentNumber, 10);
        if (isNaN(parentIssueNumber)) {
          throw {
            error: "Invalid parent issue number",
            code: "VALIDATION_ERROR",
          } satisfies ErrorResponse;
        }

        const repo = await resolveRepo(options.repo);
        const childRef = parseIssueRef(child, repo);

        const context = await fetchIssueContext(parentIssueNumber, repo);
        const config = loadConfig();
        const result = checkPermission(config, context);

        if (isDryRun()) {
          throw new DryRunResult("issue sub-issue remove", context, result);
        }

        if (!result.allowed) {
          throw {
            error: result.reason,
            code: "PERMISSION_DENIED",
            details: { context },
          } satisfies ErrorResponse;
        }

        // Check allowedOwners for cross-repo child
        if (childRef.repo !== repo) {
          const childOwnerBlock = checkAllowedOwners(config, childRef.repo);
          if (childOwnerBlock) {
            throw {
              error: childOwnerBlock.reason,
              code: "NOT_OWNER",
              details: { targetRepo: childRef.repo },
            } satisfies ErrorResponse;
          }
        }

        const parentNodeId = await fetchIssueNodeId(parentIssueNumber, repo);
        const childNodeId = await fetchIssueNodeId(childRef.number, childRef.repo);

        await execGraphQLMutation(
          REMOVE_SUB_ISSUE_MUTATION,
          { issueId: parentNodeId, subIssueId: childNodeId },
          SUB_ISSUE_HEADERS
        );

        outputJson({
          success: true,
          parentIssueNumber,
          childIssueNumber: childRef.number,
          childRepo: childRef.repo,
          message: "Sub-issue removed successfully",
        });
      } catch (error) {
        handleError(error);
      }
    });

  return subIssue;
}
