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

Write each text once, with the Write tool, to a new file in your scratchpad directory; the user reviews it there (never paste it again in chat or in a prompt):

- **Commit message file**: `<type>(<scope>): <summary>`, a short body in normal prose, `Closes #N` lines, then the `Co-Authored-By` trailer this session's instructions give for commits. Credit every model that wrote committed content (e.g. the model `axis-e2e-writer` ran on), never one that only ran commands.
- **Body file**: normal prose, `## Summary` bullets, a closing keyword line per solved issue, `## Test plan` checkboxes, ending with this session's attribution line for pull requests. Never mention GitLab or `.workbench`; no personal email addresses.

Then show one compact table: files to stage, PR title, labels, assignee, milestone, linked issues (rules in CLAUDE.md "GitHub issues and pull requests"). Ask with `AskUserQuestion` (keeps this turn, so the pre-approvals stay): open as proposed, or change values. Nothing is committed before the user's yes.

## 3. Execute through the subagent

One `axis-pr-opener` call, prompt lines only: `Branch:`, `Files:`, `Commit message file:`, `Title:`, `Body file:`, `Labels:`, `Assignee:`, `Milestone:`, `Linked issues:`. Its `git commit`, `git push`, and `gh pr create` ask the user for permission: the final checks.

## 4. Report

The subagent's lines as they are, then: the user merges (never `gh pr merge`) and runs `git finish`. On a `FAILED`, `MISSING`, or `LINKS` line, say what failed; never retry with other values without asking.
