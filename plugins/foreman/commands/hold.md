---
description: Put a task or a whole plan on hold, with a reason
argument-hint: <P-NN> [TASK-TT] <reason>
allowed-tools: Read, Glob, Edit(workbench/**), Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), AskUserQuestion
---

# /foreman:hold

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

State script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js"` ("State script" in rules.md).

1. Parse `P-NN`, optional `TASK-TT`, and the reason. If the reason is missing, ask for it.
2. Task target: allowed only from `Not Started` or `In Progress`. Set it to `Hold`.
3. Plan target (no `TASK-TT`): set the TRK Plan Status to `Hold`. Task statuses stay unchanged; no task of this plan may run while the plan is on hold.
4. Record the change with `wb.js status P-NN [TASK-TT] Hold --by <User|Main agent> --reason "<reason>" --note "<reason>"` (TRK table, History with the reason, task file Status, INDEX).
5. Confirm to the user what was put on hold.
