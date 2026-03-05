import { describe, test, expect } from "bun:test";
import { evaluateCommand } from "../../../../src/evaluate.ts";
import { makeConfig, makeContext } from "../../helpers.ts";

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
