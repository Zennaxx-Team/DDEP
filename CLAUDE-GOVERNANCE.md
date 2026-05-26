# Claude AI Governance Guide

Answers to governance questions for this project, based on the current Claude configuration in `.github/workflows/` and `CLAUDE.md`.

---

## Current Claude Setup (Summary)

| File | What it does |
|---|---|
| `.github/workflows/claude.yml` | Runs Claude on issues/comments/PRs that mention `@claude` |
| `.github/workflows/claude-code-review.yml` | Automatically reviews every PR with Claude when opened or updated |
| `CLAUDE.md` | Gives Claude context about the codebase architecture, commands, and known issues |

Claude's permissions in `claude.yml` are currently set to **read-only** (`contents: read`, `pull-requests: read`, `issues: read`). This means Claude can only comment — it cannot push code or merge PRs on its own unless the action is granted write permissions.

---

## Q1: How to Review, Reject, or Rollback After Claude Completes Work on a Git Issue

### How Claude delivers its work

When you tag `@claude` in an issue, Claude works inside the issue's dedicated branch (created automatically by the `create-issue-branch.yml` workflow) and opens a **Pull Request** targeting `dev`. It never pushes directly to `dev` or `main`.

### Reviewing Claude's changes

1. Open the Pull Request Claude created.
2. The `claude-code-review.yml` workflow runs automatically and posts a code-review comment on the PR — this is a second Claude pass that flags problems in the diff.
3. Review the diff manually. Pay particular attention to:
   - Changes in `handler/inbound.js` and `handler/dapi.js` — these files use module-level mutable state that is unsafe under concurrent requests (documented in `CLAUDE.md`).
   - Changes in `common/common.js` — this is the shared pipeline used by every data flow.
   - Changes in `middleware/index.js` — auth logic.

### Rejecting Claude's work

- **Request changes** on the PR — Claude will see the review comment and iterate if you tag `@claude` again.
- **Close the PR without merging** — the issue branch remains but no code lands on `dev`. Delete the branch afterwards if it is no longer needed.
- **Leave the PR open** — it will not affect any environment until merged.

### Rolling back after a merge

If Claude's work was already merged into `dev`:

```bash
# Find the merge commit
git log --oneline dev

# Option A: Revert the merge commit (safe, creates a new commit)
git revert -m 1 <merge-commit-hash>
git push origin dev

# Option B: Reset dev to before the merge (destructive — coordinate with team first)
git checkout dev
git reset --hard <commit-hash-before-merge>
git push --force-with-lease origin dev
```

`main` is protected by the PR flow so a bad `dev` merge never reaches production until a separate `dev → main` PR is reviewed and approved.

---

## Q2: How to Set Up Rules to Avoid Claude Breaking Core Areas

### Layer 1 — CLAUDE.md instructions (already partially in place)

`CLAUDE.md` is loaded by Claude on every run. Add explicit **off-limits** sections to it. Example additions:

```markdown
## Off-limits for AI modifications

Do NOT modify the following without explicit human approval in the PR description:

- `handler/inbound.js` — core inbound pipeline; module-level globals make concurrent changes dangerous
- `handler/dapi.js` — DDEP API pipeline; same concurrency risk
- `common/common.js` — shared by every data flow; a bug here affects all integrations
- `middleware/index.js` — authentication and authorization
- `queues/config/queuesConfigartion.js` — Redis/BullMQ connection config
- `config/index.js` — global config including AES keys
- Any `models/*.js` file — schema changes require a migration plan
- `.env*` files — never modify environment files
```

### Layer 2 — GitHub branch protection rules

In **GitHub → Settings → Branches**, add a protection rule for `dev` and `main`:

| Setting | Recommended value |
|---|---|
| Require a pull request before merging | ✅ enabled |
| Required approvals | At least **1** human reviewer |
| Dismiss stale reviews when new commits are pushed | ✅ enabled |
| Require review from Code Owners | ✅ (see Layer 3) |
| Do not allow bypassing the above settings | ✅ enabled |

This ensures Claude's PR cannot be merged by Claude itself or by an automated process.

### Layer 3 — CODEOWNERS file

Create `.github/CODEOWNERS` to require human sign-off on the most sensitive files:

```
# Core pipeline — any PR touching these files needs a human owner to approve
handler/inbound.js        @zennaxxdivyesh
handler/dapi.js           @zennaxxdivyesh
common/common.js          @zennaxxdivyesh
middleware/index.js       @zennaxxdivyesh
config/index.js           @zennaxxdivyesh
queues/                   @zennaxxdivyesh
models/                   @zennaxxdivyesh
```

With branch protection set to "Require review from Code Owners", GitHub will block merging any PR that touches these files until the listed owner approves — regardless of how many other approvals exist.

### Layer 4 — Restrict Claude's GitHub Action permissions

In `.github/workflows/claude.yml`, the current permissions block is already read-only for most scopes. If you grant Claude write access in the future (to let it push code), add explicit scope limits:

```yaml
permissions:
  contents: write        # only if Claude needs to push
  pull-requests: write   # only if Claude needs to open PRs
  issues: write          # only if Claude needs to comment
  # Never grant: admin, deployments, packages, secrets
```

### Layer 5 — Never let Claude self-merge

Ensure the `claude.yml` action does **not** have `pull-requests: write` with a merge step, and that no workflow calls `gh pr merge` automatically. All merges must be done by a human in the GitHub UI after review.

### Summary of recommended safeguards

```
CLAUDE.md off-limits list
        ↓
Issue branch → Claude PR → Auto code-review comment
        ↓
Human reviews diff (especially handler/, common/, middleware/)
        ↓
CODEOWNERS blocks merge if sensitive files touched without owner approval
        ↓
Branch protection requires ≥1 human approval before merge
        ↓
Human merges (Claude cannot self-merge)
        ↓
dev branch  →  separate PR  →  main
```
