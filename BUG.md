# Known Bugs

## CRITICAL

### 1. `fetchIssueContext` で issue null チェックと GraphQL エラーチェックが欠落

**ファイル:** `src/gh.ts:151-152`

```typescript
const response = JSON.parse(result) as GraphQLIssueResponse;
const issue = response.data.repository.issue; // null の可能性あり
```

存在しない issue 番号を指定した場合、GitHub GraphQL API は `{ "data": { "repository": { "issue": null } } }` を exit code 0 で返す。`issue` が null のとき 157 行目 `issue.title` でランタイムクラッシュする。

さらに `fetchIssueNodeId` (212 行目) では `response.errors` チェックがあるのに、`fetchIssueContext` にはない。

### 2. `fetchIssueNodeId` で issue null チェックが欠落

**ファイル:** `src/gh.ts:219`

```typescript
return response.data.repository.issue.id; // issue が null の可能性
```

`response.errors` チェック (212-217 行目) は存在するが、GraphQL エラーなしで `issue: null` が返るケース（存在しない issue）に対応できていない。

### 3. `GraphQLIssueResponse` で `author` が null のケース未対応

**ファイル:** `src/gh.ts:113, 158`

```typescript
// 型定義: author は non-nullable
author: { login: string };

// 使用箇所
issueAuthor: issue.author.login, // author が null ならクラッシュ
```

GitHub では削除済みユーザーやゴーストアカウントの場合、`author` が `null` になる。型定義と実際の API レスポンスが不一致。

## HIGH

### 4. `handleError` のエラー判定順序で `isGhCliError` が到達不能になるケースがある

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

### 5. `issue-create` で `createdBy: "self"` / `assignee: "self"` 条件が常に失敗

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
