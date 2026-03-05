import { describe, test, expect } from "bun:test";
import { checkIssueCondition } from "../../../src/conditions.ts";
import { makeContext } from "../helpers.ts";

describe("checkIssueCondition: 空配列・空オブジェクトの扱い", () => {
  test("labels.include: [] はどのラベルにもマッチしない", () => {
    const context = makeContext({ labels: ["bug"] });
    const matched = checkIssueCondition(
      { labels: { include: [] } },
      context,
      "bot-user"
    );
    expect(matched).toBe(false);
  });

  test("repos: [] はどのリポジトリにもマッチしない", () => {
    const context = makeContext({ repo: "myorg/myrepo" });
    const matched = checkIssueCondition(
      { repos: [] },
      context,
      "bot-user"
    );
    expect(matched).toBe(false);
  });

  test("owners: [] はどのオーナーにもマッチしない", () => {
    const context = makeContext({ repo: "myorg/myrepo" });
    const matched = checkIssueCondition(
      { owners: [] },
      context,
      "bot-user"
    );
    expect(matched).toBe(false);
  });

  test("parentIssue: {} は親 issue がなければ不一致", () => {
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

  test("parentIssue: {} は親 issue があれば一致", () => {
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

  test("parentIssue.labels.include: [] もトップレベルと同様にマッチしない", () => {
    // トップレベルの labels.include: [] は false を返す（some() が false）
    // parentIssue.labels.include: [] も同様に false を返すべき
    const context = makeContext({
      parentIssueNumber: 10,
      parentIssueAssignees: [],
      parentIssueLabels: ["epic"],
      parentIssueTitle: "Parent",
    });
    const matched = checkIssueCondition(
      { parentIssue: { labels: { include: [] } } },
      context,
      "bot-user"
    );
    expect(matched).toBe(false);
  });
});

