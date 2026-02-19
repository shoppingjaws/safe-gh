import fc from "fast-check";

const ownerArb = fc.stringMatching(/^[a-h]{1,8}$/);

const repoNameArb = fc.stringMatching(/^[a-h]{1,8}$/);

const repoArb = fc.tuple(ownerArb, repoNameArb).map(([o, n]) => `${o}/${n}`);

const labelArb = fc.stringMatching(/^[a-h][a-h\-]{0,7}$/);

const ruleNameArb = fc.stringMatching(/^[a-j0-3][a-j0-3 \-]{0,15}$/);

// Issue operations (context-free only for dry-run testing)
const issueOps = [
  "list",
  "view",
  "list:comments",
  "create",
] as const;

// PR operations (context-free only)
const prOps = [
  "list",
  "view",
  "diff",
  "checks",
  "list:comments",
  "create",
] as const;

// Search operations (all are context-free)
const searchOps = [
  "code",
  "issues",
  "prs",
  "repos",
  "commits",
] as const;

// Project operations (all are context-free)
const projectOps = [
  "list",
  "view",
  "field:list",
  "item:list",
  "create",
  "edit",
  "close",
  "delete",
  "item:add",
  "item:create",
  "item:edit",
  "item:delete",
  "item:archive",
  "field:create",
  "field:delete",
] as const;

// All issue operations (for config rules, which can include context-requiring ops)
const allIssueOps = [
  "list", "view", "list:comments", "create",
  "update", "close", "reopen", "delete",
  "comment", "comment:edit", "comment:delete",
] as const;

const allPrOps = [
  "list", "view", "diff", "checks", "list:comments", "create",
  "update", "close", "reopen", "merge", "review", "update-branch",
  "comment", "comment:edit", "comment:delete",
] as const;

const branchPatternArb = fc.stringMatching(/^[a-h\*\/]{1,8}$/);

const issueConditionArb = fc.record(
  {
    repos: fc.array(repoArb, { minLength: 1, maxLength: 2 }),
    owners: fc.array(ownerArb, { minLength: 1, maxLength: 2 }),
    labels: fc.record(
      {
        include: fc.array(labelArb, { minLength: 1, maxLength: 2 }),
        exclude: fc.array(labelArb, { minLength: 1, maxLength: 2 }),
      },
      { requiredKeys: [] }
    ),
  },
  { requiredKeys: [] }
);

const prConditionArb = fc.record(
  {
    repos: fc.array(repoArb, { minLength: 1, maxLength: 2 }),
    owners: fc.array(ownerArb, { minLength: 1, maxLength: 2 }),
    draft: fc.boolean(),
    baseBranch: fc.array(branchPatternArb, { minLength: 1, maxLength: 2 }),
    headBranch: fc.array(branchPatternArb, { minLength: 1, maxLength: 2 }),
  },
  { requiredKeys: [] }
);

const searchConditionArb = fc.record(
  {
    repos: fc.array(repoArb, { minLength: 1, maxLength: 2 }),
    owners: fc.array(ownerArb, { minLength: 1, maxLength: 2 }),
  },
  { requiredKeys: [] }
);

const projectConditionArb = fc.record(
  {
    owner: fc.array(ownerArb, { minLength: 1, maxLength: 2 }),
    projectNumbers: fc.array(fc.integer({ min: 1, max: 999 }), {
      minLength: 1,
      maxLength: 2,
    }),
  },
  { requiredKeys: [] }
);

const issueRuleArb = fc.record({
  name: ruleNameArb,
  operations: fc.subarray([...allIssueOps], { minLength: 1 }),
  condition: fc.option(issueConditionArb, { nil: undefined }),
});

const prRuleArb = fc.record({
  name: ruleNameArb,
  operations: fc.subarray([...allPrOps], { minLength: 1 }),
  condition: fc.option(prConditionArb, { nil: undefined }),
});

const searchRuleArb = fc.record({
  name: ruleNameArb,
  operations: fc.subarray([...searchOps], { minLength: 1 }),
  condition: fc.option(searchConditionArb, { nil: undefined }),
});

const projectRuleArb = fc.record({
  name: ruleNameArb,
  operations: fc.subarray([...projectOps], { minLength: 1 }),
  condition: fc.option(projectConditionArb, { nil: undefined }),
});

export const configArb = fc.record({
  allowedOwners: fc.option(
    fc.array(ownerArb, { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
  issueRules: fc.array(issueRuleArb, { minLength: 0, maxLength: 3 }),
  prRules: fc.array(prRuleArb, { minLength: 0, maxLength: 3 }),
  searchRules: fc.array(searchRuleArb, { minLength: 0, maxLength: 3 }),
  projectRules: fc.array(projectRuleArb, { minLength: 0, maxLength: 3 }),
  defaultPermission: fc.constantFrom("deny" as const, "read" as const),
});

export {
  ownerArb,
  repoArb,
  labelArb,
  issueOps,
  prOps,
  searchOps,
  projectOps,
};
