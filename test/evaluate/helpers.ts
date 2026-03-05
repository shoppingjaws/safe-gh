import type { Config, IssueContext } from "../../src/types.ts";

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    allowedOwners: ["myorg"],
    issueEdit: [],
    issueComment: [],
    issueCreate: [],
    issueSubIssue: [],
    issueDependency: [],
    selfUserId: "bot-user",
    defaultPermission: "deny",
    ...overrides,
  };
}

export function makeContext(overrides: Partial<IssueContext> = {}): IssueContext {
  return {
    repo: "myorg/myrepo",
    issueNumber: 42,
    issueTitle: "Some issue",
    issueAuthor: "bot-user",
    labels: ["bug"],
    assignees: ["bot-user"],
    parentIssueNumber: null,
    parentIssueAssignees: [],
    parentIssueLabels: [],
    parentIssueTitle: null,
    ...overrides,
  };
}
