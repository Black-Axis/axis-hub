---
description: Delegate one task to the Sonnet worker subagent, verify the result, then update tracking and docs
argument-hint: "[P-NN] [TASK-TT]"
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), Bash(git status:*), Bash(git diff:*), Bash(git ls-files:*), Agent, SendMessage, AskUserQuestion
---

# /foreman:run

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

Exactly one task is run per invocation. You (the main agent) orchestrate and verify; the `foreman-worker` subagent implements.

## 1. Resolve and check

1. Parse `P-NN` and `TASK-TT`. Shortcuts:
   - Only `TASK-TT` given: if exactly one plan is active (not `Done`, `Canceled`, or `Hold`), use it; otherwise list the active plans and ask which one.
   - No arguments: find the ready tasks (`Not Started`, all `Depends On` tasks `Done`) across active plans with an `Approved` contract. Propose the first one as the recommended choice and list the others; ask the user to confirm or pick.

   Never run a task the user has not confirmed.
2. Load the plan, contract, TRK file, and the task file `workbench/subtasks/P-NN-<slug>/TASK-TT-<task-slug>.md`.
3. Refuse and explain if any of these is true:
   - Contract Status is not `Approved` (tell the user to run `/foreman:approve P-NN`).
   - The plan is `Hold` or `Canceled`.
   - The task is `Done`, `Canceled`, or `Hold` (suggest `/foreman:resume` for hold).
   - A task listed in `Depends On` is not `Done`. Ask the user whether to proceed anyway; proceed only on explicit yes.
4. Record the current git state (`git status --porcelain`, `git diff --stat`) if the project is a git repo, so you can isolate the task's changes later.

## 2. Pre-check the task (before delegating)

The code may have changed since the task was planned. Verify the task file against the current code and plan:
- Every path in `Files Expected to Change` exists (or the task clearly creates it).
- Every Evidence reference (file, line, symbol, behavior) is still true.
- Outputs of `Depends On` tasks that this task relies on actually exist.
- The Required Outcome is not already met by the current code.
- The task still matches the contract (Scope, Out of Scope, Acceptance Criteria) and the plan, including approved change requests.
- The sections are complete and specific enough for the worker to act without guessing.

Then:
- **Small problems** - stale line numbers, a moved or renamed path with one obvious match, typos, missing detail you can fill from the code without changing intent: fix the task file yourself and log each fix (`Main agent`, `Action`, `pre-check: <fix>`).
- **Big problems** - the Required Outcome, scope, or set of files must change materially; the outcome is already met; a conflict with other code or tasks; evidence no longer holds and the approach is in doubt: stop, show the problems, and ask the user: update the task as proposed and continue, `/foreman:change P-NN`, or cancel the task. Log the answer (`User`, `Decision`). Continue only on the first choice.

## 3. Mark In Progress

Set the task to `In Progress` following the status rules (TRK table, History, INDEX).

## 4. Delegate

Launch the `foreman-worker` subagent (`foreman:foreman-worker`) with a prompt of exactly these lines and nothing else - never paste file contents, summaries, or instructions (the worker's own definition already has them):

```
Task: workbench/subtasks/P-NN-<slug>/TASK-TT-<task-slug>.md
Contract: workbench/contracts/CONT-NN-<slug>.md
Output: <Concise | Normal>
```

## 5. Verify

When the worker returns its report:
1. Inspect the actual changes (git diff against the recorded state, or read the files listed in the report).
2. Check:
   - Only files in `Files Expected to Change` were modified. Any other file is a deviation - judge whether it is justified; if not, the task fails verification.
   - Nothing listed in the task's or contract's Out of Scope was touched.
   - The Required Outcome is met and the Implementation requirements were followed.
   - The report covers every Report Requirement.
   - `workbench/` was not modified by the worker.
3. Run the test/build commands from the contract Working Rules (and any the project obviously uses). Record the results.
4. Log the test run (`Main agent`, `Action`, command + result) and the worker round (`Worker`, `Action`, files changed + commands run from its report).
5. If every check and test passes, go to step 7 (Pass). Otherwise go to step 6.

## 6. Fix rounds

Read `- Fix rounds:` in the INDEX `Settings` (a whole number; missing or invalid = `4`; `0` = no fix rounds). Run fix rounds automatically, without asking the user, until verification passes or the limit is reached.

Each round starts with one progress line to the user: `Fix round <n>/<limit>: <count> issues sent to worker`. Then:
1. Build feedback with three lists. Each item: file (and line if known), the problem, the expected result. Omit an empty list.
   - **Revert** - changes that must be undone (out-of-scope edits, unjustified files outside Files Expected to Change, unwanted changes).
   - **Not done** - parts of the Required Outcome, Implementation, or Report Requirements still missing.
   - **Wrong** - done but incorrect: failed tests (quote the exact error), wrong behavior, broken rules or standards.
2. Send the feedback to the **same** worker so it keeps its context (continue it with SendMessage using the agent ID returned in step 4). Send only the feedback lists - no task content, no repeated context. If continuing is not possible, launch a new `foreman-worker` with the same three lines as step 4, plus `Fix round: <n>` and the feedback lists (no previous report).
3. Add a TRK History row: `TASK-TT | In Progress -> In Progress | Main agent | Fix round <n>: <count> issues`, and an Activity row (`Main agent`, `Action`) with the feedback items in short.
4. When the worker replies, verify again exactly as in step 5 (all checks, all tests, logging), not only the listed items.

If verification passes, go to step 7 (Pass). If the limit is reached and issues remain, go to step 7 (Fail) with the remaining issues.

## 7. Close

- **Pass**:
  1. Set the task to `Done` with a short note that includes the fix rounds used (e.g. `verified; 2 fix rounds`).
  2. Update `workbench/docs/DOC-NN-<slug>.md`: add an `Implemented Tasks` entry (what changed, files, decisions) and refresh Summary, Architecture / Key Files, How to Extend, Known Limitations as needed. Set Last Updated.
  3. Apply the contract's commit policy (commit only if the policy says so; the commit message references `P-NN TASK-TT`). Log a commit as `Main agent`, `Action`, with its hash.
  4. Recompute the plan status. If every non-canceled task is now `Done`, apply the contract's Auto-close rule (missing or unclear value = `Ask`):
     - `Ask`: ask the user "All tasks Done. Run /foreman:close P-NN now?" and run it only on yes. Log the answer (`User`, `Decision`).
     - `Yes`: after the report in step 8, run `/foreman:close P-NN` (follow `${CLAUDE_PLUGIN_ROOT}/commands/close.md`).
     - `No`: only tell the user they can run `/foreman:close P-NN`.
- **Fail** (fix rounds used up, or blocked):
  - Set `Hold` with the reason `Verification failed after <n> fix rounds` plus the remaining issues in the TRK note. Use `Canceled` only if the task turned out to be obsolete, with the reason.
  - Show the user the remaining Revert / Not done / Wrong items and propose the next step: `/foreman:resume` then re-run, `/foreman:change`, or a manual fix.

## 8. Report to the user

Give a short summary: task result, number of fix rounds used, files changed, tests run and results, status changes, and the next ready tasks.
