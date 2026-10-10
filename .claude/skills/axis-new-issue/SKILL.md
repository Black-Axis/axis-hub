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

Draft each issue and show it in a compact table plus the body:

- **Title**: short, imperative, no prefix.
- **Body**: normal prose (not terse chat style), sections `## Problem`, `## Proposal`, `## Acceptance`. For a bug: steps, expected, actual. Never mention GitLab or `.workbench`; no personal email addresses.
- **Labels**: `bug` or `enhancement` (or another fitting label from the list; never `documentation` alone), plus `plugin: <name>` for a plugin or `marketplace` for the repo itself.
- **Type**: `Bug`, `Feature`, or `Task`.
- **Assignee**: `krypton225`.
- **Milestone**: one of the open milestones.
- **Priority**: `Urgent` / `High` / `Medium` / `Low`. **Effort**: `High` / `Medium` / `Low`.
- **Start date** / **Target date**: only when the user gave them.

Name any likely duplicate. Then ask with `AskUserQuestion` (keeps this turn, so the pre-approvals stay): create as proposed, or change values. Ask the milestone if no open one fits. Create nothing before the user's yes.

## 3. Create through the subagent

Hand the confirmed issues to the `axis-issue-creator` subagent in one call. Prompt: per issue, `Title:`, `Labels:`, `Type:`, `Assignee:`, `Milestone:`, `Priority:`, `Effort:`, optional `Start:` / `Target:`, then `Body:` followed by the full body. Nothing else: how it creates them is in its own file. Its `gh issue create` asks the user for permission: the final check.

## 4. Report

The subagent's lines as they are. On a `FAILED` or `MISSING` line, say what failed; never retry with other values without asking.
