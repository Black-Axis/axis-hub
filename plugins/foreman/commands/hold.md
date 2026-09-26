---
description: Put a task or a whole plan on hold, with a reason
argument-hint: <P-NN> [TASK-TT] <reason>
allowed-tools: Read, Glob, Edit(workbench/**), AskUserQuestion
---

# /foreman:hold

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

1. Parse `P-NN`, optional `TASK-TT`, and the reason. If the reason is missing, ask for it.
2. Task target: allowed only from `Not Started` or `In Progress`. Set it to `Hold`.
3. Plan target (no `TASK-TT`): set the TRK Plan Status to `Hold`. Task statuses stay unchanged; no task of this plan may run while the plan is on hold.
4. Record the change per the status rules (TRK table, History with the reason, INDEX).
5. Confirm to the user what was put on hold.
