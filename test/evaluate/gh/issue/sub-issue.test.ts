import { describe, test, expect } from "bun:test";
import { evaluateCommand } from "../../evaluate.ts";
import { makeConfig, makeContext } from "../../helpers.ts";

describe("issue sub-issue", () => {
  test("add: GraphQL mutation と variables が正しい", () => {
    const config = makeConfig({
      issueSubIssue: [{ name: "allow-sub" }],
    });
    const result = evaluateCommand(config, {
      command: "issue sub-issue add",
      context: makeContext(),
      child: { repo: "myorg/myrepo", number: 99 },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.execution!.type).toBe("graphql");
    const exec = result.execution as {
      type: "graphql";
      mutation: string;
      variables: Record<string, string>;
      headers?: Record<string, string>;
    };
    expect(exec.mutation).toBe("addSubIssue");
    expect(exec.variables.issueId).toBe("<node-id:myorg/myrepo#42>");
    expect(exec.variables.subIssueId).toBe("<node-id:myorg/myrepo#99>");
    expect(exec.headers).toEqual({ "GraphQL-Features": "sub_issues" });
  });

  test("remove: GraphQL mutation と variables が正しい", () => {
    const config = makeConfig({
      issueSubIssue: [{ name: "allow-sub" }],
    });
    const result = evaluateCommand(config, {
      command: "issue sub-issue remove",
      context: makeContext(),
      child: { repo: "myorg/myrepo", number: 99 },
    });
    expect(result.execution!.type).toBe("graphql");
    const exec = result.execution as {
      type: "graphql";
      mutation: string;
      variables: Record<string, string>;
    };
    expect(exec.mutation).toBe("removeSubIssue");
    expect(exec.variables.issueId).toBe("<node-id:myorg/myrepo#42>");
    expect(exec.variables.subIssueId).toBe("<node-id:myorg/myrepo#99>");
  });

  test("クロスリポ: 許可外 owner で拒否", () => {
    const config = makeConfig({
      issueSubIssue: [{ name: "allow-sub" }],
    });
    const result = evaluateCommand(config, {
      command: "issue sub-issue add",
      context: makeContext(),
      child: { repo: "other-org/other-repo", number: 10 },
    });
    expect(result.permission.allowed).toBe(false);
    expect(result.permission.reason).toContain("allowedOwners");
    expect(result.execution).toBeNull();
  });

  test("クロスリポ: 許可 owner なら成功", () => {
    const config = makeConfig({
      allowedOwners: ["myorg", "partner-org"],
      issueSubIssue: [{ name: "allow-sub" }],
    });
    const result = evaluateCommand(config, {
      command: "issue sub-issue add",
      context: makeContext(),
      child: { repo: "partner-org/repo", number: 10 },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.execution!.type).toBe("graphql");
  });

  test("拒否: ルールなし", () => {
    const config = makeConfig();
    const result = evaluateCommand(config, {
      command: "issue sub-issue add",
      context: makeContext(),
      child: { repo: "myorg/myrepo", number: 99 },
    });
    expect(result.permission.allowed).toBe(false);
    expect(result.execution).toBeNull();
  });
});
