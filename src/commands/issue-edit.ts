import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { resolveRepo, fetchIssueContext, execGh, isDryRun, DryRunResult } from "../gh.ts";
import { checkAllowedOwners, evaluateRules } from "../conditions.ts";
import type { Config, IssueContext, ErrorResponse, PermissionCheckResult } from "../types.ts";
import { outputJson, handleError } from "./utils.ts";

function checkPermission(config: Config, context: IssueContext): PermissionCheckResult {
  const ownerBlock = checkAllowedOwners(config, context.repo);
  if (ownerBlock) return ownerBlock;

  return evaluateRules(config.issueEdit, context, config.selfUserId);
}

export function createIssueEditCommand(): Command {
  const edit = new Command("edit")
    .description("Edit an issue")
    .argument("<number>", "Issue number")
    .option("--title <title>", "New title")
    .option("-b, --body <body>", "New body")
    .option("--add-label <labels>", "Comma-separated labels to add")
    .option("--remove-label <labels>", "Comma-separated labels to remove")
    .option("--add-assignee <assignees>", "Comma-separated assignees to add")
    .option("--remove-assignee <assignees>", "Comma-separated assignees to remove")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        if (isNaN(issueNumber)) {
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" } satisfies ErrorResponse;
        }

        const repo = await resolveRepo(options.repo);
        const context = await fetchIssueContext(issueNumber, repo);
        const config = loadConfig();
        const result = checkPermission(config, context);

        if (isDryRun()) {
          throw new DryRunResult("issue edit", context, result);
        }

        if (!result.allowed) {
          throw {
            error: result.reason,
            code: "PERMISSION_DENIED",
            details: { context },
          } satisfies ErrorResponse;
        }

        const args = ["issue", "edit", String(issueNumber), "-R", repo];
        if (options.title) args.push("--title", options.title);
        if (options.body) args.push("--body", options.body);
        if (options.addLabel) args.push("--add-label", options.addLabel);
        if (options.removeLabel) args.push("--remove-label", options.removeLabel);
        if (options.addAssignee) args.push("--add-assignee", options.addAssignee);
        if (options.removeAssignee) args.push("--remove-assignee", options.removeAssignee);

        await execGh(args);
        outputJson({ success: true, issueNumber, message: "Issue edited successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  return edit;
}
