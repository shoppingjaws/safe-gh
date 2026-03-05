import { describe, test, expect } from "bun:test";
import { evaluateCommand } from "../src/evaluate.ts";
import type { CommandInput, EvaluateResult } from "../src/evaluate.ts";
import type { Config, IssueContext } from "../src/types.ts";

// ============================================================
// Helpers
// ============================================================

function makeConfig(overrides: Partial<Config> = {}): Config {
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

function makeContext(overrides: Partial<IssueContext> = {}): IssueContext {
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

// ============================================================
// issue edit
// ============================================================

describe("issue edit", () => {
  test("拒否: ルールなし", () => {
    const config = makeConfig();
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: { title: "new title" },
    });
    expect(result.permission.allowed).toBe(false);
    expect(result.execution).toBeNull();
    expect(result.enforceExecution).toBeNull();
  });

  test("許可: 条件なしルール", () => {
    const config = makeConfig({
      issueEdit: [{ name: "allow-all" }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: { title: "new title" },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.execution).not.toBeNull();
    expect(result.execution!.type).toBe("gh-cli");
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    expect(args).toContain("--title");
    expect(args).toContain("new title");
  });

  test("enforce titlePrefix が title に付与される", () => {
    const config = makeConfig({
      issueEdit: [{ name: "with-prefix", enforce: { titlePrefix: "[WIP] " } }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: { title: "my feature" },
    });
    expect(result.permission.allowed).toBe(true);
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    const titleIdx = args.indexOf("--title");
    expect(args[titleIdx + 1]).toBe("[WIP] my feature");
  });

  test("enforce titlePrefix: 既にプレフィックス付きなら二重付与しない", () => {
    const config = makeConfig({
      issueEdit: [{ name: "with-prefix", enforce: { titlePrefix: "[WIP] " } }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: { title: "[WIP] my feature" },
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    const titleIdx = args.indexOf("--title");
    expect(args[titleIdx + 1]).toBe("[WIP] my feature");
  });

  test("enforce addLabels が args に反映される", () => {
    const config = makeConfig({
      issueEdit: [{ name: "add-labels", enforce: { addLabels: ["ai-edit"] } }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: { body: "updated body" },
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    expect(args).toContain("--add-label");
    expect(args).toContain("ai-edit");
  });

  test("body に marker が付与される", () => {
    const config = makeConfig({
      issueEdit: [{ name: "allow-all" }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: { body: "hello world" },
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    const bodyIdx = args.indexOf("--body");
    expect(args[bodyIdx + 1]).toContain("hello world");
    expect(args[bodyIdx + 1]).toContain("<!-- safe-gh:");
  });

  test("全オプションが args に含まれる", () => {
    const config = makeConfig({
      issueEdit: [{ name: "allow-all" }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: {
        title: "t",
        body: "b",
        addLabel: "l1",
        removeLabel: "l2",
        addAssignee: "a1",
        removeAssignee: "a2",
      },
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    expect(args).toContain("--title");
    expect(args).toContain("--body");
    expect(args).toContain("--add-label");
    expect(args).toContain("--remove-label");
    expect(args).toContain("--add-assignee");
    expect(args).toContain("--remove-assignee");
  });

  test("条件マッチしないルールはスキップされる", () => {
    const config = makeConfig({
      issueEdit: [
        { name: "only-other-repo", condition: { repos: ["myorg/other"] } },
      ],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: { title: "t" },
    });
    expect(result.permission.allowed).toBe(false);
  });
});

// ============================================================
// issue comment
// ============================================================

describe("issue comment", () => {
  test("許可時の args 構築", () => {
    const config = makeConfig({
      issueComment: [{ name: "allow-comment" }],
    });
    const ctx = makeContext();
    const result = evaluateCommand(config, {
      command: "issue comment",
      context: ctx,
      options: { body: "my comment" },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.execution!.type).toBe("gh-cli");
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    expect(args[0]).toBe("issue");
    expect(args[1]).toBe("comment");
    expect(args[2]).toBe("42");
    expect(args).toContain("-R");
    expect(args).toContain("myorg/myrepo");
    // body にはマーカーが含まれる
    const bodyIdx = args.indexOf("--body");
    expect(args[bodyIdx + 1]).toContain("my comment");
    expect(args[bodyIdx + 1]).toContain("<!-- safe-gh:");
  });

  test("拒否時 execution は null", () => {
    const config = makeConfig();
    const result = evaluateCommand(config, {
      command: "issue comment",
      context: makeContext(),
      options: { body: "comment" },
    });
    expect(result.permission.allowed).toBe(false);
    expect(result.execution).toBeNull();
  });
});

// ============================================================
// issue create
// ============================================================

describe("issue create", () => {
  test("synthetic context が正しく構築される", () => {
    const config = makeConfig({
      issueCreate: [{ name: "allow-create" }],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "new issue", body: "body text", label: "bug,feature", assignee: "user1" },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.context.issueNumber).toBe(0);
    expect(result.context.issueTitle).toBe("new issue");
    expect(result.context.issueAuthor).toBe("bot-user");
    expect(result.context.labels).toEqual(["bug", "feature"]);
    expect(result.context.assignees).toEqual(["user1"]);
    expect(result.context.parentIssueNumber).toBeNull();
  });

  test("args に title, body, label, assignee が含まれる", () => {
    const config = makeConfig({
      issueCreate: [{ name: "allow-create" }],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "new issue", body: "body text", label: "bug", assignee: "user1" },
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    expect(args).toContain("--title");
    expect(args).toContain("--label");
    expect(args).toContain("bug");
    expect(args).toContain("--assignee");
    expect(args).toContain("user1");
    expect(args).toContain("-R");
    expect(args).toContain("myorg/myrepo");
  });

  test("label/assignee 省略時は args に含まれない", () => {
    const config = makeConfig({
      issueCreate: [{ name: "allow-create" }],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "t", body: "b" },
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    expect(args).not.toContain("--label");
    expect(args).not.toContain("--assignee");
  });

  test("enforce titlePrefix が反映される", () => {
    const config = makeConfig({
      issueCreate: [{ name: "with-prefix", enforce: { titlePrefix: "[AUTO] " } }],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "task", body: "b" },
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    const titleIdx = args.indexOf("--title");
    expect(args[titleIdx + 1]).toBe("[AUTO] task");
  });

  test("enforceExecution が生成される", () => {
    const config = makeConfig({
      issueCreate: [{ name: "with-enforce", enforce: { addLabels: ["auto"] } }],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "t", body: "b" },
    });
    expect(result.enforceExecution).not.toBeNull();
    const enforceArgs = result.enforceExecution!.args;
    expect(enforceArgs[0]).toBe("issue");
    expect(enforceArgs[1]).toBe("edit");
    expect(enforceArgs[2]).toBe("<created-issue-number>");
    expect(enforceArgs).toContain("--add-label");
    expect(enforceArgs).toContain("auto");
  });

  test("enforce なしなら enforceExecution は null", () => {
    const config = makeConfig({
      issueCreate: [{ name: "no-enforce" }],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "t", body: "b" },
    });
    expect(result.enforceExecution).toBeNull();
  });

  test("拒否時", () => {
    const config = makeConfig();
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "t", body: "b" },
    });
    expect(result.permission.allowed).toBe(false);
    expect(result.execution).toBeNull();
    expect(result.enforceExecution).toBeNull();
  });
});

// ============================================================
// issue sub-issue
// ============================================================

describe("issue sub-issue", () => {
  test("add: GraphQL mutation と variables が正しい", () => {
    const config = makeConfig({
      issueSubIssue: [{ name: "allow-sub" }],
    });
    const result = evaluateCommand(config, {
      command: "issue sub-issue add",
      context: makeContext(),
      child: { repo: "myorg/myrepo", number: 99 },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.execution!.type).toBe("graphql");
    const exec = result.execution as {
      type: "graphql";
      mutation: string;
      variables: Record<string, string>;
      headers?: Record<string, string>;
    };
    expect(exec.mutation).toBe("addSubIssue");
    expect(exec.variables.issueId).toBe("<node-id:myorg/myrepo#42>");
    expect(exec.variables.subIssueId).toBe("<node-id:myorg/myrepo#99>");
    expect(exec.headers).toEqual({ "GraphQL-Features": "sub_issues" });
  });

  test("remove: GraphQL mutation と variables が正しい", () => {
    const config = makeConfig({
      issueSubIssue: [{ name: "allow-sub" }],
    });
    const result = evaluateCommand(config, {
      command: "issue sub-issue remove",
      context: makeContext(),
      child: { repo: "myorg/myrepo", number: 99 },
    });
    expect(result.execution!.type).toBe("graphql");
    const exec = result.execution as {
      type: "graphql";
      mutation: string;
      variables: Record<string, string>;
    };
    expect(exec.mutation).toBe("removeSubIssue");
    expect(exec.variables.issueId).toBe("<node-id:myorg/myrepo#42>");
    expect(exec.variables.subIssueId).toBe("<node-id:myorg/myrepo#99>");
  });

  test("クロスリポ: 許可外 owner で拒否", () => {
    const config = makeConfig({
      issueSubIssue: [{ name: "allow-sub" }],
    });
    const result = evaluateCommand(config, {
      command: "issue sub-issue add",
      context: makeContext(),
      child: { repo: "other-org/other-repo", number: 10 },
    });
    expect(result.permission.allowed).toBe(false);
    expect(result.permission.reason).toContain("allowedOwners");
    expect(result.execution).toBeNull();
  });

  test("クロスリポ: 許可 owner なら成功", () => {
    const config = makeConfig({
      allowedOwners: ["myorg", "partner-org"],
      issueSubIssue: [{ name: "allow-sub" }],
    });
    const result = evaluateCommand(config, {
      command: "issue sub-issue add",
      context: makeContext(),
      child: { repo: "partner-org/repo", number: 10 },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.execution!.type).toBe("graphql");
  });

  test("拒否: ルールなし", () => {
    const config = makeConfig();
    const result = evaluateCommand(config, {
      command: "issue sub-issue add",
      context: makeContext(),
      child: { repo: "myorg/myrepo", number: 99 },
    });
    expect(result.permission.allowed).toBe(false);
    expect(result.execution).toBeNull();
  });
});

// ============================================================
// issue dependency
// ============================================================

describe("issue dependency", () => {
  test("add: GraphQL mutation と variables が正しい", () => {
    const config = makeConfig({
      issueDependency: [{ name: "allow-dep" }],
    });
    const result = evaluateCommand(config, {
      command: "issue dependency add",
      context: makeContext(),
      blockedBy: { repo: "myorg/myrepo", number: 77 },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.execution!.type).toBe("graphql");
    const exec = result.execution as {
      type: "graphql";
      mutation: string;
      variables: Record<string, string>;
      headers?: Record<string, string>;
    };
    expect(exec.mutation).toBe("addBlockedBy");
    expect(exec.variables.issueId).toBe("<node-id:myorg/myrepo#42>");
    expect(exec.variables.blockingIssueId).toBe("<node-id:myorg/myrepo#77>");
    expect(exec.headers).toEqual({ "GraphQL-Features": "sub_issues" });
  });

  test("remove: GraphQL mutation と variables が正しい", () => {
    const config = makeConfig({
      issueDependency: [{ name: "allow-dep" }],
    });
    const result = evaluateCommand(config, {
      command: "issue dependency remove",
      context: makeContext(),
      blockedBy: { repo: "myorg/myrepo", number: 77 },
    });
    const exec = result.execution as {
      type: "graphql";
      mutation: string;
      variables: Record<string, string>;
    };
    expect(exec.mutation).toBe("removeBlockedBy");
    expect(exec.variables.issueId).toBe("<node-id:myorg/myrepo#42>");
    expect(exec.variables.blockingIssueId).toBe("<node-id:myorg/myrepo#77>");
  });

  test("クロスリポ: 許可外 owner で拒否", () => {
    const config = makeConfig({
      issueDependency: [{ name: "allow-dep" }],
    });
    const result = evaluateCommand(config, {
      command: "issue dependency add",
      context: makeContext(),
      blockedBy: { repo: "evil-org/repo", number: 1 },
    });
    expect(result.permission.allowed).toBe(false);
    expect(result.permission.reason).toContain("allowedOwners");
    expect(result.execution).toBeNull();
  });

  test("クロスリポ: 許可 owner なら成功", () => {
    const config = makeConfig({
      allowedOwners: ["myorg", "partner-org"],
      issueDependency: [{ name: "allow-dep" }],
    });
    const result = evaluateCommand(config, {
      command: "issue dependency add",
      context: makeContext(),
      blockedBy: { repo: "partner-org/repo", number: 5 },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.execution!.type).toBe("graphql");
  });

  test("拒否: ルールなし", () => {
    const config = makeConfig();
    const result = evaluateCommand(config, {
      command: "issue dependency remove",
      context: makeContext(),
      blockedBy: { repo: "myorg/myrepo", number: 77 },
    });
    expect(result.permission.allowed).toBe(false);
    expect(result.execution).toBeNull();
  });
});

// ============================================================
// allowedOwners
// ============================================================

describe("allowedOwners", () => {
  test("許可外 owner で全コマンド拒否", () => {
    const config = makeConfig({
      allowedOwners: ["myorg"],
      issueEdit: [{ name: "allow-all" }],
      issueComment: [{ name: "allow-all" }],
      issueCreate: [{ name: "allow-all" }],
      issueSubIssue: [{ name: "allow-all" }],
      issueDependency: [{ name: "allow-all" }],
    });
    const badContext = makeContext({ repo: "evil-org/repo" });

    const commands: CommandInput[] = [
      { command: "issue edit", context: badContext, options: { title: "t" } },
      { command: "issue comment", context: badContext, options: { body: "b" } },
      { command: "issue create", repo: "evil-org/repo", options: { title: "t", body: "b" } },
      { command: "issue sub-issue add", context: badContext, child: { repo: "evil-org/repo", number: 1 } },
      { command: "issue dependency add", context: badContext, blockedBy: { repo: "evil-org/repo", number: 1 } },
    ];

    for (const input of commands) {
      const result = evaluateCommand(config, input);
      expect(result.permission.allowed).toBe(false);
      expect(result.permission.reason).toContain("allowedOwners");
      expect(result.execution).toBeNull();
    }
  });

  test("allowedOwners 未設定なら owner チェックをスキップ", () => {
    const config = makeConfig({
      allowedOwners: undefined,
      issueEdit: [{ name: "allow-all" }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext({ repo: "any-org/any-repo" }),
      options: { title: "t" },
    });
    expect(result.permission.allowed).toBe(true);
  });
});

// ============================================================
// buildEnforceArgs: selfUserId 未設定で "self" 解決時に throw
// ============================================================

describe("enforce with self resolution", () => {
  test("selfUserId 未設定で addAssignees: ['self'] は throw", () => {
    const config = makeConfig({
      selfUserId: undefined,
      issueEdit: [{ name: "with-self-assign", enforce: { addAssignees: ["self"] } }],
    });
    expect(() =>
      evaluateCommand(config, {
        command: "issue edit",
        context: makeContext(),
        options: { title: "t" },
      })
    ).toThrow();
  });

  test("selfUserId 設定済みなら addAssignees: ['self'] は解決される", () => {
    const config = makeConfig({
      selfUserId: "bot-user",
      issueEdit: [{ name: "with-self-assign", enforce: { addAssignees: ["self"] } }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: { title: "t" },
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    expect(args).toContain("--add-assignee");
    expect(args).toContain("bot-user");
  });
});
