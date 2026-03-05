import { describe, test, expect } from "bun:test";
import { buildEnforceArgs, appendMarker } from "../../../src/commands/utils.ts";

describe("buildEnforceArgs", () => {
  test("titlePrefix のみの enforce は空配列を返す", () => {
    // BUG: buildEnforceArgs は titlePrefix を処理しない
    // titlePrefix は呼び出し側で別途処理される
    const result = buildEnforceArgs({ titlePrefix: "[WIP] " }, "bot-user");
    expect(result).toEqual([]);
  });

  test("全フィールド指定時", () => {
    const result = buildEnforceArgs(
      {
        addLabels: ["l1", "l2"],
        removeLabels: ["l3"],
        addAssignees: ["a1"],
        removeAssignees: ["a2"],
      },
      "bot-user"
    );
    expect(result).toContain("--add-label");
    expect(result).toContain("l1");
    expect(result).toContain("l2");
    expect(result).toContain("--remove-label");
    expect(result).toContain("l3");
    expect(result).toContain("--add-assignee");
    expect(result).toContain("a1");
    expect(result).toContain("--remove-assignee");
    expect(result).toContain("a2");
  });

  test("addAssignees: ['self'] は selfUserId に解決される", () => {
    const result = buildEnforceArgs({ addAssignees: ["self"] }, "bot-user");
    expect(result).toEqual(["--add-assignee", "bot-user"]);
  });

  test("addAssignees: ['self'] で selfUserId が undefined なら throw", () => {
    expect(() => buildEnforceArgs({ addAssignees: ["self"] }, undefined)).toThrow();
  });

  test("removeAssignees: ['self'] は selfUserId に解決される", () => {
    const result = buildEnforceArgs({ removeAssignees: ["self"] }, "bot-user");
    expect(result).toEqual(["--remove-assignee", "bot-user"]);
  });

  test("addAssignees: ['self', 'other'] は混合で解決される", () => {
    const result = buildEnforceArgs({ addAssignees: ["self", "other"] }, "bot-user");
    expect(result).toEqual(["--add-assignee", "bot-user", "--add-assignee", "other"]);
  });

  test("空の enforce は空配列を返す", () => {
    const result = buildEnforceArgs({}, "bot-user");
    expect(result).toEqual([]);
  });
});

describe("appendMarker", () => {
  test("body にタイムスタンプ付きマーカーが追加される", () => {
    const result = appendMarker("hello");
    expect(result).toContain("hello");
    expect(result).toContain("<!-- safe-gh:");
    expect(result).toContain("-->");
  });

  test("空文字の body でもマーカーが追加される", () => {
    const result = appendMarker("");
    expect(result).toContain("<!-- safe-gh:");
  });
});
