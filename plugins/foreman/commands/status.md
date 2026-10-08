---
description: Show progress of all features, or task details of one plan
argument-hint: "[P-NN]"
allowed-tools: Read, Glob, Grep, Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*)
---

# /foreman:status

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it. This command is read-only: do not modify any file.

State script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js"` ("State script" in rules.md).

If `workbench/INDEX.md` does not exist, tell the user to start with `/foreman:init` or `/foreman:new` and stop.

## No argument

Run `wb.js overview` alone (one call; it also lists open interviews) and show its lines as the features table (number, feature, contract status, plan status, progress, next step); without Node, read them from `workbench/INDEX.md` and each TRK file. Highlight plans on `Hold`, contracts not yet `Approved`, and plans whose every non-canceled task is `Done` as `All tasks Done - waiting for /foreman:close P-NN`. Below the table, list interviews in `workbench/interviews/` with Status `In Progress` as `INT-NN <slug> - interview in progress, <covered>/<total> topics - /foreman:interview INT-NN`.

## With `P-NN`

From `workbench/tracking/TRK-NN-<slug>.md` show:
1. Plan status and contract status. If every non-canceled task is `Done` but the plan is not, add: `All tasks Done - waiting for /foreman:close P-NN`.
2. The task table (task, title, status, updated, note).
3. Counts per status.
4. Ready tasks: `wb.js ready P-NN` (`Not Started` tasks whose `Depends On` tasks are all `Done`).
5. The last 5 History entries.

If the tracking table and INDEX disagree, point out the mismatch (the TRK file is the source of truth) and suggest fixing it; do not fix it here.
