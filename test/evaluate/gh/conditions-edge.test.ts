import { describe, test, expect } from "bun:test";
import { checkIssueCondition, checkAllowedOwners, evaluateRules } from "../../../src/conditions.ts";
import { makeConfig, makeContext } from "../helpers.ts";

describe("checkIssueCondition: titlePrefix エッジケース", () => {
  test("titlePrefix: '' (空文字) は全タイトルにマッチする (no-op)", () => {
    const context = makeContext({ issueTitle: "anything" });
    const matched = checkIssueCondition({ titlePrefix: "" }, context, "bot-user");
    // "anything".startsWith("") は true
    expect(matched).toBe(true);
  });

  test("titlePrefix: undefined は条件チェックをスキップ", () => {
    const context = makeContext({ issueTitle: "no prefix" });
    const matched = checkIssueCondition({}, context, "bot-user");
    expect(matched).toBe(true);
  });
});

describe("checkIssueCondition: labels の非対称性", () => {
  test.skip("labels.include: [] は exclude: [] と同様に no-op として扱われるべき", () => {
    const context = makeContext({ labels: ["bug"] });

    // BUG: include: [] → .some() が false → 全ブロックされてしまう
    // 正しくは exclude: [] と同様にスキップ（no-op）されるべき
    const includeEmpty = checkIssueCondition(
      { labels: { include: [] } },
      context,
      "bot-user"
    );
    expect(includeEmpty).toBe(true);

    const excludeEmpty = checkIssueCondition(
      { labels: { exclude: [] } },
      context,
      "bot-user"
    );
    expect(excludeEmpty).toBe(true);
  });

  test.skip("labels: { include: [], exclude: [] } は両方 no-op で一致するべき", () => {
    const context = makeContext({ labels: ["bug"] });
    // BUG: include: [] が false を返すため全体が false になる
    // 正しくは両方とも空なので no-op → true
    const matched = checkIssueCondition(
      { labels: { include: [], exclude: [] } },
      context,
      "bot-user"
    );
    expect(matched).toBe(true);
  });
});

describe("checkIssueCondition: createdBy / assignee と selfUserId", () => {
  test("createdBy: 'self' で selfUserId が undefined なら不一致", () => {
    const context = makeContext({ issueAuthor: "someone" });
    const matched = checkIssueCondition({ createdBy: "self" }, context, undefined);
    expect(matched).toBe(false);
  });

  test("assignee: 'self' で selfUserId が undefined なら不一致", () => {
    const context = makeContext({ assignees: ["someone"] });
    const matched = checkIssueCondition({ assignee: "self" }, context, undefined);
    expect(matched).toBe(false);
  });
});

describe("checkIssueCondition: parentIssue.titlePrefix", () => {
  test("parentIssue.titlePrefix が設定されているが parentIssueTitle が null なら不一致", () => {
    const context = makeContext({
      parentIssueNumber: 10,
      parentIssueTitle: null,
      parentIssueAssignees: [],
      parentIssueLabels: [],
    });
    const matched = checkIssueCondition(
      { parentIssue: { titlePrefix: "[Epic] " } },
      context,
      "bot-user"
    );
    expect(matched).toBe(false);
  });

  test("parentIssue.titlePrefix: '' (空文字) は parentIssueTitle があれば全マッチ", () => {
    const context = makeContext({
      parentIssueNumber: 10,
      parentIssueTitle: "anything",
      parentIssueAssignees: [],
      parentIssueLabels: [],
    });
    const matched = checkIssueCondition(
      { parentIssue: { titlePrefix: "" } },
      context,
      "bot-user"
    );
    expect(matched).toBe(true);
  });
});

describe("checkAllowedOwners: エッジケース", () => {
  test("repo が空文字列の場合、owner を判定できずエラー", () => {
    const config = makeConfig({ allowedOwners: ["myorg"] });
    const result = checkAllowedOwners(config, "");
    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(false);
    expect(result!.reason).toContain("Could not determine owner");
  });

  test("repo にスラッシュがない場合、全体が owner として扱われる", () => {
    const config = makeConfig({ allowedOwners: ["myorg"] });
    // "myorg" → owner = "myorg" → 許可
    const result = checkAllowedOwners(config, "myorg");
    expect(result).toBeNull();
  });

  test("repo が '/' のみの場合、owner は空文字列", () => {
    const config = makeConfig({ allowedOwners: ["myorg"] });
    const result = checkAllowedOwners(config, "/");
    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(false);
  });
});

describe("evaluateRules: ルール評価順序", () => {
  test("最初にマッチしたルールが適用され、後のルールは無視", () => {
    const context = makeContext({ labels: ["bug", "feature"] });
    const result = evaluateRules(
      [
        { name: "narrow-rule", condition: { labels: { include: ["bug"] } }, enforce: { titlePrefix: "[BUG] " } },
        { name: "broad-rule", condition: { labels: { include: ["feature"] } }, enforce: { titlePrefix: "[FEAT] " } },
      ],
      context,
      "bot-user"
    );
    expect(result.allowed).toBe(true);
    expect(result.ruleName).toBe("narrow-rule");
    expect(result.enforce?.titlePrefix).toBe("[BUG] ");
  });

  test("条件なしルール (catch-all) が先頭にあると全て許可してしまう", () => {
    const context = makeContext({ labels: ["dangerous"] });
    const result = evaluateRules(
      [
        { name: "catch-all" },
        { name: "specific", condition: { labels: { include: ["safe"] } } },
      ],
      context,
      "bot-user"
    );
    // 条件なしルールが先頭にあるため、labels: ["dangerous"] でも許可される
    expect(result.allowed).toBe(true);
    expect(result.ruleName).toBe("catch-all");
  });

  test("全ルールが条件不一致なら拒否", () => {
    const context = makeContext({ labels: ["unknown"] });
    const result = evaluateRules(
      [
        { name: "only-bug", condition: { labels: { include: ["bug"] } } },
        { name: "only-feature", condition: { labels: { include: ["feature"] } } },
      ],
      context,
      "bot-user"
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("No matching rule");
  });
});
