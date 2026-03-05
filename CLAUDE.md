# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

safe-gh は AI エージェント向けのセキュリティ重視な GitHub CLI (`gh`) ラッパー。設定ベースのルールで操作権限を制御し、デフォルト拒否のポリシーで動作する。

### 実装済みコマンド

- `safe-gh issue edit <number>` — issue の title / body / label / assignee を編集
- `safe-gh issue comment <number>` — issue にコメント追加
- `safe-gh issue create` — 新規 issue 作成
- `safe-gh issue sub-issue add/remove <number>` — sub-issue の追加・削除（GraphQL mutation）
- `safe-gh issue dependency add/remove <number>` — dependency (blocked-by) の追加・削除（GraphQL mutation）
- `safe-gh config init` — 設定ファイルのテンプレート生成

PR・Search・Project は未実装。

## コマンド

```bash
bun install            # 依存関係インストール
bun run build          # Bun バンドル + tsc で dist/ に出力
bun run typecheck      # 型チェックのみ（emitなし）
bun run test           # Docker でテスト実行（Dockerfile.test）
```

ビルドは2段階: `bun build src/index.ts --outdir dist --target node --format esm --packages external` → `tsc -p tsconfig.build.json`（.d.ts生成）。

テストは `bun test` を Docker コンテナ内で実行（`Dockerfile.test`: mise ベースイメージ → bun install → `mise exec -- bun test`）。

## アーキテクチャ

**2層構造**: I/O を伴うコマンドハンドラ層（`commands/`）と、純粋関数の評価層（`evaluate.ts` + `conditions.ts`）に分離。

**コマンド実行フロー**: コマンド受付 → リポジトリ解決（`resolveRepo`） → GitHub GraphQL で issue コンテキスト取得（`fetchIssueContext`） → 設定ファイルのルール評価（先頭一致） → 許可なら `gh` CLI 実行 or GraphQL mutation、拒否なら JSON エラー返却。

**評価フロー（`evaluateCommand`）**: `CommandInput`（discriminated union）を受け取り → `checkAllowedOwners` → `evaluateRules`（先頭一致） → `EvaluateResult`（permission + execution plan）を返す。I/O なし・副作用なしの純粋関数で、テスト容易。

sub-issue / dependency コマンドは `gh` CLI にネイティブコマンドがないため、`gh api graphql` 経由で GraphQL mutation を直接実行する。クロスリポ参照（`owner/repo#123` 形式）にも対応し、ターゲットリポジトリの owner も `allowedOwners` でチェックする。

```
src/
├── index.ts              # CLI エントリポイント (Commander.js)
├── types.ts              # Zod スキーマ & 型定義 (Config, IssueContext, PermissionCheckResult 等)
├── config.ts             # ~/.config/safe-gh/config.jsonc の読み込み・キャッシュ
├── conditions.ts         # ルール条件評価 (checkAllowedOwners, checkIssueCondition, evaluateRules)
├── evaluate.ts           # 純粋関数のコマンド評価 (evaluateCommand) — CommandInput → EvaluateResult
├── gh.ts                 # gh CLI 実行, GraphQL query/mutation, dry-run, resolveRepo, fetchIssueContext
└── commands/
    ├── config.ts             # config init サブコマンド
    ├── issue-edit.ts         # issue edit コマンド
    ├── issue-comment.ts      # issue comment コマンド
    ├── issue-create.ts       # issue create コマンド
    ├── issue-sub-issue.ts    # issue sub-issue add/remove コマンド
    ├── issue-dependency.ts   # issue dependency add/remove コマンド
    ├── issue-ref.ts          # クロスリポ参照パーサー (parseIssueRef: "owner/repo#123")
    └── utils.ts              # JSON 出力, appendMarker, buildEnforceArgs, handleError

test/evaluate/            # bun test によるユニットテスト
├── helpers.ts            # テストヘルパー（デフォルト Config/IssueContext 生成）
└── gh/
    ├── allowed-owners.test.ts
    ├── conditions.test.ts
    ├── conditions-edge.test.ts
    ├── evaluate-edge.test.ts
    ├── issue-ref.test.ts
    ├── utils.test.ts
    └── issue/
        ├── edit.test.ts
        ├── comment.test.ts
        ├── create.test.ts
        ├── sub-issue.test.ts
        └── dependency.test.ts
```

## 主要な設計パターン

- **デフォルト拒否**: ルールに一致しない操作はすべて拒否（`defaultPermission: "deny"` 固定）
- **先頭一致評価**: ルール配列を順に評価し、最初にマッチしたルールが結果を決定
- **全出力 JSON**: stdout はすべて構造化 JSON（AI エージェント向け）
- **Dry-run**: グローバル `--dry-run` フラグで有効化。`DryRunResult` 例外を throw し、`handleError()` で exit code 0 として処理
- **コマンド追加パターン**: `createXxxCommand()` ファクトリ関数で Commander コマンドを生成し、`index.ts` で登録
- **評価と実行の分離**: `evaluate.ts` は純粋関数（I/O なし）、`commands/` は I/O を伴う実行層。テストは主に評価層に対して実施
- **マーカー付与**: body 出力時に `<!-- safe-gh: ISO日時 -->` マーカーを付与（`appendMarker`）

## ルール条件（IssueCondition）

ルールの `condition` フィールドで以下の条件を組み合わせ可能（すべて AND 評価）:

| 条件 | 説明 |
|---|---|
| `createdBy: "self"` | issue 作成者が selfUserId と一致 |
| `assignee: "self"` | selfUserId が assignees に含まれる |
| `labels.include` | 指定ラベルのいずれかが存在（OR） |
| `labels.exclude` | 指定ラベルのいずれも存在しない |
| `repos` | 対象リポジトリが配列内に含まれる |
| `owners` | リポジトリ owner が配列内に含まれる |
| `titlePrefix` | issue タイトルが指定プレフィックスで始まる |
| `parentIssue` | 親 issue に対する条件（number, assignee, labels, titlePrefix） |

## Enforce（強制適用）

issueEdit / issueCreate ルールで `enforce` フィールドにより操作時に自動適用:

- `addLabels` / `removeLabels` — ラベルの強制追加・削除
- `addAssignees` / `removeAssignees` — assignee の強制追加・削除（`"self"` で selfUserId に解決）
- `titlePrefix` — タイトルにプレフィックスを強制付与（既に付いている場合はスキップ）

## 技術スタック

- **TypeScript** (strict, ESNext target, ESM)
- **Bun** でビルド・テスト、**Node.js >= 24** でランタイム実行
- **mise** でツールバージョン管理（bun 1.3.3, node 24）
- **Commander.js** (CLI)、**Zod** (バリデーション)、**jsonc-parser** (設定ファイル)

## 設定ファイル

パス: `~/.config/safe-gh/config.jsonc`（JSONC形式）。`config.schema.json` で JSON Schema 定義あり。`config.sample.jsonc` にサンプル。`safe-gh config init` で自動生成（`gh api user` で selfUserId を自動解決）。
