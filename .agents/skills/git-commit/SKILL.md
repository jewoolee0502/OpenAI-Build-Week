---
name: git-commit
description: Create a clean, reviewable Git history by grouping completed work into separate Conventional Commits and rebasing the current branch onto main. Use when asked to commit changes, split an overly broad change into logical commits, prepare a branch for merge, or sync a feature branch with main. Never push unless the user explicitly asks, and stop for the user to resolve any integration conflict.
---

# Commit And Sync Main

Turn completed work into small, independently understandable commits, then bring the branch up to date with `main`. Use the configured Git identity only; do not add AI, bot, pair-programming, or co-author attribution.

## Guardrails

- Do not commit or push merely because this skill is loaded. Commit only when the user has explicitly requested commits.
- Never push as part of this workflow. Push only in a separate, explicit user request.
- Never alter `user.name` or `user.email`. Before committing, verify both are configured; if either is absent or appears incorrect, stop and ask the user.
- Never add `Co-authored-by`, `Generated-by`, `Assisted-by`, or similar trailers, and never mention AI in a commit message.
- Do not use `git add .`, `git add -A`, blanket staging, `git commit -a`, or a destructive Git command when unrelated changes are present.
- Do not include secrets, lockfile churn, generated output, or another person's changes without clear user intent.

## 1. Inspect And Plan

Run these read-only checks first:

```bash
git status --short
git diff --stat
git diff --cached --stat
git diff -- <relevant paths>
git diff --cached -- <relevant paths>
git ls-files --others --exclude-standard
git config user.name
git config user.email
git branch --show-current
git remote -v
```

Read the relevant files and tests, not only the diff. Partition the requested work by a single purpose and dependency direction. A good group can be reviewed, reverted, and understood on its own. Typical order is: shared types/configuration, behavior, tests, documentation. Keep a test with the behavior it proves. Leave unrelated or ambiguous files untouched and ask the user to decide their disposition.

Before staging, state a concise commit plan when there is more than one group. If the user has asked for a single small change, proceed without unnecessary ceremony.

## 2. Create Focused Commits

For each group, stage explicit paths or hunks, inspect the staged patch, then commit it:

```bash
git add <only-the-files-or-hunks-for-this-group>
git diff --cached --check
git diff --cached
git commit -m "type(scope): imperative summary"
```

Use Conventional Commits with a short imperative summary, no ending period:

```text
feat(game): add published bundle validation
fix(auth): reject expired child sessions
refactor(api): extract project authorization guard
test(projects): cover guardian access boundaries
docs(readme): clarify local setup
chore(deps): update test tooling
```

Use `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, or `style` as appropriate. Omit the scope only when it would be misleading. Use `!` and a `BREAKING CHANGE:` footer only for a real breaking change. Do not manufacture a scope or claim behavior that the patch does not demonstrate.

Run the smallest relevant checks after each behavior-affecting commit. If a check fails, report the failure and fix or ask before continuing; do not claim the commit is validated when it is not.

## 3. Integrate Main Without Pushing

After the requested commits are complete, ensure there are no remaining changes that would make integration unsafe. Do not stash, discard, or absorb unrelated work.

Fetch the current `main` and rebase the feature branch onto it:

```bash
git fetch origin main
git rebase origin/main
```

Rebasing makes the branch contain the latest `main` commits and exposes conflicts now, while preserving a linear, readable history. Do not push after the rebase.

If `git rebase` reports a conflict:

1. Stop immediately. Do not edit conflict markers, choose a side, run `git rebase --continue`, or abort the rebase.
2. Report that the branch is paused in a rebase, list the conflicted files from `git status`, and tell the user that they must resolve the conflicts manually.
3. Leave the working tree and rebase state intact for the user.

If the branch is already `main`, fetch it and report whether local `main` is current; do not rebase `main` onto itself.

## 4. Report Precisely

Report each created commit hash and subject, the relevant verification results, and whether the rebase onto `origin/main` completed. Explicitly state that no push was performed. Do not claim clean integration without fresh command output.
