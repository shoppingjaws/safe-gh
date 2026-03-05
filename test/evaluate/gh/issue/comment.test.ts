import { describe, test, expect } from "bun:test";
import { evaluateCommand } from "../../evaluate.ts";
import { makeConfig, makeContext } from "../../helpers.ts";

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
