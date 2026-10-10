---
name: axis-new-issue
description: "Open GitHub issues on Black-Axis/axis-hub with labels, Type, assignee, milestone, Priority, and Effort."
argument-hint: "<what the issue is about; several issues allowed>"
disable-model-invocation: true
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh label list:*), Bash(gh api repos/Black-Axis/axis-hub/milestones:*), PowerShell(gh issue list:*), PowerShell(gh issue view:*), PowerShell(gh label list:*), PowerShell(gh api repos/Black-Axis/axis-hub/milestones:*)
---

Open one GitHub issue per item in: $ARGUMENTS

Repository `Black-Axis/axis-hub`. Run each command on its own (no `cd`, no chaining), so the pre-approved forms match.

## 1. Look up

- Open milestones: `gh api repos/Black-Axis/axis-hub/milestones --jq '.[] | "\(.number) \(.title)"'`
- Labels: `gh label list --json name --jq '.[].name'`
- Possible duplicates: `gh issue list --state all --search "<key words>" --limit 5`

## 2. Propose, then ask

Write each body once, with the Write tool, to a new file in your scratchpad directory; the user reviews it there (never paste it again in chat or in a prompt). Body: normal prose, sections `## Problem`, `## Proposal`, `## Acceptance` (a bug: steps, expected, actual). Never mention GitLab or `.workbench`; no personal email addresses.

Then show one compact table, a row per issue: title (short, imperative), labels, Type, assignee, milestone, Priority, Effort, dates only when the user gave them (rules in CLAUDE.md "GitHub issues and pull requests"). Name any likely duplicate. Ask with `AskUserQuestion` (keeps this turn, so the pre-approvals stay): create as proposed, or change values. Create nothing before the user's yes.

## 3. Create through the subagent

One `axis-issue-creator` call, prompt lines only, per issue: `Title:`, `Body file:`, `Labels:`, `Type:`, `Assignee:`, `Milestone:`, `Priority:`, `Effort:`, optional `Start:` / `Target:`. Its `gh issue create` asks the user for permission: the final check.

## 4. Report

The subagent's lines as they are. On a `FAILED` or `MISSING` line, say what failed; never retry with other values without asking.
