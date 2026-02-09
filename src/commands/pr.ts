import { Command } from "commander";
import {
  listPrs,
  viewPr,
  createPr,
  editPr,
  closePr,
  reopenPr,
  mergePr,
  reviewPr,
  diffPr,
  checksPr,
  updateBranchPr,
  commentPr,
  listPrComments,
  editPrComment,
  deletePrComment,
} from "../gh-client.ts";
import { outputJson, handleError } from "./utils.ts";

export function createPrCommand(): Command {
  const pr = new Command("pr").description("Pull request operations");

  pr.command("list")
    .description("List pull requests")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (options) => {
      try {
        const prs = await listPrs(options.repo);
        outputJson(prs);
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("view")
    .description("View a pull request")
    .argument("<number>", "PR number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        const prData = await viewPr(prNumber, options.repo);
        outputJson(prData);
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("create")
    .description("Create a pull request")
    .requiredOption("-t, --title <title>", "PR title")
    .option("-b, --body <body>", "PR body")
    .option("-B, --base <base>", "Base branch")
    .option("-H, --head <head>", "Head branch")
    .option("-d, --draft", "Create as draft")
    .option("-l, --label <labels>", "Comma-separated labels")
    .option("-a, --assignee <assignees>", "Comma-separated assignees")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (options) => {
      try {
        const result = await createPr({
          title: options.title,
          body: options.body,
          base: options.base,
          head: options.head,
          draft: options.draft,
          labels: options.label?.split(","),
          assignees: options.assignee?.split(","),
          repo: options.repo,
        });
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("edit")
    .description("Edit a pull request")
    .argument("<number>", "PR number")
    .option("--title <title>", "New title")
    .option("-b, --body <body>", "New body")
    .option("-B, --base <base>", "New base branch")
    .option("--add-label <labels>", "Comma-separated labels to add")
    .option("--remove-label <labels>", "Comma-separated labels to remove")
    .option("--add-assignee <assignees>", "Comma-separated assignees to add")
    .option("--remove-assignee <assignees>", "Comma-separated assignees to remove")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        await editPr(prNumber, {
          title: options.title,
          body: options.body,
          base: options.base,
          addLabels: options.addLabel?.split(","),
          removeLabels: options.removeLabel?.split(","),
          addAssignees: options.addAssignee?.split(","),
          removeAssignees: options.removeAssignee?.split(","),
          repo: options.repo,
        });
        outputJson({ success: true, prNumber, message: "PR edited successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("close")
    .description("Close a pull request")
    .argument("<number>", "PR number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        await closePr(prNumber, options.repo);
        outputJson({ success: true, prNumber, message: "PR closed successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("reopen")
    .description("Reopen a pull request")
    .argument("<number>", "PR number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        await reopenPr(prNumber, options.repo);
        outputJson({ success: true, prNumber, message: "PR reopened successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("merge")
    .description("Merge a pull request")
    .argument("<number>", "PR number")
    .option("-m, --method <method>", "Merge method: merge, squash, or rebase", "merge")
    .option("--delete-branch", "Delete the branch after merge")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        await mergePr(prNumber, {
          method: options.method,
          deleteRemoteBranch: options.deleteBranch,
          repo: options.repo,
        });
        outputJson({ success: true, prNumber, message: "PR merged successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("review")
    .description("Review a pull request")
    .argument("<number>", "PR number")
    .option("--approve", "Approve the PR")
    .option("--request-changes", "Request changes")
    .option("--comment", "Add a review comment")
    .option("-b, --body <body>", "Review body")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        await reviewPr(prNumber, {
          approve: options.approve,
          requestChanges: options.requestChanges,
          comment: options.comment,
          body: options.body,
          repo: options.repo,
        });
        outputJson({ success: true, prNumber, message: "PR reviewed successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("diff")
    .description("View PR diff")
    .argument("<number>", "PR number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        const diff = await diffPr(prNumber, options.repo);
        console.log(diff);
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("checks")
    .description("View PR checks")
    .argument("<number>", "PR number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        const checks = await checksPr(prNumber, options.repo);
        console.log(checks);
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("update-branch")
    .description("Update PR branch")
    .argument("<number>", "PR number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        await updateBranchPr(prNumber, options.repo);
        outputJson({ success: true, prNumber, message: "PR branch updated successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("comment")
    .description("Add a comment to a PR (with AI marker)")
    .argument("<number>", "PR number")
    .requiredOption("-b, --body <body>", "Comment body")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        await commentPr(prNumber, options.body, options.repo);
        outputJson({ success: true, prNumber, message: "Comment added successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("comments")
    .description("List comments on a PR")
    .argument("<number>", "PR number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        const comments = await listPrComments(prNumber, options.repo);
        outputJson(comments);
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("edit-comment")
    .description("Edit a PR comment (AI-created comments only)")
    .argument("<number>", "PR number")
    .requiredOption("--comment-id <id>", "Comment ID")
    .requiredOption("-b, --body <body>", "New comment body")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        const commentId = parseInt(options.commentId, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        if (isNaN(commentId)) {
          throw { error: "Invalid comment ID", code: "VALIDATION_ERROR" };
        }
        await editPrComment(prNumber, commentId, options.body, options.repo);
        outputJson({ success: true, prNumber, commentId, message: "Comment edited successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  pr.command("delete-comment")
    .description("Delete a PR comment (AI-created comments only)")
    .argument("<number>", "PR number")
    .requiredOption("--comment-id <id>", "Comment ID")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const prNumber = parseInt(number, 10);
        const commentId = parseInt(options.commentId, 10);
        if (isNaN(prNumber)) {
          throw { error: "Invalid PR number", code: "VALIDATION_ERROR" };
        }
        if (isNaN(commentId)) {
          throw { error: "Invalid comment ID", code: "VALIDATION_ERROR" };
        }
        await deletePrComment(prNumber, commentId, options.repo);
        outputJson({ success: true, prNumber, commentId, message: "Comment deleted successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  return pr;
}
