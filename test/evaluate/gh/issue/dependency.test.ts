import { describe, test, expect } from "bun:test";
import { evaluateCommand } from "../../../../src/evaluate.ts";
import { makeConfig, makeContext } from "../../helpers.ts";

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
