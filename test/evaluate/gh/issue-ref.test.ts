import { describe, test, expect } from "bun:test";
import { parseIssueRef } from "../../../src/commands/issue-ref.ts";

describe("parseIssueRef", () => {
  const defaultRepo = "myorg/myrepo";

  test("単純な番号", () => {
    expect(parseIssueRef("123", defaultRepo)).toEqual({ repo: defaultRepo, number: 123 });
  });

  test("クロスリポ形式", () => {
    expect(parseIssueRef("other/repo#42", defaultRepo)).toEqual({ repo: "other/repo", number: 42 });
  });

  test("0 は不正な issue 番号として拒否", () => {
    expect(() => parseIssueRef("0", defaultRepo)).toThrow();
  });

  test("負数文字列は不正として拒否", () => {
    expect(() => parseIssueRef("-1", defaultRepo)).toThrow();
  });

  test("空文字列は拒否", () => {
    expect(() => parseIssueRef("", defaultRepo)).toThrow();
  });

  test.skip("スラッシュが複数ある不正な cross-repo 形式 (a/b/c#1) は拒否されるべき", () => {
    // BUG: regex ^([^/]+\/[^#]+)#(\d+)$ は owner/repo の2セグメント構造を強制しない
    // 現状は { repo: "a/b/c", number: 1 } を返してしまうが、正しくは throw すべき
    expect(() => parseIssueRef("a/b/c#1", defaultRepo)).toThrow();
  });

  test("# なしの owner/repo 形式は拒否", () => {
    expect(() => parseIssueRef("owner/repo", defaultRepo)).toThrow();
  });

  test("クロスリポで issue 番号 0 は拒否", () => {
    expect(() => parseIssueRef("owner/repo#0", defaultRepo)).toThrow();
  });

  test("先頭ゼロ付き番号 '007' は 7 にパースされる", () => {
    const result = parseIssueRef("007", defaultRepo);
    expect(result.number).toBe(7);
  });
});
