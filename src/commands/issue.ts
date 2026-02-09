import { Command } from "commander";
import {
  listIssues,
  viewIssue,
  createIssue,
  editIssue,
  closeIssue,
  reopenIssue,
  deleteIssue,
  commentIssue,
  editComment,
  deleteComment,
  listComments,
} from "../gh-client.ts";
import { outputJson, handleError } from "./utils.ts";

export function createIssueCommand(): Command {
  const issue = new Command("issue").description("Issue operations");

  issue
    .command("list")
    .description("List issues")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (options) => {
      try {
        const issues = await listIssues(options.repo);
        outputJson(issues);
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("view")
    .description("View an issue")
    .argument("<number>", "Issue number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        if (isNaN(issueNumber)) {
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" };
        }
        const issueData = await viewIssue(issueNumber, options.repo);
        outputJson(issueData);
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("create")
    .description("Create a new issue")
    .requiredOption("-t, --title <title>", "Issue title")
    .option("-b, --body <body>", "Issue body")
    .option("-l, --label <labels>", "Comma-separated labels")
    .option("-a, --assignee <assignees>", "Comma-separated assignees")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (options) => {
      try {
        const result = await createIssue(options.title, {
          body: options.body,
          labels: options.label?.split(","),
          assignees: options.assignee?.split(","),
          repo: options.repo,
        });
        console.log(result.trim());
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("edit")
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
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" };
        }
        await editIssue(issueNumber, {
          title: options.title,
          body: options.body,
          addLabels: options.addLabel?.split(","),
          removeLabels: options.removeLabel?.split(","),
          addAssignees: options.addAssignee?.split(","),
          removeAssignees: options.removeAssignee?.split(","),
          repo: options.repo,
        });
        outputJson({ success: true, issueNumber, message: "Issue edited successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("close")
    .description("Close an issue")
    .argument("<number>", "Issue number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        if (isNaN(issueNumber)) {
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" };
        }
        await closeIssue(issueNumber, options.repo);
        outputJson({ success: true, issueNumber, message: "Issue closed successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("reopen")
    .description("Reopen an issue")
    .argument("<number>", "Issue number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        if (isNaN(issueNumber)) {
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" };
        }
        await reopenIssue(issueNumber, options.repo);
        outputJson({ success: true, issueNumber, message: "Issue reopened successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("delete")
    .description("Delete an issue")
    .argument("<number>", "Issue number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        if (isNaN(issueNumber)) {
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" };
        }
        await deleteIssue(issueNumber, options.repo);
        outputJson({ success: true, issueNumber, message: "Issue deleted successfully" });
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("comment")
    .description("Add a comment to an issue (with AI marker)")
    .argument("<number>", "Issue number")
    .requiredOption("-b, --body <body>", "Comment body")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        if (isNaN(issueNumber)) {
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" };
        }
        await commentIssue(issueNumber, options.body, options.repo);
        outputJson({
          success: true,
          issueNumber,
          message: "Comment added successfully",
        });
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("comments")
    .description("List comments on an issue")
    .argument("<number>", "Issue number")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        if (isNaN(issueNumber)) {
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" };
        }
        const comments = await listComments(issueNumber, options.repo);
        outputJson(comments);
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("edit-comment")
    .description("Edit a comment (AI-created comments only)")
    .argument("<number>", "Issue number")
    .requiredOption("--comment-id <id>", "Comment ID")
    .requiredOption("-b, --body <body>", "New comment body")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        const commentId = parseInt(options.commentId, 10);
        if (isNaN(issueNumber)) {
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" };
        }
        if (isNaN(commentId)) {
          throw { error: "Invalid comment ID", code: "VALIDATION_ERROR" };
        }
        await editComment(issueNumber, commentId, options.body, options.repo);
        outputJson({
          success: true,
          issueNumber,
          commentId,
          message: "Comment edited successfully",
        });
      } catch (error) {
        handleError(error);
      }
    });

  issue
    .command("delete-comment")
    .description("Delete a comment (AI-created comments only)")
    .argument("<number>", "Issue number")
    .requiredOption("--comment-id <id>", "Comment ID")
    .option("-R, --repo <repo>", "Repository in owner/repo format")
    .action(async (number: string, options) => {
      try {
        const issueNumber = parseInt(number, 10);
        const commentId = parseInt(options.commentId, 10);
        if (isNaN(issueNumber)) {
          throw { error: "Invalid issue number", code: "VALIDATION_ERROR" };
        }
        if (isNaN(commentId)) {
          throw { error: "Invalid comment ID", code: "VALIDATION_ERROR" };
        }
        await deleteComment(issueNumber, commentId, options.repo);
        outputJson({
          success: true,
          issueNumber,
          commentId,
          message: "Comment deleted successfully",
        });
      } catch (error) {
        handleError(error);
      }
    });

  return issue;
}
