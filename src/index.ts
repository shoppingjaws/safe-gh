#!/usr/bin/env bun

import { Command } from "commander";
import { createIssueEditCommand } from "./commands/issue-edit.ts";
import { createIssueCommentCommand } from "./commands/issue-comment.ts";
import { createConfigCommand } from "./commands/config.ts";
import { setDryRun } from "./gh.ts";

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

program.addCommand(issue);
program.addCommand(createConfigCommand());

program.parse();
