#!/usr/bin/env bun

import { Command } from "commander";
import { createIssueCommand } from "./commands/issue.ts";
import { createPrCommand } from "./commands/pr.ts";
import { createSearchCommand } from "./commands/search.ts";
import { createProjectCommand } from "./commands/project.ts";
import { createConfigCommand } from "./commands/config.ts";
import { setDryRun } from "./gh-client.ts";

const program = new Command();

program
  .name("safe-gh")
  .description("A safe GitHub CLI wrapper for AI agents")
  .version("0.1.0")
  .option("--dry-run", "Check permissions without executing");

program.hook("preAction", (thisCommand) => {
  if (thisCommand.opts().dryRun) {
    setDryRun(true);
  }
});

program.addCommand(createIssueCommand());
program.addCommand(createPrCommand());
program.addCommand(createSearchCommand());
program.addCommand(createProjectCommand());
program.addCommand(createConfigCommand());

program.parse();
