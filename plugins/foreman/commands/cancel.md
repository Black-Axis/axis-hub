---
description: Cancel a task or a whole plan, with a reason
argument-hint: <P-NN> [TASK-TT] <reason>
allowed-tools: Read, Glob, Edit(workbench/**), AskUserQuestion
---

# /foreman:cancel

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

1. Parse `P-NN`, optional `TASK-TT`, and the reason. If the reason is missing, ask for it.
2. Show what will be canceled and ask the user to confirm.
3. Task target: allowed from any status except `Done` and `Canceled`. Set it to `Canceled`. Warn the user if other tasks depend on it.
4. Plan target (no `TASK-TT`): set the TRK Plan Status to `Canceled` and set every task that is not `Done` to `Canceled`.
5. Record every change per the status rules (TRK table, History with the reason, INDEX).
6. Do not revert any code. If code from an `In Progress` task exists, tell the user so they can decide.
