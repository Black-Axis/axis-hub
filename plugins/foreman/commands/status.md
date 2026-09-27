---
description: Show progress of all features, or task details of one plan
argument-hint: "[P-NN]"
allowed-tools: Read, Glob, Grep
---

# /foreman:status

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it. This command is read-only: do not modify any file.

If `workbench/INDEX.md` does not exist, tell the user to start with `/foreman:init` or `/foreman:new` and stop.

## No argument

Show the features table from `workbench/INDEX.md` (number, feature, contract status, plan status from each TRK file, progress). Highlight plans on `Hold`, contracts not yet `Approved`, and plans whose every non-canceled task is `Done` as `All tasks Done - waiting for /foreman:close P-NN`. Below the table, list interviews in `workbench/interviews/` with Status `In Progress` as `INT-NN <slug> - interview in progress, <covered>/<total> topics - /foreman:interview INT-NN`.

## With `P-NN`

From `workbench/tracking/TRK-NN-<slug>.md` show:
1. Plan status and contract status. If every non-canceled task is `Done` but the plan is not, add: `All tasks Done - waiting for /foreman:close P-NN`.
2. The task table (task, title, status, updated, note).
3. Counts per status.
4. Ready tasks: `Not Started` tasks whose `Depends On` tasks are all `Done`.
5. The last 5 History entries.

If the tracking table and INDEX disagree, point out the mismatch (the TRK file is the source of truth) and suggest fixing it; do not fix it here.
