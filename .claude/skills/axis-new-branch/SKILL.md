---
name: axis-new-branch
description: "Create a <type>/<short-name> branch from an up-to-date main for an issue or a described change."
argument-hint: "[issue number or short description]"
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git switch:*), Bash(git pull:*), Bash(git log:*), Bash(gh issue view:*), PowerShell(git status:*), PowerShell(git branch:*), PowerShell(git switch:*), PowerShell(git pull:*), PowerShell(git log:*), PowerShell(gh issue view:*)
---

Create a branch for: $ARGUMENTS

Repository `Black-Axis/axis-hub`. Run each command on its own (no `cd`, no chaining), so the pre-approved forms match.

## 1. Look up

- `git status --short`: uncommitted changes would move to the new branch. If there are any, ask first whether they belong to it; never stash or discard them yourself.
- An issue number: `gh issue view <n> --repo Black-Axis/axis-hub --json title,labels --jq '"\(.title) | \([.labels[].name] | join(","))"'`.

## 2. Propose, then ask

Name `<type>/<short-name>`, checked by `.githooks/guard.js`:

- type: `feat`, `fix`, `docs`, `test`, `ci`, `chore`, or `refactor` (label `bug` → `fix`, `enhancement` → `feat`, otherwise from the change);
- short name: 2-4 lowercase words joined by `-`, only `a-z` and `0-9` (no dots, no `#`, no issue number), naming the change, e.g. `feat/foreman-bug-command`.

Ask with `AskUserQuestion`: the proposed name first (Recommended), one or two alternatives.

## 3. Create

1. `git switch main`
2. `git pull --ff-only` (main's upstream; never name a remote)
3. `git switch -c <name>`

The PreToolUse hook denies a name that breaks the rules; then fix the name and ask again. Report one line: `On <name>, from main at <short hash>` (`git log -1 --format=%h`).
