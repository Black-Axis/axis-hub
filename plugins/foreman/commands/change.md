---
description: Change a feature's scope or tasks; big changes need re-approval
argument-hint: <P-NN> <change request>
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), Bash(git log:*), PowerShell(git log:*), Bash(tf history:*), PowerShell(tf history:*), Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), AskUserQuestion
---

# /foreman:change

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` with its topic files `${CLAUDE_PLUGIN_ROOT}/reference/version-control.md` and `${CLAUDE_PLUGIN_ROOT}/reference/tasks.md` ("Topic files" in rules.md) and follow them.

State script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js"` ("State script" in rules.md).

1. Parse `P-NN` and the change request text. If either is missing, ask.
2. Load the plan, contract, TRK file, and task files, and read the vcs file for the INDEX `Version control` (new or rewritten tasks get a "Task baseline", version-control.md).
3. Analyze the impact of the request:
   - Which requirements, acceptance criteria, scope, or out-of-scope items change.
   - Which tasks are added, modified, or made obsolete. Tasks already `Done` are never rewritten; if a done task's work must change, add a new task for it.
   - Any unclear point: ask the user. Do not assume.
4. Classify the change:
   - **Small**: the contract's Scope, Out of Scope, and Acceptance Criteria stay exactly the same (e.g. splitting a task, adding detail, reordering, a new task that only implements already-agreed scope).
   - **Big**: any change to Scope, Out of Scope, or Acceptance Criteria.
5. Present the impact and the classification to the user and get confirmation with `AskUserQuestion` before writing. For a small change, the same confirmation also approves it (tell the user this in the question). Log the answer (`User`, `Decision`).
6. Apply exactly the confirmed impact - nothing more, nothing different (no extra dependency, task, or file). If you find while writing that something must differ, stop before writing it, show the difference, and confirm again with `AskUserQuestion`.
   - Contract: append a Change Requests row (`FEAT-n`, date, change, impact, Approved). `FEAT-n` continues from the highest existing number, starting at `FEAT-1`.
     - Small: Approved = today; contract Status unchanged.
     - Big: Approved empty; update Scope / Out of Scope / Acceptance Criteria; set Status to `Amended Pending Approval`.
   - Plan: update affected sections and the Task Breakdown; add a note under Open Questions if anything remains open.
   - Tasks: create new `TASK-TT` files ("Task size" in tasks.md; continue numbering from the highest existing task; Source = `FEAT-n`; header `Tests` as in "Test runs" in tasks.md; header `Worker model` `—` unless the user asks for one), edit not-yet-done task files, set obsolete tasks to `Canceled` with reason "FEAT-n".
   - TRK: add rows for new tasks (`Not Started`; title exactly as in the task file), History rows for task status changes (e.g. `Canceled`), and an Activity row (`Main agent`, `Action`) listing what `FEAT-n` changed. A contract status change goes to Activity, never History ("Statuses" in rules.md).
   - Status changes (e.g. obsolete tasks to `Canceled`) with `wb.js status`, one call per task. After all rows are written: `wb.js refresh P-NN` (derived Plan Status, task file Status rows, INDEX Contract Status and Progress).
7. Tell the user the result:
   - Small: approved; tasks can run now.
   - Big: no task can run until they run `/foreman:approve P-NN` again.
