---
name: open-new-pr
description: Prepare and safely create a GitHub pull request with an evidence-backed description. Use when asked to open a PR, prepare a branch for review, summarize branch changes, or draft a pull request description. Default the base branch to main unless the user names another base branch; do not create or push a PR unless the user explicitly asks.
---

# Create Pull Request

Create review-ready pull requests from the current branch. Use Git and GitHub CLI evidence, preserve the user's chosen base branch, and make no unsupported claim that a change is safe.

## Guardrails

- Default the base branch to `main`; use a different base only when the user explicitly names it.
- Do not create a PR, push a branch, edit commits, or change the base branch merely while drafting or inspecting. Perform each external action only with explicit user authorization.
- Do not open a PR from the base branch into itself. Confirm the current branch, remote, and GitHub authentication before creating anything.
- Do not state that a change is safe, complete, or verified without fresh evidence. Never hide failing, skipped, or unrun checks.
- Do not include secrets, credentials, private URLs, or unrelated local changes in the PR or its description.
- Do not disclose or imply AI involvement. Do not add AI, bot, generated-by, assisted-by, co-author, or similar attribution to the PR title, description, comments, commits, or Git trailers. Use the repository owner's configured Git and GitHub identity only.

## 1. Inspect The Branch

Determine the base branch (`main` unless the user specified another branch), then inspect the exact PR range:

```bash
git status --short
git branch --show-current
git fetch origin <base-branch>
git log --oneline origin/<base-branch>..HEAD
git diff --stat origin/<base-branch>...HEAD
git diff --name-status origin/<base-branch>...HEAD
git diff --check origin/<base-branch>...HEAD
git log -1 --format=%B
gh auth status
```

Read the relevant diff and identify the smallest relevant verification commands from repository guidance and changed code. If the working tree contains unrelated changes, leave them untouched and call them out. If the branch has no commits beyond the base, stop.

Confirm that the branch is already published. If it is not, report that a PR cannot be created from an unpushed branch and ask the user for permission to push; do not assume it.

## 2. Write The PR Description

Use accurate Markdown in this order. List every changed file under one category; use **Other / shared** for documentation, tooling, configuration, or files that do not belong to frontend, backend, or database. Write `None` where a category has no changed files.

```markdown
## Summary

- <Outcome-focused summary of the complete PR.>
- <Important implementation or behavior detail.>

## Files Changed

### Frontend

- `path/to/file` — <purpose>

### Backend

- `path/to/file` — <purpose>

### Database

- `path/to/migration-or-schema` — <purpose>

### Other / shared

- `path/to/file` — <purpose>

## Testing and Verification

- ✅ `<command>` — <fresh result>
- ⚠️ `<command or check>` — <not run, failed, or limitation and reason>

## Safety Assessment

- **Status:** Safe to review / Needs follow-up / Not verified
- **Evidence:** <authorization, validation, test, migration, or security evidence>
- **Risks or follow-ups:** <specific risk, rollout, migration, or `None identified`>

## TL;DR

<One or two sentences describing what changed and the current verification status.>
```

Put **TL;DR** last. Do not write a database section merely because the application has a database; report only files actually changed. A change is not "Safe to review" unless the relevant checks passed and no unresolved risk is known. Prefer "Needs follow-up" or "Not verified" when evidence is incomplete.

## 3. Create The PR

First show the proposed title, base branch, changed-file classification, verification results, safety assessment, and complete description to the user when they asked only for a draft. When they explicitly authorize creation, create it with the selected base:

```bash
gh pr create --base <base-branch> --head <current-branch> --title "<conventional, descriptive title>" --body-file <temporary-description-file>
```

Use a concise, human-facing title that reflects the branch's primary outcome. After creation, report the PR URL, base and head branches, and any verification limits. Do not merge, enable auto-merge, request reviewers, alter labels, or push further commits unless separately asked.
