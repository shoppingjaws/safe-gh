import { describe, test, expect } from "bun:test";
import { evaluateCommand } from "../../../../src/evaluate.ts";
import { makeConfig, makeContext } from "../../helpers.ts";

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

  test("enforce titlePrefix: title 未指定時に既存タイトルへ適用される", () => {
    const config = makeConfig({
      issueEdit: [{ name: "with-prefix", enforce: { titlePrefix: "[WIP] " } }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext({ issueTitle: "my feature" }),
      options: { body: "updated body" },
    });
    expect(result.permission.allowed).toBe(true);
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    const titleIdx = args.indexOf("--title");
    expect(args[titleIdx + 1]).toBe("[WIP] my feature");
  });

  test("enforce titlePrefix: title 未指定で既にプレフィックス付きなら --title を追加しない", () => {
    const config = makeConfig({
      issueEdit: [{ name: "with-prefix", enforce: { titlePrefix: "[WIP] " } }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext({ issueTitle: "[WIP] my feature" }),
      options: { body: "updated body" },
    });
    expect(result.permission.allowed).toBe(true);
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    expect(args).not.toContain("--title");
  });

  test("enforce titlePrefix: title 未指定で既存タイトルにプレフィックスがない場合、--title が付与される", () => {
    // issue-edit.ts の実コマンドハンドラは options.title がないと
    // enforce titlePrefix を無視するバグがある (issue-edit.ts:51-56)
    // evaluate.ts は context.issueTitle にフォールバックして正しく処理する
    const config = makeConfig({
      issueEdit: [{ name: "with-prefix", enforce: { titlePrefix: "[BOT] " } }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext({ issueTitle: "plain title" }),
      options: { body: "body only" },
    });
    expect(result.permission.allowed).toBe(true);
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    const titleIdx = args.indexOf("--title");
    expect(titleIdx).not.toBe(-1);
    expect(args[titleIdx + 1]).toBe("[BOT] plain title");
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
