# Known Bugs

## CRITICAL

### 1. `fetchIssueNodeId` で issue null チェックが欠落

**ファイル:** `src/gh.ts:219`

```typescript
return response.data.repository.issue.id; // issue が null の可能性
```

`response.errors` チェック (212-217 行目) は存在するが、GraphQL エラーなしで `issue: null` が返るケース（存在しない issue）に対応できていない。

## HIGH

### 2. `handleError` のエラー判定順序で `isGhCliError` が到達不能になるケースがある

**ファイル:** `src/commands/utils.ts:70-92`

```typescript
if (isErrorResponse(error)) {   // ← ① "error" と "code" プロパティ
  ...
}
if (error instanceof Error) {   // ← ② Error インスタンス
  ...
}
if (isGhCliError(error)) {      // ← ③ ここに到達できない場合がある
  ...
}
```

`execGh` が throw する `GhCliError` は `{ stderr, exitCode, code }` で、`error` プロパティがないため通常は正しく動作する。しかし `Bun.spawn` が `gh` を見つけられず ENOENT を throw した場合は②で捕捉され、エラーメッセージが不明瞭なものになる。

### 3. `issue-create` で `createdBy: "self"` / `assignee: "self"` 条件が常に失敗

**ファイル:** `src/commands/issue-create.ts:27-38`

```typescript
const context: IssueContext = {
  repo,
  issueNumber: 0,
  issueTitle: options.title,
  issueAuthor: "",    // ← 常に空文字
  labels: [],         // ← 常に空配列
  assignees: [],      // ← 常に空配列
  parentIssueNumber: null,
  ...
};
```

issue 作成時はまだ issue が存在しないため、`issueAuthor` は空文字、`assignees` は空配列。以下の条件が `issueCreate` ルールで使われると常にマッチ失敗し、暗黙的に permission denied になる:

- `createdBy: "self"` → `conditions.ts:47-48` で `context.issueAuthor !== selfUserId` → `"" !== "user-id"` → false
- `assignee: "self"` → `conditions.ts:52-54` で `context.assignees.includes(selfUserId)` → `[].includes(...)` → false

設定ミスに対する警告やドキュメントがない。
