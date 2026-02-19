# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

safe-gh は AI エージェント向けのセキュリティ重視な GitHub CLI (`gh`) ラッパー。設定ベースのルールで操作権限を制御し、デフォルト拒否のポリシーで動作する。現在は issue edit / issue comment のみ実装済み（PR・Search・Project は未実装）。

## コマンド

```bash
bun install            # 依存関係インストール
bun run build          # Bun バンドル + tsc で dist/ に出力
bun run typecheck      # 型チェックのみ（emitなし）
```

ビルドは2段階: `bun build src/index.ts --outdir dist --target node --format esm --packages external` → `tsc -p tsconfig.build.json`（.d.ts生成）。

テストフレームワークは未導入。

## アーキテクチャ

**ミドルウェアパターン**: コマンド受付 → リポジトリ解決 → GitHub GraphQL で issue コンテキスト取得 → 設定ファイルのルール評価（先頭一致） → 許可なら `gh` CLI 実行、拒否なら JSON エラー返却。

```
src/
├── index.ts              # CLI エントリポイント (Commander.js)
├── types.ts              # Zod スキーマ & 型定義
├── config.ts             # ~/.config/safe-gh/config.jsonc の読み込み・キャッシュ
├── conditions.ts         # ルール条件評価ロジック (allowedOwners, issue条件)
├── gh.ts                 # gh CLI 実行, GraphQL, dry-run 制御
└── commands/
    ├── config.ts         # config init サブコマンド
    ├── issue-edit.ts     # issue edit コマンド
    ├── issue-comment.ts  # issue comment コマンド
    └── utils.ts          # JSON 出力 & エラーハンドリング
```

## 主要な設計パターン

- **デフォルト拒否**: ルールに一致しない操作はすべて拒否
- **先頭一致評価**: ルール配列を順に評価し、最初にマッチしたルールが結果を決定
- **全出力 JSON**: stdout はすべて構造化 JSON（AI エージェント向け）
- **Dry-run**: グローバルフラグで設定。`DryRunResult` 例外を throw し、`handleError()` で exit code 0 として処理
- **コマンド追加パターン**: `createXxxCommand()` ファクトリ関数で Commander コマンドを生成し、`index.ts` で登録

## 技術スタック

- **TypeScript** (strict, ESNext target, ESM)
- **Bun** でビルド、**Node.js >= 24** でランタイム実行
- **Commander.js** (CLI)、**Zod** (バリデーション)、**jsonc-parser** (設定ファイル)

## 設定ファイル

パス: `~/.config/safe-gh/config.jsonc`（JSONC形式）。`config.schema.json` で JSON Schema 定義あり。`config.sample.jsonc` にサンプル。
