import { describe, test, expect, setDefaultTimeout } from "bun:test";
import fc from "fast-check";
import { createConfigDir, runSafeGh } from "./helpers/run-binary.ts";
import {
  configArb,
  ownerArb,
  repoArb,
  issueOps,
  prOps,
  searchOps,
  projectOps,
} from "./helpers/config-gen.ts";
import { allCliArb } from "./helpers/cli-gen.ts";

setDefaultTimeout(60_000);

const NUM_RUNS = 50;
const FC_OPTS: fc.Parameters<unknown> = { numRuns: NUM_RUNS, endOnFailure: true };

// ============================================================
// Structural properties
// ============================================================
describe("Structural properties", () => {
  test("dry-run always exits 0", async () => {
    await fc.assert(
      fc.asyncProperty(configArb, allCliArb, async (cfg, cli) => {
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const result = await runSafeGh(cli.args, homeDir);
          if (result.parsed) {
            expect(result.exitCode).toBe(0);
          }
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("output is valid dry-run JSON with required fields", async () => {
    await fc.assert(
      fc.asyncProperty(configArb, allCliArb, async (cfg, cli) => {
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const result = await runSafeGh(cli.args, homeDir);
          if (!result.parsed) return;
          expect(result.parsed.dryRun).toBe(true);
          expect(typeof result.parsed.resource).toBe("string");
          expect(typeof result.parsed.operation).toBe("string");
          expect(typeof result.parsed.allowed).toBe("boolean");
          expect(typeof result.parsed.reason).toBe("string");
          expect(result.parsed.context).toBeDefined();
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("resource/operation in output match CLI command", async () => {
    await fc.assert(
      fc.asyncProperty(configArb, allCliArb, async (cfg, cli) => {
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const result = await runSafeGh(cli.args, homeDir);
          if (!result.parsed) return;
          expect(result.parsed.resource).toBe(cli.resource);
          expect(result.parsed.operation).toBe(cli.operation);
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });
});

// ============================================================
// Security invariants
// ============================================================
describe("Security invariants", () => {
  test("empty rules + deny = ALL operations denied", async () => {
    await fc.assert(
      fc.asyncProperty(allCliArb, async (cli) => {
        const cfg = {
          issueRules: [],
          prRules: [],
          searchRules: [],
          projectRules: [],
          defaultPermission: "deny",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const result = await runSafeGh(cli.args, homeDir);
          if (!result.parsed) return;
          expect(result.parsed.allowed).toBe(false);
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("empty rules + read = only read operations allowed", async () => {
    const readOps = new Set([
      "list", "view", "list:comments", "diff", "checks", "field:list", "item:list",
    ]);
    await fc.assert(
      fc.asyncProperty(allCliArb, async (cli) => {
        const cfg = {
          issueRules: [],
          prRules: [],
          searchRules: [],
          projectRules: [],
          defaultPermission: "read",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const result = await runSafeGh(cli.args, homeDir);
          if (!result.parsed) return;
          if (readOps.has(cli.operation)) {
            expect(result.parsed.allowed).toBe(true);
          } else {
            expect(result.parsed.allowed).toBe(false);
          }
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("allowedOwners blocks non-matching owner via -R", async () => {
    await fc.assert(
      fc.asyncProperty(
        ownerArb,
        ownerArb,
        fc.constantFrom("issue" as const, "pr" as const),
        repoArb,
        async (allowedOwner, otherOwner, resource, repoName) => {
          fc.pre(allowedOwner !== otherOwner);
          const nonMatchingRepo = `${otherOwner}/${repoName.split("/")[1]}`;
          const cfg = {
            allowedOwners: [allowedOwner],
            issueRules: [{ name: "allow-all", operations: [...issueOps] }],
            prRules: [{ name: "allow-all", operations: [...prOps] }],
            searchRules: [],
            projectRules: [],
            defaultPermission: "deny",
          };
          const args =
            resource === "issue"
              ? ["issue", "list", "-R", nonMatchingRepo]
              : ["pr", "list", "-R", nonMatchingRepo];
          const { homeDir, cleanup } = createConfigDir(cfg);
          try {
            const result = await runSafeGh(args, homeDir);
            if (!result.parsed) return;
            expect(result.parsed.allowed).toBe(false);
            expect(result.parsed.reason).toContain("allowedOwners");
          } finally {
            cleanup();
          }
        }
      ),
      FC_OPTS
    );
  });

  test("allowedOwners configured => issue/pr without -R is denied", async () => {
    await fc.assert(
      fc.asyncProperty(
        ownerArb,
        fc.constantFrom("issue" as const, "pr" as const),
        async (allowedOwner, resource) => {
          const cfg = {
            allowedOwners: [allowedOwner],
            issueRules: [{ name: "allow-all", operations: [...issueOps] }],
            prRules: [{ name: "allow-all", operations: [...prOps] }],
            searchRules: [],
            projectRules: [],
            defaultPermission: "deny",
          };
          const args = resource === "issue" ? ["issue", "list"] : ["pr", "list"];
          const { homeDir, cleanup } = createConfigDir(cfg);
          try {
            const result = await runSafeGh(args, homeDir);
            if (!result.parsed) return;
            expect(result.parsed.allowed).toBe(false);
            expect(result.parsed.reason).toContain("-R owner/repo");
          } finally {
            cleanup();
          }
        }
      ),
      FC_OPTS
    );
  });

  test("allowedOwners + matching owner = rule evaluation proceeds", async () => {
    await fc.assert(
      fc.asyncProperty(ownerArb, repoArb, async (owner, repoSuffix) => {
        const repo = `${owner}/${repoSuffix.split("/")[1]}`;
        const cfg = {
          allowedOwners: [owner],
          issueRules: [{ name: "allow-list", operations: ["list"] }],
          prRules: [],
          searchRules: [],
          projectRules: [],
          defaultPermission: "deny",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const result = await runSafeGh(["issue", "list", "-R", repo], homeDir);
          if (!result.parsed) return;
          expect(result.parsed.allowed).toBe(true);
          expect(result.parsed.ruleName).toBe("allow-list");
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });
});

// ============================================================
// Rule matching properties
// ============================================================
describe("Rule matching properties", () => {
  test("unconditional rule always allows its operation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { resource: "issue", ops: issueOps, cmd: ["issue", "list"], op: "list" },
          { resource: "pr", ops: prOps, cmd: ["pr", "list"], op: "list" },
          { resource: "search", ops: searchOps, cmd: ["search", "code", "q"], op: "code" },
          { resource: "project", ops: projectOps, cmd: ["project", "list"], op: "list" },
        ),
        fc.stringMatching(/^[a-h]{1,8}$/),
        async (target, ruleName) => {
          const cfg = {
            issueRules: target.resource === "issue"
              ? [{ name: ruleName, operations: [target.op] }] : [],
            prRules: target.resource === "pr"
              ? [{ name: ruleName, operations: [target.op] }] : [],
            searchRules: target.resource === "search"
              ? [{ name: ruleName, operations: [target.op] }] : [],
            projectRules: target.resource === "project"
              ? [{ name: ruleName, operations: [target.op] }] : [],
            defaultPermission: "deny",
          };
          const { homeDir, cleanup } = createConfigDir(cfg);
          try {
            const result = await runSafeGh(target.cmd, homeDir);
            if (!result.parsed) return;
            expect(result.parsed.allowed).toBe(true);
            expect(result.parsed.ruleName).toBe(ruleName);
          } finally {
            cleanup();
          }
        }
      ),
      FC_OPTS
    );
  });

  test("first matching rule wins", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-h]{2,8}$/),
        fc.stringMatching(/^[a-h]{2,8}$/),
        async (name1, name2) => {
          fc.pre(name1 !== name2);
          const cfg = {
            issueRules: [
              { name: name1, operations: ["list"] },
              { name: name2, operations: ["list"] },
            ],
            prRules: [],
            searchRules: [],
            projectRules: [],
            defaultPermission: "deny",
          };
          const { homeDir, cleanup } = createConfigDir(cfg);
          try {
            const result = await runSafeGh(["issue", "list"], homeDir);
            if (!result.parsed) return;
            expect(result.parsed.allowed).toBe(true);
            expect(result.parsed.ruleName).toBe(name1);
          } finally {
            cleanup();
          }
        }
      ),
      FC_OPTS
    );
  });

  test("operation mismatch rule is skipped", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-h]{2,8}$/),
        fc.stringMatching(/^[a-h]{2,8}$/),
        async (name1, name2) => {
          fc.pre(name1 !== name2);
          const cfg = {
            issueRules: [
              { name: name1, operations: ["create"] },
              { name: name2, operations: ["list"] },
            ],
            prRules: [],
            searchRules: [],
            projectRules: [],
            defaultPermission: "deny",
          };
          const { homeDir, cleanup } = createConfigDir(cfg);
          try {
            const result = await runSafeGh(["issue", "list"], homeDir);
            if (!result.parsed) return;
            expect(result.parsed.allowed).toBe(true);
            expect(result.parsed.ruleName).toBe(name2);
          } finally {
            cleanup();
          }
        }
      ),
      FC_OPTS
    );
  });

  test("operation specificity: rule for op X does not affect op Y", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-h]{2,8}$/),
        async (ruleName) => {
          // Rule only allows "create", test "list"
          const cfg = {
            issueRules: [{ name: ruleName, operations: ["create"] }],
            prRules: [],
            searchRules: [],
            projectRules: [],
            defaultPermission: "deny",
          };
          const { homeDir, cleanup } = createConfigDir(cfg);
          try {
            const result = await runSafeGh(["issue", "list"], homeDir);
            if (!result.parsed) return;
            expect(result.parsed.allowed).toBe(false);
          } finally {
            cleanup();
          }
        }
      ),
      FC_OPTS
    );
  });
});

// ============================================================
// Condition effectiveness
// ============================================================
describe("Condition effectiveness", () => {
  test("condition.repos allows matching repo, denies non-matching", async () => {
    await fc.assert(
      fc.asyncProperty(repoArb, repoArb, async (matchRepo, otherRepo) => {
        fc.pre(matchRepo !== otherRepo);
        const cfg = {
          issueRules: [{
            name: "repo-scoped",
            operations: ["list"],
            condition: { repos: [matchRepo] },
          }],
          prRules: [],
          searchRules: [],
          projectRules: [],
          defaultPermission: "deny",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          // Matching repo → allowed
          const r1 = await runSafeGh(["issue", "list", "-R", matchRepo], homeDir);
          if (r1.parsed) {
            expect(r1.parsed.allowed).toBe(true);
            expect(r1.parsed.ruleName).toBe("repo-scoped");
          }
          // Non-matching repo → denied
          const r2 = await runSafeGh(["issue", "list", "-R", otherRepo], homeDir);
          if (r2.parsed) {
            expect(r2.parsed.allowed).toBe(false);
          }
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("condition.owners allows matching owner, denies non-matching", async () => {
    await fc.assert(
      fc.asyncProperty(ownerArb, ownerArb, repoArb, async (matchOwner, otherOwner, repoSuffix) => {
        fc.pre(matchOwner !== otherOwner);
        const matchingRepo = `${matchOwner}/${repoSuffix.split("/")[1]}`;
        const nonMatchingRepo = `${otherOwner}/${repoSuffix.split("/")[1]}`;
        const cfg = {
          issueRules: [{
            name: "owner-scoped",
            operations: ["list"],
            condition: { owners: [matchOwner] },
          }],
          prRules: [],
          searchRules: [],
          projectRules: [],
          defaultPermission: "deny",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const r1 = await runSafeGh(["issue", "list", "-R", matchingRepo], homeDir);
          if (r1.parsed) {
            expect(r1.parsed.allowed).toBe(true);
            expect(r1.parsed.ruleName).toBe("owner-scoped");
          }
          const r2 = await runSafeGh(["issue", "list", "-R", nonMatchingRepo], homeDir);
          if (r2.parsed) {
            expect(r2.parsed.allowed).toBe(false);
          }
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("condition.owners denies when no -R specified", async () => {
    await fc.assert(
      fc.asyncProperty(ownerArb, async (owner) => {
        const cfg = {
          issueRules: [{
            name: "owner-scoped",
            operations: ["list"],
            condition: { owners: [owner] },
          }],
          prRules: [],
          searchRules: [],
          projectRules: [],
          defaultPermission: "deny",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const result = await runSafeGh(["issue", "list"], homeDir);
          if (!result.parsed) return;
          expect(result.parsed.allowed).toBe(false);
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("project condition.owner allows matching, denies non-matching", async () => {
    await fc.assert(
      fc.asyncProperty(ownerArb, ownerArb, async (matchOwner, otherOwner) => {
        fc.pre(matchOwner !== otherOwner);
        const cfg = {
          issueRules: [],
          prRules: [],
          searchRules: [],
          projectRules: [{
            name: "owner-project",
            operations: ["list"],
            condition: { owner: [matchOwner] },
          }],
          defaultPermission: "deny",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const r1 = await runSafeGh(["project", "list", "--owner", matchOwner], homeDir);
          if (r1.parsed) {
            expect(r1.parsed.allowed).toBe(true);
            expect(r1.parsed.ruleName).toBe("owner-project");
          }
          const r2 = await runSafeGh(["project", "list", "--owner", otherOwner], homeDir);
          if (r2.parsed) {
            expect(r2.parsed.allowed).toBe(false);
          }
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("search condition.repos allows matching, denies non-matching", async () => {
    await fc.assert(
      fc.asyncProperty(repoArb, repoArb, async (matchRepo, otherRepo) => {
        fc.pre(matchRepo !== otherRepo);
        const cfg = {
          issueRules: [],
          prRules: [],
          searchRules: [{
            name: "repo-search",
            operations: ["code"],
            condition: { repos: [matchRepo] },
          }],
          projectRules: [],
          defaultPermission: "deny",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const r1 = await runSafeGh(["search", "code", "query", "-R", matchRepo], homeDir);
          if (r1.parsed) {
            expect(r1.parsed.allowed).toBe(true);
          }
          const r2 = await runSafeGh(["search", "code", "query", "-R", otherRepo], homeDir);
          if (r2.parsed) {
            expect(r2.parsed.allowed).toBe(false);
          }
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });
});

// ============================================================
// Monotonicity
// ============================================================
describe("Monotonicity", () => {
  test("adding a matching rule to deny config turns deny into allow", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-h]{2,8}$/),
        async (ruleName) => {
          const cfgDeny = {
            issueRules: [],
            prRules: [],
            searchRules: [],
            projectRules: [],
            defaultPermission: "deny",
          };
          const cfgWithRule = {
            ...cfgDeny,
            issueRules: [{ name: ruleName, operations: ["list"] }],
          };
          const { homeDir: h1, cleanup: c1 } = createConfigDir(cfgDeny);
          const { homeDir: h2, cleanup: c2 } = createConfigDir(cfgWithRule);
          try {
            const r1 = await runSafeGh(["issue", "list"], h1);
            const r2 = await runSafeGh(["issue", "list"], h2);
            if (!r1.parsed || !r2.parsed) return;
            expect(r1.parsed.allowed).toBe(false);
            expect(r2.parsed.allowed).toBe(true);
          } finally {
            c1();
            c2();
          }
        }
      ),
      FC_OPTS
    );
  });

  test("adding unrelated rules does not revoke existing permission", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-h]{2,8}$/),
        fc.stringMatching(/^[a-h]{2,8}$/),
        async (name1, name2) => {
          fc.pre(name1 !== name2);
          const cfgBase = {
            issueRules: [{ name: name1, operations: ["list"] }],
            prRules: [],
            searchRules: [],
            projectRules: [],
            defaultPermission: "deny",
          };
          const cfgExtended = {
            ...cfgBase,
            // Add PR rule that has nothing to do with issue list
            prRules: [{ name: name2, operations: ["create"] }],
          };
          const { homeDir: h1, cleanup: c1 } = createConfigDir(cfgBase);
          const { homeDir: h2, cleanup: c2 } = createConfigDir(cfgExtended);
          try {
            const r1 = await runSafeGh(["issue", "list"], h1);
            const r2 = await runSafeGh(["issue", "list"], h2);
            if (!r1.parsed || !r2.parsed) return;
            // Both should be allowed — adding PR rules doesn't affect issue
            expect(r1.parsed.allowed).toBe(true);
            expect(r2.parsed.allowed).toBe(true);
            expect(r1.parsed.ruleName).toBe(r2.parsed.ruleName);
          } finally {
            c1();
            c2();
          }
        }
      ),
      FC_OPTS
    );
  });
});

// ============================================================
// Context propagation
// ============================================================
describe("Context propagation", () => {
  test("-R propagates to context.repo", async () => {
    await fc.assert(
      fc.asyncProperty(repoArb, async (repo) => {
        const cfg = {
          issueRules: [],
          prRules: [],
          searchRules: [],
          projectRules: [],
          defaultPermission: "deny",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const result = await runSafeGh(["issue", "list", "-R", repo], homeDir);
          if (!result.parsed) return;
          expect(result.parsed.context.repo).toBe(repo);
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("no -R => context.repo is undefined", async () => {
    const cfg = {
      issueRules: [],
      prRules: [],
      searchRules: [],
      projectRules: [],
      defaultPermission: "deny",
    };
    const { homeDir, cleanup } = createConfigDir(cfg);
    try {
      const result = await runSafeGh(["issue", "list"], homeDir);
      if (!result.parsed) return;
      expect(result.parsed.context.repo).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  test("--owner propagates to context.projectOwner", async () => {
    await fc.assert(
      fc.asyncProperty(ownerArb, async (owner) => {
        const cfg = {
          issueRules: [],
          prRules: [],
          searchRules: [],
          projectRules: [],
          defaultPermission: "deny",
        };
        const { homeDir, cleanup } = createConfigDir(cfg);
        try {
          const result = await runSafeGh(
            ["project", "list", "--owner", owner],
            homeDir
          );
          if (!result.parsed) return;
          expect(result.parsed.context.projectOwner).toBe(owner);
        } finally {
          cleanup();
        }
      }),
      FC_OPTS
    );
  });

  test("PR create: --base, --head, --draft propagate to context", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-h]{1,8}$/),
        fc.stringMatching(/^[a-h]{1,8}$/),
        fc.boolean(),
        async (base, head, draft) => {
          const cfg = {
            issueRules: [],
            prRules: [{ name: "allow-create", operations: ["create"] }],
            searchRules: [],
            projectRules: [],
            defaultPermission: "deny",
          };
          const args = ["pr", "create", "-t", "test", "-B", base, "-H", head];
          if (draft) args.push("-d");
          const { homeDir, cleanup } = createConfigDir(cfg);
          try {
            const result = await runSafeGh(args, homeDir);
            if (!result.parsed) return;
            expect(result.parsed.context.baseBranch).toBe(base);
            expect(result.parsed.context.headBranch).toBe(head);
            if (draft) {
              expect(result.parsed.context.draft).toBe(true);
            }
          } finally {
            cleanup();
          }
        }
      ),
      FC_OPTS
    );
  });
});

// ============================================================
// Edge cases
// ============================================================
describe("Edge cases", () => {
  test("missing config file => exit 1", async () => {
    const { mkdirSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { randomUUID } = await import("node:crypto");

    const homeDir = join(tmpdir(), `safe-gh-test-empty-${randomUUID()}`);
    mkdirSync(homeDir, { recursive: true });
    try {
      const result = await runSafeGh(["issue", "list"], homeDir);
      expect(result.exitCode).toBe(1);
    } finally {
      const { rmSync } = await import("node:fs");
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  test("invalid config schema => exit 1", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { randomUUID } = await import("node:crypto");

    const homeDir = join(tmpdir(), `safe-gh-test-invalid-${randomUUID()}`);
    const configDir = join(homeDir, ".config", "safe-gh");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.jsonc"),
      '{"issueRules": 12345, "defaultPermission": "invalid"}',
      "utf-8"
    );
    try {
      const result = await runSafeGh(["issue", "list"], homeDir);
      expect(result.exitCode).toBe(1);
    } finally {
      const { rmSync } = await import("node:fs");
      rmSync(homeDir, { recursive: true, force: true });
    }
  });
});
