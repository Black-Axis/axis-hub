---
description: Send a task back to the worker for another fix round with your findings, after a fresh re-check
argument-hint: "[P-NN] [TASK-TT] [what is wrong]"
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), Bash(git status:*), PowerShell(git status:*), Bash(git diff:*), PowerShell(git diff:*), Bash(git ls-files:*), PowerShell(git ls-files:*), Bash(git log:*), PowerShell(git log:*), Bash(git stash create:*), PowerShell(git stash create:*), Bash(tf status:*), PowerShell(tf status:*), Bash(tf diff:*), PowerShell(tf diff:*), Bash(tf history:*), PowerShell(tf history:*), Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), Agent, SendMessage, AskUserQuestion
---

# /foreman:round

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and `${CLAUDE_PLUGIN_ROOT}/commands/run.md` (this command reuses its steps 3-8) and follow them.

State script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js"` ("State script" in rules.md).

Use this when the user finds that a task's result is wrong or incomplete - also after it was marked `Done`. It is rework of the same task, not a scope change: a change to Scope, Out of Scope, Acceptance Criteria, or the task's Required Outcome goes to `/foreman:change`.

## 1. Resolve and check

1. Parse `P-NN`, `TASK-TT`, and the user's text (everything else). Only `TASK-TT` given: use the single active plan, as in `run`. No task given: ask which one (`AskUserQuestion`, `Done` / `Hold` / `In Progress` tasks of active plans).
2. Load the plan, contract, TRK file, and task file.
3. Refuse and explain if any of these is true:
   - The plan is `Done` (closed) or `Canceled`: suggest `/foreman:change P-NN <request>` for a follow-up task.
   - The plan is `Hold`: suggest `/foreman:resume P-NN` first.
   - The task is `Not Started` (suggest `/foreman:run`) or `Canceled`.
   - Contract Status is not `Approved` (suggest `/foreman:approve P-NN`).
4. Read `Version control` in INDEX; for `tfvc`, check once whether `tf` is available.

## 2. User findings

Sort the user's text into the fix-round lists **Revert** (unwanted change), **Not done** (missing part), **Wrong** (done but incorrect), as in `run` step 6. If the text is empty, ask what is wrong with `AskUserQuestion` (the user types it with "Other", or picks "nothing specific - re-check only").

## 3. Fresh re-check

Verify the task again from scratch, as in `run` step 5, without trusting the earlier result:
- The task's changes: git - `git diff <start hash>` from the task's latest `start state: <hash>` Activity row (if the task was committed: `git diff <commit>^ -- <files>` for its commit from the Activity log, plus later uncommitted changes); tfvc with `tf` - `tf diff`; otherwise (snapshot already deleted) read the task's files and check their content.
- The verification checklist: every Required Outcome and Implementation point `Pass` / `Fail` with evidence, compared with the last checklist in the Activity log. A point that passed before and fails now is a finding too.
- The contract's tests (and baseline failures from the Activity log, which do not count).

Add each problem the user did not name to the lists, marked `(found by main agent)`.

## 4. Confirm

Show the three lists (each item with its source: `user` or `found by main agent`) and ask with `AskUserQuestion`: send them, change them (typed with "Other"), or cancel. Apply changes and ask again until the user confirms or cancels. On cancel, change nothing and stop. Log the confirmed lists (`User`, `Decision`, `round requested: <n> items`).

## 5. Reopen

1. If the task is `Done` or `Hold`, set it to `In Progress` now with `wb.js status P-NN TASK-TT In Progress --by User --reason "Round requested: <short summary>" --note "fix round requested"` (TRK row, History `TASK-TT | <old> -> In Progress | User | Round requested: ...`, INDEX Progress). A `Done` task's doc entry stays until step 6 updates it.
2. Record a new start state and run the baseline tests, as in `run` step 3 (start hash or snapshot), so this round's changes are isolated from the earlier ones.

## 6. Send and finish

1. Round number `<n>` = the task's highest fix round so far (History and Activity) + 1.
2. If the worker that ran this task still exists in this session, send it the lists with SendMessage (only the lists, as in `run` step 6). Otherwise launch a new `foreman-worker` (`foreman:foreman-worker`) with exactly the lines of `run` step 4, plus `Fix round: <n>` and the lists. Log it (`Main agent`, `Action`, `fix round <n> sent (user round)`).
3. Continue with `run` steps 5-8: verify, automatic fix rounds (the `Fix rounds` limit counts again from zero for this round), then Pass or Fail. On Pass, update the doc's `Implemented Tasks` entry for this task with the rework (`Rework (round <n>): ...`). A task that was committed before gets a new commit for the fix; earlier commits are never changed.
