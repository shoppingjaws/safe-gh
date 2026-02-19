import fc from "fast-check";
import { ownerArb, repoArb, issueOps, prOps, searchOps, projectOps } from "./config-gen.ts";

export interface CliCase {
  resource: string;
  operation: string;
  args: string[];
  expectedContext: Record<string, unknown>;
}

const issueNumberArb = fc.integer({ min: 1, max: 9999 });
const prNumberArb = fc.integer({ min: 1, max: 9999 });
const projectNumberArb = fc.integer({ min: 1, max: 999 });
const queryArb = fc.stringMatching(/^[a-j]{1,10}$/);

const branchNameArb = fc.stringMatching(/^[a-h]{1,8}$/);
const itemIdArb = fc.stringMatching(/^[a-h]{4,8}$/);

export const issueCliArb: fc.Arbitrary<CliCase> = fc
  .tuple(
    fc.constantFrom(...issueOps),
    fc.option(repoArb, { nil: undefined }),
    issueNumberArb
  )
  .map(([op, repo, num]) => {
    const args: string[] = ["issue"];
    const ctx: Record<string, unknown> = {};

    if (repo) ctx.repo = repo;

    switch (op) {
      case "list":
        args.push("list");
        break;
      case "view":
        args.push("view", String(num));
        ctx.issueNumber = num;
        break;
      case "list:comments":
        args.push("comments", String(num));
        ctx.issueNumber = num;
        break;
      case "create":
        args.push("create", "-t", "test-title");
        break;
    }

    if (repo) args.push("-R", repo);

    return { resource: "issue", operation: op, args, expectedContext: ctx };
  });

export const prCliArb: fc.Arbitrary<CliCase> = fc
  .tuple(
    fc.constantFrom(...prOps),
    fc.option(repoArb, { nil: undefined }),
    prNumberArb,
    fc.option(branchNameArb, { nil: undefined }),
    fc.option(branchNameArb, { nil: undefined }),
    fc.option(fc.boolean(), { nil: undefined })
  )
  .map(([op, repo, num, base, head, draft]) => {
    const args: string[] = ["pr"];
    const ctx: Record<string, unknown> = {};

    if (repo) ctx.repo = repo;

    switch (op) {
      case "list":
        args.push("list");
        break;
      case "view":
        args.push("view", String(num));
        ctx.prNumber = num;
        break;
      case "diff":
        args.push("diff", String(num));
        ctx.prNumber = num;
        break;
      case "checks":
        args.push("checks", String(num));
        ctx.prNumber = num;
        break;
      case "list:comments":
        args.push("comments", String(num));
        ctx.prNumber = num;
        break;
      case "create":
        args.push("create", "-t", "test-pr");
        if (base) {
          args.push("-B", base);
          ctx.baseBranch = base;
        }
        if (head) {
          args.push("-H", head);
          ctx.headBranch = head;
        }
        if (draft) {
          args.push("-d");
          ctx.draft = true;
        }
        break;
    }

    if (repo) args.push("-R", repo);

    return { resource: "pr", operation: op, args, expectedContext: ctx };
  });

export const searchCliArb: fc.Arbitrary<CliCase> = fc
  .tuple(
    fc.constantFrom(...searchOps),
    fc.option(repoArb, { nil: undefined }),
    queryArb
  )
  .map(([op, repo, query]) => {
    const args: string[] = ["search", op, query];
    const ctx: Record<string, unknown> = {};

    // repos search does not accept -R
    if (repo && op !== "repos") {
      args.push("-R", repo);
      ctx.repo = repo;
    }

    return { resource: "search", operation: op, args, expectedContext: ctx };
  });

export const projectCliArb: fc.Arbitrary<CliCase> = fc
  .tuple(
    fc.constantFrom(...projectOps),
    fc.option(ownerArb, { nil: undefined }),
    projectNumberArb,
    itemIdArb
  )
  .map(([op, owner, num, itemId]) => {
    const args: string[] = ["project"];
    const ctx: Record<string, unknown> = {};

    if (owner) ctx.projectOwner = owner;

    switch (op) {
      case "list":
        args.push("list");
        break;
      case "view":
        args.push("view", String(num));
        ctx.projectNumber = num;
        break;
      case "field:list":
        args.push("field-list", String(num));
        ctx.projectNumber = num;
        break;
      case "item:list":
        args.push("item-list", String(num));
        ctx.projectNumber = num;
        break;
      case "create":
        args.push("create", "-t", "test-project");
        break;
      case "edit":
        args.push("edit", String(num), "--title", "new-title");
        ctx.projectNumber = num;
        break;
      case "close":
        args.push("close", String(num));
        ctx.projectNumber = num;
        break;
      case "delete":
        args.push("delete", String(num));
        ctx.projectNumber = num;
        break;
      case "item:add":
        args.push("item-add", String(num), "--url", "https://github.com/o/r/issues/1");
        ctx.projectNumber = num;
        break;
      case "item:create":
        args.push("item-create", String(num), "-t", "draft-item");
        ctx.projectNumber = num;
        break;
      case "item:edit":
        args.push("item-edit", String(num), "--id", itemId, "--field-id", "FID1", "--text", "val");
        ctx.projectNumber = num;
        break;
      case "item:delete":
        args.push("item-delete", String(num), "--id", itemId);
        ctx.projectNumber = num;
        break;
      case "item:archive":
        args.push("item-archive", String(num), "--id", itemId);
        ctx.projectNumber = num;
        break;
      case "field:create":
        args.push("field-create", String(num), "--name", "fname", "--data-type", "TEXT");
        ctx.projectNumber = num;
        break;
      case "field:delete":
        args.push("field-delete", String(num), "--id", "FID1");
        ctx.projectNumber = num;
        break;
    }

    if (owner) args.push("--owner", owner);

    return { resource: "project", operation: op, args, expectedContext: ctx };
  });

export const allCliArb: fc.Arbitrary<CliCase> = fc.oneof(
  issueCliArb,
  prCliArb,
  searchCliArb,
  projectCliArb
);
