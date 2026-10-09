---
description: Cancel a task or plan, with a reason
argument-hint: <P-NN> [TASK-TT] <reason>
allowed-tools: Read, Glob, Edit(workbench/**), Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), AskUserQuestion
---

# /foreman:cancel

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` with its topic file `${CLAUDE_PLUGIN_ROOT}/reference/version-control.md` ("Topic files" in rules.md) and follow them.

State script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js"` ("State script" in rules.md).

1. Parse `P-NN`, optional `TASK-TT`, and the reason. If the reason is missing, ask for it.
2. Show what will be canceled and ask the user to confirm.
3. Task target: allowed from any status except `Done` and `Canceled`. Set it to `Canceled`. Warn the user if other tasks depend on it.
4. Plan target (no `TASK-TT`): set the TRK Plan Status to `Canceled` and set every task that is not `Done` to `Canceled`.
5. Record every change with `wb.js status P-NN [TASK-TT] Canceled --by <User|Main agent> --reason "<reason>" --note "<reason>"` - one call per task, then one for the plan target (TRK table, History with the reason, task file Status, INDEX; for a task that was `In Progress`, also its snapshot folder and session marker in `workbench/.baseline/` - without Node, delete the folder as in "Snapshot cleanup" in version-control.md).
6. Do not revert any code. If code from an `In Progress` task exists, tell the user so they can decide.
