---
name: axis-new-branch
description: "Create a <type>/<short-name> branch from an up-to-date main for an issue or a described change."
argument-hint: "[issue number or short description]"
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(node .githooks/finish.js), Bash(git switch:*), Bash(git log:*), Bash(gh issue view:*), PowerShell(git status:*), PowerShell(node .githooks/finish.js), PowerShell(git switch:*), PowerShell(git log:*), PowerShell(gh issue view:*)
---

Create a branch for: $ARGUMENTS

Repository `Black-Axis/axis-hub`. Run each command on its own (no `cd`, no chaining), so the pre-approved forms match.

## 1. Look up

- `git status --short`: with uncommitted changes the cleanup in step 3 does nothing. Ask whether they belong to the new branch; never commit, stash, or discard them yourself.
- An issue number: `gh issue view <n> --repo Black-Axis/axis-hub --json title,labels --jq '"\(.title) | \([.labels[].name] | join(","))"'`.

## 2. Propose, then ask

Name `<type>/<short-name>`, checked by `.githooks/guard.js`:

- type: `feat`, `fix`, `docs`, `test`, `ci`, `chore`, or `refactor` (label `bug` → `fix`, `enhancement` → `feat`, otherwise from the change);
- short name: 2-4 lowercase words joined by `-`, only `a-z` and `0-9` (no dots, no `#`, no issue number), naming the change, e.g. `feat/foreman-bug-command`.

Ask with `AskUserQuestion`: the proposed name first (Recommended), one or two alternatives.

## 3. Create

1. `node .githooks/finish.js` (what `git finish` runs): switches to `main`, pulls it, and deletes merged branches; it never deletes unmerged work.
2. `git switch -c <name>`

With uncommitted changes that belong to the new branch, skip step 1 when already on `main` (the branch then starts from the local `main`; say so); on another branch, stop and ask the user to commit or stash first. The PreToolUse hook denies a name that breaks the rules; then fix the name and ask again. Report one line: `On <name>, from main at <short hash>` (`git log -1 --format=%h`).
