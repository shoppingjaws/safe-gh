import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { resolveRepo, fetchIssueContext, execGh, isDryRun, DryRunResult } from "../gh.ts";
import { checkAllowedOwners, evaluateRules } from "../conditions.ts";
import type { Config, IssueContext, ErrorResponse, PermissionCheckResult } from "../types.ts";
import { outputJson, handleError } from "./utils.ts";

function checkPermission(config: Config, context: IssueContext): PermissionCheckResult {
  const ownerBlock = checkAllowedOwners(config, context.repo);
  if (ownerBlock) return ownerBlock;

  return evaluateRules(config.issueComment, context, config.selfUserId);
}

export function createIssueCommentCommand(): Command {
  const comment = new Command("comment")
    .description("Add a comment to an issue")
    .argument("<number>", "Issue number")
    .requiredOption("-b, --body <body>", "Comment body")
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
          throw new DryRunResult("issue comment", context, result);
        }

        if (!result.allowed) {
          throw {
            error: result.reason,
            code: "PERMISSION_DENIED",
            details: { context },
          } satisfies ErrorResponse;
        }

        await execGh(["issue", "comment", String(issueNumber), "--body", options.body, "-R", repo]);
        outputJson({ success: true, issueNumber, message: "Comment added successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  return comment;
}
