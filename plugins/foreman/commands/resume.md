---
description: Resume a task or plan that is on hold
argument-hint: <P-NN> [TASK-TT] [note]
allowed-tools: Read, Glob, Edit(workbench/**)
---

# /foreman:resume

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

1. Parse `P-NN`, optional `TASK-TT`, and optional note.
2. The target must currently be `Hold`; otherwise say so and stop.
3. Find in the TRK History the most recent `-> Hold` entry for the target and restore the status it had before (`Not Started` or `In Progress`).
   - For a plan target: restore the Plan Status by the derivation rule in the shared rules.
4. Record the change per the status rules (TRK table, History with reason "resumed" plus the note, INDEX).
5. If a task was restored to `In Progress`, tell the user to continue it with `/foreman:run P-NN TASK-TT`.
