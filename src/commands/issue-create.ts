import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { resolveRepo, execGh, isDryRun, DryRunResult } from "../gh.ts";
import { checkAllowedOwners, evaluateRules } from "../conditions.ts";
import type { Config, IssueContext, ErrorResponse, PermissionCheckResult } from "../types.ts";
import { outputJson, handleError, appendMarker, buildEnforceArgs } from "./utils.ts";

function checkPermission(config: Config, context: IssueContext): PermissionCheckResult {
  const ownerBlock = checkAllowedOwners(config, context.repo);
  if (ownerBlock) return ownerBlock;

  return evaluateRules(config.issueCreate, context, config.selfUserId);
}

export function createIssueCreateCommand(): Command {
  const create = new Command("create")
    .description("Create an issue")
    .requiredOption("--title <title>", "Issue title")
    .requiredOption("-b, --body <body>", "Issue body")
    .option("--label <labels>", "Comma-separated labels")
    .option("--assignee <assignees>", "Comma-separated assignees")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (options) => {
      try {
        const repo = await resolveRepo(options.repo);

        const context: IssueContext = {
          repo,
          issueNumber: 0,
          issueAuthor: "",
          labels: [],
          assignees: [],
          parentIssueNumber: null,
        };

        const config = loadConfig();
        const result = checkPermission(config, context);

        if (isDryRun()) {
          throw new DryRunResult("issue create", context, result);
        }

        if (!result.allowed) {
          throw {
            error: result.reason,
            code: "PERMISSION_DENIED",
            details: { context },
          } satisfies ErrorResponse;
        }

        const args = ["issue", "create", "--title", options.title, "--body", appendMarker(options.body), "-R", repo];
        if (options.label) args.push("--label", options.label);
        if (options.assignee) args.push("--assignee", options.assignee);

        const stdout = await execGh(args);
        const url = stdout.trim();

        if (result.enforce) {
          const enforceArgs = buildEnforceArgs(result.enforce, config.selfUserId);
          if (enforceArgs.length > 0) {
            const match = url.match(/\/(\d+)$/);
            if (!match) {
              throw {
                error: "Failed to extract issue number from created issue URL",
                code: "ENFORCE_ERROR",
                details: { url },
              } satisfies ErrorResponse;
            }
            const issueNumber = match[1]!;
            try {
              await execGh(["issue", "edit", issueNumber, "-R", repo, ...enforceArgs]);
            } catch (enforceError) {
              throw {
                error: "Issue was created but enforce failed",
                code: "ENFORCE_ERROR",
                details: { url, enforceError },
              } satisfies ErrorResponse;
            }
          }
        }

        outputJson({ success: true, message: "Issue created successfully", url });
      } catch (error) {
        handleError(error);
      }
    });

  return create;
}
