#!/usr/bin/env bun

import { Command } from "commander";
import { createIssueEditCommand } from "./commands/issue-edit.ts";
import { createIssueCommentCommand } from "./commands/issue-comment.ts";
import { createIssueCreateCommand } from "./commands/issue-create.ts";
import { createIssueSubIssueCommand } from "./commands/issue-sub-issue.ts";
import { createIssueDependencyCommand } from "./commands/issue-dependency.ts";
import { createConfigCommand } from "./commands/config.ts";
import { setDryRun } from "./gh.ts";
import { outputJson } from "./commands/utils.ts";
import type { ErrorResponse } from "./types.ts";

const program = new Command();

program
  .name("safe-gh")
  .description("A safe GitHub CLI wrapper for AI agents")
  .version("0.1.0")
  .option("--dry-run", "Check permissions without executing");

program.hook("preAction", (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts["dryRun"]) {
    setDryRun(true);
  }
});

const issue = new Command("issue").description("Issue operations");
issue.addCommand(createIssueEditCommand());
issue.addCommand(createIssueCommentCommand());
issue.addCommand(createIssueCreateCommand());
issue.addCommand(createIssueSubIssueCommand());
issue.addCommand(createIssueDependencyCommand());

const supportedIssueSubcommands = issue.commands.map((cmd) => cmd.name());
issue.on("command:*", (operands: string[]) => {
  const inputSubcommand = operands.join(" ");
  const response: ErrorResponse = {
    error: `'issue ${inputSubcommand}' is not supported by safe-gh. Supported issue subcommands: ${supportedIssueSubcommands.join(", ")}. Please use 'gh issue ${inputSubcommand}' directly instead.`,
    code: "UNSUPPORTED_COMMAND",
  };
  outputJson(response);
  process.exit(1);
});

program.addCommand(issue);
program.addCommand(createConfigCommand());

// サポートされていないサブコマンドのハンドリング
const supportedCommands = program.commands.map((cmd) => cmd.name());
program.on("command:*", (operands: string[]) => {
  const inputCommand = operands.join(" ");
  const response: ErrorResponse = {
    error: `'${inputCommand}' is not supported by safe-gh. Supported commands: ${supportedCommands.join(", ")}. Please use 'gh ${inputCommand}' directly instead.`,
    code: "UNSUPPORTED_COMMAND",
  };
  outputJson(response);
  process.exit(1);
});

program.parse();
