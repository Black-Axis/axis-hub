---
description: Write a stakeholder report for a feature
argument-hint: <P-NN>
allowed-tools: Read, Glob, Write(workbench/reports/**), Agent, AskUserQuestion
---

# /foreman:report

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

The `foreman-reporter` subagent reads the feature's files and composes the report, so those files never enter your context. You only save the report it returns. Do not read the plan, contract, tracking, task, or doc files yourself.

1. Resolve `P-NN`: if it is missing, list the features from `workbench/INDEX.md` and ask which one. Find the feature's files by name with `Glob` only: `workbench/plans/P-NN-*.md`, `workbench/contracts/CONT-NN-*.md`, `workbench/tracking/TRK-NN-*.md`, `workbench/docs/DOC-NN-*.md`. If the plan or tracking file is missing, say so and stop.
2. Launch the `foreman-reporter` subagent (`foreman:foreman-reporter`) with a prompt of exactly these lines and nothing else (its own definition has all instructions):

   ```
   Plan: workbench/plans/P-NN-<slug>.md
   Contract: workbench/contracts/CONT-NN-<slug>.md
   Tracking: workbench/tracking/TRK-NN-<slug>.md
   Doc: workbench/docs/DOC-NN-<slug>.md
   Output: <Concise | Normal>
   ```
3. On `FAILED: <reason>`, show the reason and stop. Otherwise save everything after the reporter's `STATUS:` line with one `Write` to `workbench/reports/REP-NN-<slug>.md` (the folder is created with it; an existing report is replaced). Save it exactly as returned: do not reword, shorten, or check it again.
4. Reply with two lines only: the report path, then the text after `STATUS:`. Never print the report in chat.
