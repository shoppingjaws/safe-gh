import { describe, test, expect } from "bun:test";
import { evaluateCommand } from "../../../src/evaluate.ts";
import { checkAllowedOwners, checkIssueCondition } from "../../../src/conditions.ts";
import { makeConfig, makeContext } from "../helpers.ts";

describe("allowedOwners: [] は全オーナーを拒否する", () => {
  test("allowedOwners: [] は全オーナーを拒否すべき", () => {
    const config = makeConfig({
      allowedOwners: [],
      issueEdit: [{ name: "allow-all" }],
    });

    // 空配列 = 許可オーナーなし = 全拒否 を期待
    const result = checkAllowedOwners(config, "any-org/any-repo");

    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(false);
  });

  test("allowedOwners: [] で evaluateCommand も拒否になる", () => {
    const config = makeConfig({
      allowedOwners: [],
      issueEdit: [{ name: "allow-all" }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext(),
      options: { title: "t" },
    });
    expect(result.permission.allowed).toBe(false);
  });
});

describe("labels.include: [] は条件不一致になる", () => {
  test("labels.include: [] はどのラベルにもマッチしない = 条件不一致", () => {
    const context = makeContext({ labels: ["bug"] });

    // include: [] は「指定ラベルなし」= マッチなし = false を期待
    const matched = checkIssueCondition(
      { labels: { include: [] } },
      context,
      "bot-user"
    );

    expect(matched).toBe(false);
  });

  test("labels.include: [] で evaluateCommand がルール不一致になる", () => {
    const config = makeConfig({
      issueEdit: [
        { name: "empty-include", condition: { labels: { include: [] } } },
      ],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext({ labels: ["bug"] }),
      options: { title: "t" },
    });
    expect(result.permission.allowed).toBe(false);
  });
});

describe("repos: [] / owners: [] は条件不一致になる", () => {
  test("repos: [] はどのリポジトリにもマッチしない = 条件不一致", () => {
    const context = makeContext({ repo: "myorg/myrepo" });

    const matched = checkIssueCondition(
      { repos: [] },
      context,
      "bot-user"
    );

    expect(matched).toBe(false);
  });

  test("owners: [] はどのオーナーにもマッチしない = 条件不一致", () => {
    const context = makeContext({ repo: "myorg/myrepo" });

    const matched = checkIssueCondition(
      { owners: [] },
      context,
      "bot-user"
    );

    expect(matched).toBe(false);
  });

  test("repos: [] で evaluateCommand がルール不一致になる", () => {
    const config = makeConfig({
      issueEdit: [
        { name: "empty-repos", condition: { repos: [] } },
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

describe("parentIssue: {} は親 issue の存在を要求する", () => {
  test("parentIssue: {} は親 issue の存在を要求すべき", () => {
    const context = makeContext({
      parentIssueNumber: null,
      parentIssueAssignees: [],
      parentIssueLabels: [],
      parentIssueTitle: null,
    });

    const matched = checkIssueCondition(
      { parentIssue: {} },
      context,
      "bot-user"
    );

    expect(matched).toBe(false);
  });

  test("parentIssue: {} で親 issue がある場合は通過する", () => {
    const context = makeContext({
      parentIssueNumber: 10,
      parentIssueAssignees: ["someone"],
      parentIssueLabels: ["epic"],
      parentIssueTitle: "Parent",
    });

    const matched = checkIssueCondition(
      { parentIssue: {} },
      context,
      "bot-user"
    );

    expect(matched).toBe(true);
  });
});

describe("enforce titlePrefix は title 未指定時にも既存タイトルへ適用する", () => {
  test("enforce titlePrefix が title 未指定時に既存タイトルへ適用されるべき", () => {
    const config = makeConfig({
      issueEdit: [
        { name: "with-prefix", enforce: { titlePrefix: "[WIP] " } },
      ],
    });

    // body のみ編集、title は未指定
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext({ issueTitle: "my feature" }),
      options: { body: "updated body" },
    });

    expect(result.permission.allowed).toBe(true);
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;

    expect(args).toContain("--title");
    const titleIdx = args.indexOf("--title");
    expect(args[titleIdx + 1]).toBe("[WIP] my feature");
  });

  test("enforce titlePrefix: 既存タイトルにプレフィックスがあれば --title を追加しない", () => {
    const config = makeConfig({
      issueEdit: [
        { name: "with-prefix", enforce: { titlePrefix: "[WIP] " } },
      ],
    });

    // body のみ編集、既存タイトルは既にプレフィックス付き
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext({ issueTitle: "[WIP] my feature" }),
      options: { body: "updated body" },
    });

    expect(result.permission.allowed).toBe(true);
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;

    // 既にプレフィックスがあるので --title は不要
    expect(args).not.toContain("--title");
  });
});
