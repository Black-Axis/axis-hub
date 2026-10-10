---
name: axis-open-pr
description: "Commit the current branch and open a pull request on Black-Axis/axis-hub with labels, assignee, milestone, and linked issues."
argument-hint: "[issue numbers or notes]"
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(gh issue view:*), Bash(gh api repos/Black-Axis/axis-hub/milestones:*), PowerShell(git status:*), PowerShell(git diff:*), PowerShell(git log:*), PowerShell(git branch:*), PowerShell(gh issue view:*), PowerShell(gh api repos/Black-Axis/axis-hub/milestones:*)
---

Open a pull request for the current branch. Notes from the user: $ARGUMENTS

Repository `Black-Axis/axis-hub`. Run each command on its own (no `cd`, no chaining), so the pre-approved forms match.

## 1. Look up

- `git branch --show-current`: stop if it is `main` (changes go through a `<type>/<short-name>` branch).
- `git status --short` and `git diff --stat`: the files to commit. Untracked files only when they belong to the change.
- The issues the change solves (from the notes or the conversation): `gh issue view <n> --json title,milestone,labels --jq '"\(.title) | \(.milestone.title) | \([.labels[].name] | join(","))"'`.
- Open milestones: `gh api repos/Black-Axis/axis-hub/milestones --jq '.[] | "\(.number) \(.title)"'`.
- Checks passed for the final state of the files (`axis-test-runner`); if not run yet, run them first.

## 2. Propose, then ask

Show in a compact table plus the texts:

- **Files** to stage.
- **Commit message**: `<type>(<scope>): <summary>` (or `<type>: <summary>`), a short body in normal prose, the closing lines (`Closes #N`), and the closing attribution lines this session's instructions give for commits (the `Co-Authored-By` trailer of the model running this session; never a model name copied from elsewhere). Credit every model that wrote committed content: when a subagent wrote files in this change (e.g. `axis-e2e-writer`), add a `Co-Authored-By: Claude <its model name> <noreply@anthropic.com>` line for the model it ran on. Never credit a model that only ran commands (`axis-pr-opener`, `axis-test-runner`).
- **PR title** and **body**: normal prose (not terse chat style), `## Summary` bullets, a closing keyword line per solved issue (`Closes #N`; `Part of #N` for a partial fix, which is not linked), `## Test plan` checkboxes, ending with the attribution line this session's instructions give for pull requests. Never mention GitLab or `.workbench`; no personal email addresses.
- **Labels**: `bug` or `enhancement` (never `documentation`), plus `plugin: <name>` and/or `marketplace`.
- **Milestone**: the issues' milestone.
- **Assignee**: `krypton225`.

Ask with `AskUserQuestion` (keeps this turn, so the pre-approvals stay): open as proposed, or change values. Nothing is committed before the user's yes.

## 3. Execute through the subagent

Hand the confirmed values to the `axis-pr-opener` subagent in one call. Prompt: `Branch:`, `Files:`, `Title:`, `Labels:`, `Assignee:`, `Milestone:`, `Linked issues:`, then `Commit message:` and `Body:` each followed by the full, final text (it adds nothing). Nothing else: its instructions are in its own file. `git commit`, `git push`, and `gh pr create` ask the user for permission there: those are the final checks.

## 4. Report

The subagent's lines as they are, then: the user merges (never `gh pr merge`) and runs `git finish`. On a `FAILED`, `MISSING`, or `LINKS` line, say what failed; never retry with other values without asking.
