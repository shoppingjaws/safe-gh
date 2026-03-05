# CLAUDE.md

## 概要

safe-gh: AIエージェント向けセキュリティ重視 `gh` CLIラッパー。設定ベースのルールで操作権限を制御、デフォルト拒否。

実装済み: `issue edit/comment/create/sub-issue/dependency`, `config init`。PR・Search・Project は未実装。

## コマンド

```bash
bun install          # 依存関係
bun run build        # bun build + tsc (dist/)
bun run typecheck    # 型チェックのみ
bun run test         # Docker内テスト (Dockerfile.test, mise経由)
```

## アーキテクチャ

2層構造: I/O層(`commands/`) + 純粋評価層(`evaluate.ts`+`conditions.ts`)

フロー: コマンド → `resolveRepo` → `fetchIssueContext`(GraphQL) → ルール評価(先頭一致) → 許可なら実行/拒否ならJSONエラー

`evaluateCommand`: `CommandInput` → `checkAllowedOwners` → `evaluateRules` → `EvaluateResult`。I/Oなし純粋関数。

sub-issue/dependency: `gh api graphql` でmutation実行。クロスリポ(`owner/repo#123`)対応。

```
src/
├── index.ts           # CLIエントリ (Commander.js)
├── types.ts           # Zodスキーマ & 型定義
├── config.ts          # ~/.config/safe-gh/config.jsonc 読み込み
├── conditions.ts      # ルール条件評価
├── gh.ts              # gh CLI実行, GraphQL, dry-run, resolveRepo, fetchIssueContext
└── commands/          # issue-edit/comment/create/sub-issue/dependency, config, issue-ref, utils

test/evaluate/         # bunユニットテスト
├── evaluate.ts        # テスト用純粋関数コマンド評価 (CommandInput→EvaluateResult)
├── helpers.ts
└── gh/                # allowed-owners/conditions/evaluate-edge/issue-ref/utils + issue/
```

## 設計パターン

- デフォルト拒否(`defaultPermission: "deny"`)、先頭一致評価
- 全出力JSON、Dry-run(`DryRunResult`例外→exit 0)
- コマンド追加: `createXxxCommand()`ファクトリ → `index.ts`登録
- 評価と実行の分離。テストは評価層中心
- body出力時マーカー付与(`<!-- safe-gh: ISO日時 -->`)

## ルール条件(IssueCondition) — すべてAND

`createdBy:"self"`, `assignee:"self"`, `labels.include`(OR)/`labels.exclude`, `repos`, `owners`, `titlePrefix`, `parentIssue`(number/assignee/labels/titlePrefix)

## Enforce(強制適用)

issueEdit/issueCreateで: `addLabels`/`removeLabels`, `addAssignees`/`removeAssignees`(`"self"`→selfUserId), `titlePrefix`(既存ならスキップ)

## 技術スタック

TypeScript(strict,ESM), Bun(ビルド/テスト/ランタイム), mise(bun1.3.3,node24), Commander.js, Zod, jsonc-parser

## 設定

`~/.config/safe-gh/config.jsonc`(JSONC)。`config.schema.json`でスキーマ定義。`safe-gh config init`で自動生成。
