---
description: Write a stakeholder report for a feature to workbench/reports/
argument-hint: <P-NN>
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), AskUserQuestion
---

# /foreman:report

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

1. Resolve `P-NN` (ask if missing). Load its plan, contract, TRK file, task files, and doc.
2. Create `workbench/reports/` if it does not exist.
3. Write `workbench/reports/REP-NN-<slug>.md` from `${CLAUDE_PLUGIN_ROOT}/templates/report.md`, replacing the file if it exists. Content comes only from the `workbench/` files - do not invent progress, dates, or risks. Write it for readers who are not developers: short sentences, no code.
4. Do not print the report in chat. Reply only with the file path and one line: plan status and progress.
