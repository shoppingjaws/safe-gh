import { describe, test, expect } from "bun:test";
import { evaluateCommand } from "../../../src/evaluate.ts";
import type { CommandInput } from "../../../src/evaluate.ts";
import { makeConfig, makeContext } from "../helpers.ts";

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

  test("allowedOwners: [] は全オーナーを拒否", () => {
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
    expect(result.permission.reason).toContain("allowedOwners");
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
