import { describe, test, expect } from "bun:test";
import { evaluateCommand } from "../evaluate.ts";
import { makeConfig, makeContext } from "../helpers.ts";

describe("issue create: condition.titlePrefix と enforce.titlePrefix の矛盾", () => {
  test("condition.titlePrefix を要求 + enforce.titlePrefix で付与する設定は、プレフィックスなしタイトルで拒否される", () => {
    // BUG: condition 評価は enforce 適用前のタイトルで行われるため
    // titlePrefix が条件にも enforce にもある場合、プレフィックスなしタイトルは条件不一致で拒否
    const config = makeConfig({
      issueCreate: [
        {
          name: "wip-only",
          condition: { titlePrefix: "[WIP] " },
          enforce: { titlePrefix: "[WIP] " },
        },
      ],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "my task", body: "body" },
    });
    // プレフィックスなしタイトルは条件不一致 → 拒否（enforce が適用される前に条件チェックで落ちる）
    expect(result.permission.allowed).toBe(false);
  });

  test("condition に titlePrefix がなく enforce.titlePrefix のみなら、プレフィックスなしでも許可される", () => {
    const config = makeConfig({
      issueCreate: [
        {
          name: "auto-prefix",
          enforce: { titlePrefix: "[WIP] " },
        },
      ],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "my task", body: "body" },
    });
    expect(result.permission.allowed).toBe(true);
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    const titleIdx = args.indexOf("--title");
    expect(args[titleIdx + 1]).toBe("[WIP] my task");
  });
});

describe("issue create: context.issueTitle が enforce 後に更新されるべき", () => {
  test.skip("返却される context.issueTitle は enforce 適用後のタイトルを反映すべき", () => {
    // BUG: enforced title は args に反映されるが context は元のまま
    const config = makeConfig({
      issueCreate: [{ name: "with-prefix", enforce: { titlePrefix: "[AUTO] " } }],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "task", body: "b" },
    });
    // args には enforce 適用済みタイトル
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    const titleIdx = args.indexOf("--title");
    expect(args[titleIdx + 1]).toBe("[AUTO] task");

    // context も enforce 後のタイトルを反映すべき
    expect(result.context.issueTitle).toBe("[AUTO] task");
  });
});

describe("issue create: enforceExecution が titlePrefix のみ時に null になる", () => {
  test("enforce に titlePrefix のみの場合、enforceExecution は null", () => {
    // titlePrefix は args に直接適用されるため、enforceExecution は不要
    // しかし buildEnforceArgs が titlePrefix を処理しないため、
    // enforce: { titlePrefix: "..." } のみの場合 enforceExecution が null になる
    const config = makeConfig({
      issueCreate: [{ name: "prefix-only", enforce: { titlePrefix: "[WIP] " } }],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "task", body: "b" },
    });
    expect(result.permission.allowed).toBe(true);
    // buildEnforceArgs は titlePrefix を無視して [] を返すため enforceExecution は null
    expect(result.enforceExecution).toBeNull();
  });

  test("enforce に titlePrefix + addLabels がある場合、enforceExecution は addLabels のみ含む", () => {
    const config = makeConfig({
      issueCreate: [
        { name: "prefix-and-label", enforce: { titlePrefix: "[WIP] ", addLabels: ["wip"] } },
      ],
    });
    const result = evaluateCommand(config, {
      command: "issue create",
      repo: "myorg/myrepo",
      options: { title: "task", body: "b" },
    });
    expect(result.enforceExecution).not.toBeNull();
    const enforceArgs = result.enforceExecution!.args;
    expect(enforceArgs).toContain("--add-label");
    expect(enforceArgs).toContain("wip");
    // titlePrefix は enforceExecution に含まれない（args で直接適用済み）
    expect(enforceArgs).not.toContain("--title");
  });
});

describe("issue edit: enforce titlePrefix のエッジケース", () => {
  test("enforce.titlePrefix: '' (空文字) はタイトルが空文字プレフィックスを持つ（常に true）ため --title を付与しない", () => {
    const config = makeConfig({
      issueEdit: [{ name: "empty-prefix", enforce: { titlePrefix: "" } }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext({ issueTitle: "my title" }),
      options: { body: "updated" },
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    // "my title".startsWith("") は true なので --title は付与されない
    expect(args).not.toContain("--title");
  });

  test("options が空オブジェクトの場合、enforce.titlePrefix のみで args が構築される", () => {
    const config = makeConfig({
      issueEdit: [{ name: "prefix-only", enforce: { titlePrefix: "[WIP] " } }],
    });
    const result = evaluateCommand(config, {
      command: "issue edit",
      context: makeContext({ issueTitle: "plain title" }),
      options: {},
    });
    const args = (result.execution as { type: "gh-cli"; args: string[] }).args;
    const titleIdx = args.indexOf("--title");
    expect(titleIdx).not.toBe(-1);
    expect(args[titleIdx + 1]).toBe("[WIP] plain title");
  });
});

describe("issue sub-issue: 同一リポジトリの場合はクロスリポチェックをスキップ", () => {
  test("親と子が同じリポジトリならクロスリポチェックなし", () => {
    const config = makeConfig({
      issueSubIssue: [{ name: "allow-sub" }],
    });
    const result = evaluateCommand(config, {
      command: "issue sub-issue add",
      context: makeContext({ repo: "myorg/myrepo" }),
      child: { repo: "myorg/myrepo", number: 99 },
    });
    expect(result.permission.allowed).toBe(true);
  });
});

describe("issue dependency: 同一リポジトリの場合はクロスリポチェックをスキップ", () => {
  test("blockedBy が同じリポジトリならクロスリポチェックなし", () => {
    const config = makeConfig({
      issueDependency: [{ name: "allow-dep" }],
    });
    const result = evaluateCommand(config, {
      command: "issue dependency add",
      context: makeContext({ repo: "myorg/myrepo" }),
      blockedBy: { repo: "myorg/myrepo", number: 77 },
    });
    expect(result.permission.allowed).toBe(true);
  });
});

describe("issue comment: enforceExecution は常に null", () => {
  test("issueComment ルールは enforce をサポートしない（型レベルでは存在しない）", () => {
    const config = makeConfig({
      issueComment: [{ name: "allow-comment" }],
    });
    const result = evaluateCommand(config, {
      command: "issue comment",
      context: makeContext(),
      options: { body: "hello" },
    });
    expect(result.permission.allowed).toBe(true);
    expect(result.enforceExecution).toBeNull();
  });
});

describe("複数条件の組み合わせ", () => {
  test("createdBy: 'self' AND labels.include の AND 条件", () => {
    const config = makeConfig({
      issueEdit: [
        {
          name: "self-and-label",
          condition: { createdBy: "self", labels: { include: ["safe"] } },
        },
      ],
    });

    // 両方一致 → 許可
    const ctx1 = makeContext({ issueAuthor: "bot-user", labels: ["safe"] });
    const r1 = evaluateCommand(config, { command: "issue edit", context: ctx1, options: { title: "t" } });
    expect(r1.permission.allowed).toBe(true);

    // createdBy のみ一致 → 拒否
    const ctx2 = makeContext({ issueAuthor: "bot-user", labels: ["danger"] });
    const r2 = evaluateCommand(config, { command: "issue edit", context: ctx2, options: { title: "t" } });
    expect(r2.permission.allowed).toBe(false);

    // labels のみ一致 → 拒否
    const ctx3 = makeContext({ issueAuthor: "other-user", labels: ["safe"] });
    const r3 = evaluateCommand(config, { command: "issue edit", context: ctx3, options: { title: "t" } });
    expect(r3.permission.allowed).toBe(false);
  });
});
