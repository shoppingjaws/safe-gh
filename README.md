# safe-gh

A security-focused GitHub CLI (`gh`) wrapper that provides granular permission control for AI agents and automated systems.

## Why safe-gh?

When AI agents interact with GitHub, they often need access to the `gh` CLI — but unrestricted access is risky. An agent could accidentally close the wrong issue, merge an unapproved PR, or delete a project.

**safe-gh** sits between the AI agent and `gh`, enforcing configurable rules that control exactly which operations are allowed and under what conditions. Every command is validated against your permission rules before execution.

## Features

- **Rule-based permission system** — Define allowed operations per resource type (issues, PRs, search, projects)
- **Granular conditions** — Restrict by labels, branches, authors, assignees, repository owners, draft status, review state, and more
- **First-match evaluation** — Rules are evaluated in order; the first matching rule determines the outcome
- **Dry-run mode** — Check if a command would be allowed without executing it
- **Structured JSON output** — All responses are JSON for easy parsing by AI agents
- **Default deny** — Unconfigured operations are denied by default

## Prerequisites

- [Node.js](https://nodejs.org/) >= 24
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated
- [Bun](https://bun.sh/) (for building from source)

## Installation

```bash
npm install -g safe-gh
```

### From source

```bash
git clone https://github.com/shoppingjaws/safe-gh.git
cd safe-gh
bun install
bun run build
npm link
```

## Quick Start

1. Initialize a configuration file:

```bash
safe-gh config init
```

This creates `~/.config/safe-gh/config.jsonc` with a sample configuration.

2. Edit the config to match your needs (see [Configuration](#configuration)).

3. Use `safe-gh` in place of `gh`:

```bash
# These work just like `gh` but with permission checks
safe-gh issue list -R owner/repo
safe-gh pr view 42 -R owner/repo
safe-gh pr merge 42 -R owner/repo    # Only if your rules allow it
```

## Configuration

Configuration is stored in `~/.config/safe-gh/config.jsonc` (JSON with comments).

### Config Management

```bash
safe-gh config init       # Create config from template
safe-gh config validate   # Validate current config
safe-gh config show       # Display current config
safe-gh config path       # Show config file path
```

### Schema

The config file supports JSON Schema validation. Add this to the top of your config:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/shoppingjaws/safe-gh/refs/heads/main/config.schema.json"
}
```

### Structure

```jsonc
{
  "issueRules": [],          // Rules for issue operations
  "prRules": [],             // Rules for PR operations
  "searchRules": [],         // Rules for search operations
  "projectRules": [],        // Rules for project operations
  "selfUserId": "",          // Your GitHub login (for "self" conditions)
  "defaultPermission": "deny" // "deny" or "read"
}
```

Each rule has the following shape:

```jsonc
{
  "name": "Human-readable rule name",
  "operations": ["list", "view"],  // Allowed operations
  "condition": { /* optional conditions */ }
}
```

### Operations

| Resource | Operations |
|----------|-----------|
| Issue | `list`, `view`, `list:comments`, `create`, `update`, `close`, `reopen`, `delete`, `comment`, `comment:edit`, `comment:delete` |
| PR | `list`, `view`, `diff`, `checks`, `list:comments`, `create`, `update`, `close`, `reopen`, `merge`, `review`, `update-branch`, `comment`, `comment:edit`, `comment:delete` |
| Search | `code`, `issues`, `prs`, `repos`, `commits` |
| Project | `list`, `view`, `field:list`, `item:list`, `create`, `edit`, `close`, `delete`, `item:add`, `item:create`, `item:edit`, `item:delete`, `item:archive`, `field:create`, `field:delete` |

### Conditions

| Condition | Applies to | Description |
|-----------|-----------|-------------|
| `createdBy: "self"` | Issue, PR | Only items created by `selfUserId` |
| `assignee: "self"` | Issue, PR | Only items assigned to `selfUserId` |
| `labels` | Issue, PR | Filter by label `include`/`exclude` lists |
| `repos` | Issue, PR, Search | Restrict to specific repositories (`owner/repo`) |
| `owners` | Issue, PR, Search | Restrict to repositories owned by specific users/orgs |
| `draft` | PR | Match draft status (`true`/`false`) |
| `baseBranch` | PR | Target branch patterns (supports `*` wildcards) |
| `headBranch` | PR | Source branch patterns (supports `*` wildcards) |
| `reviewDecision` | PR | `APPROVED`, `CHANGES_REQUESTED`, or `REVIEW_REQUIRED` |
| `owner` | Project | Restrict to specific project owners |
| `projectNumbers` | Project | Restrict to specific project numbers |

When a rule has multiple conditions, **all** conditions must be satisfied (AND logic).

### Configuration Examples

**Allow read-only access to org repos, deny everything else:**

```jsonc
{
  "issueRules": [
    {
      "name": "Read org issues",
      "operations": ["list", "view", "list:comments"],
      "condition": { "owners": ["my-org"] }
    }
  ],
  "prRules": [
    {
      "name": "Read org PRs",
      "operations": ["list", "view", "diff", "checks", "list:comments"],
      "condition": { "owners": ["my-org"] }
    }
  ],
  "defaultPermission": "deny"
}
```

**Allow merging only approved, non-draft PRs targeting `develop`:**

```jsonc
{
  "prRules": [
    {
      "name": "Read all PRs",
      "operations": ["list", "view", "diff", "checks", "list:comments"]
    },
    {
      "name": "Merge approved PRs to develop",
      "operations": ["merge"],
      "condition": {
        "draft": false,
        "reviewDecision": "APPROVED",
        "baseBranch": ["develop"]
      }
    }
  ],
  "defaultPermission": "deny"
}
```

**Allow agents to manage only their own issues:**

```jsonc
{
  "issueRules": [
    {
      "name": "Read all issues",
      "operations": ["list", "view", "list:comments"]
    },
    {
      "name": "Manage own issues",
      "operations": ["update", "close", "reopen"],
      "condition": { "createdBy": "self" }
    }
  ],
  "selfUserId": "my-github-bot",
  "defaultPermission": "deny"
}
```

## Usage

### Issues

```bash
safe-gh issue list [-R owner/repo]
safe-gh issue view <number> [-R owner/repo]
safe-gh issue create -t <title> [-b <body>] [-l <labels>] [-a <assignees>] [-R owner/repo]
safe-gh issue edit <number> [--title <title>] [--body <body>] [--add-label <labels>] [-R owner/repo]
safe-gh issue close <number> [-R owner/repo]
safe-gh issue reopen <number> [-R owner/repo]
safe-gh issue delete <number> [-R owner/repo]
safe-gh issue comment <number> --body <text> [-R owner/repo]
```

### Pull Requests

```bash
safe-gh pr list [-R owner/repo]
safe-gh pr view <number> [-R owner/repo]
safe-gh pr create -t <title> [-B <base>] [-H <head>] [-b <body>] [-d] [-R owner/repo]
safe-gh pr edit <number> [--title <title>] [--body <body>] [--add-label <labels>] [-R owner/repo]
safe-gh pr merge <number> [--method squash|rebase|merge] [--delete-branch] [-R owner/repo]
safe-gh pr review <number> [--approve|--request-changes] [-b <body>] [-R owner/repo]
safe-gh pr diff <number> [-R owner/repo]
safe-gh pr checks <number> [-R owner/repo]
safe-gh pr close <number> [-R owner/repo]
safe-gh pr reopen <number> [-R owner/repo]
safe-gh pr update-branch <number> [-R owner/repo]
```

### Search

```bash
safe-gh search code <query> [-R owner/repo]
safe-gh search issues <query> [-R owner/repo]
safe-gh search prs <query> [-R owner/repo]
safe-gh search repos <query>
safe-gh search commits <query> [-R owner/repo]
```

### Projects

```bash
safe-gh project list [--owner <owner>]
safe-gh project view <number> [--owner <owner>]
safe-gh project create -t <title> [--owner <owner>]
safe-gh project edit <number> [--title <title>] [--owner <owner>]
safe-gh project close <number> [--owner <owner>]
safe-gh project delete <number> [--owner <owner>]
safe-gh project item-list <number> [--owner <owner>]
safe-gh project field-list <number> [--owner <owner>]
safe-gh project item-add <number> --url <url> [--owner <owner>]
safe-gh project item-edit <number> --id <id> --field-id <field-id> --value <value> [--owner <owner>]
```

### Global Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Check permissions without executing the command |
| `--version` | Show version |
| `--help` | Show help |

### Dry-Run Mode

Use `--dry-run` to check if a command would be permitted:

```bash
$ safe-gh --dry-run pr merge 42 -R owner/repo
{
  "allowed": true,
  "rule": "Merge approved PRs to develop",
  "operation": "merge"
}
```

## Error Handling

All errors are returned as structured JSON:

```json
{
  "error": "Permission denied for operation: merge",
  "code": "PERMISSION_DENIED",
  "details": { ... }
}
```

Error codes: `PERMISSION_DENIED`, `GH_CLI_ERROR`, `CONFIG_ERROR`, `VALIDATION_ERROR`

## How It Works

1. **Parse command** — safe-gh parses the requested operation and target resource
2. **Gather context** — Fetches resource metadata from GitHub (author, labels, branches, etc.)
3. **Evaluate rules** — Rules are checked in order; the first matching rule wins
4. **Check conditions** — If the matched rule has conditions, all must be satisfied
5. **Execute or deny** — If permitted, delegates to `gh` CLI; otherwise returns a permission error

## Integration with AI Agents

safe-gh is designed to be used as the GitHub interface for AI agents. Add it to your agent's tool configuration:

**Claude Code (MCP / `claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "safe-gh": {
      "command": "safe-gh",
      "args": ["issue", "list"]
    }
  }
}
```

**Or simply replace `gh` with `safe-gh` in your agent's allowed commands.**

## Development

```bash
bun install          # Install dependencies
bun run build        # Build the project
bun run typecheck    # Type-check without emitting
```

## License

[MIT](LICENSE)
