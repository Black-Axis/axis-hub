---
description: Delegate one task to the Sonnet worker subagent, verify the result, then update tracking and docs
argument-hint: "[P-NN] [TASK-TT]"
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), Bash(git status:*), Bash(git diff:*), Bash(git ls-files:*), Bash(git log:*), Bash(tf status:*), Bash(tf diff:*), Bash(tf history:*), Agent, SendMessage, AskUserQuestion
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
4. Read `Version control` in INDEX (missing: detect and add it, "Version control" in rules.md). For `tfvc`, check once whether `tf` is available.

## 2. Pre-check the task (before delegating)

The code may have changed since the task was planned. Find out what changed first, then verify the task file against the current code and plan.

**What changed since the task was written** (rules.md "Task baseline"):
1. **Since the baseline**: list what changed in the task's `Files Expected to Change` (and files named in Evidence) since the task's `Baseline`. Re-read only the changed parts and check them against Evidence and Implementation.
2. **Earlier foreman tasks**: from the TRK `Activity` rows of `Done` tasks in this plan and other active plans, find tasks that changed the same files after this task's baseline. Check that what they changed (names, signatures, behavior) still fits this task's Evidence and Implementation.
3. **Uncommitted changes** (git; tfvc with `tf`): `git status --porcelain -- <files>` or `tf status <files>`. Changes from earlier foreman tasks that are not committed or checked in yet are expected (they are in the Activity log). Any other uncommitted change in the task's files belongs to the user: show the files and ask: commit (or check in) them first, keep them out of the way (stash or shelve) and re-run, or include them (they become part of the start state). Never commit, stash, shelve, or undo anything yourself. Log the answer (`User`, `Decision`). Skipped for none and tfvc without `tf`.

Then check:
- Every path in `Files Expected to Change` exists (or the task clearly creates it).
- Every Evidence reference (file, line, symbol, behavior) is still true.
- Outputs of `Depends On` tasks that this task relies on actually exist.
- The Required Outcome is not already met by the current code.
- The task still matches the contract (Scope, Out of Scope, Acceptance Criteria) and the plan, including approved change requests.
- The sections are complete and specific enough for the worker to act without guessing.
- **tfvc only - writable files**: every existing file in `Files Expected to Change` must be writable (a TFVC server workspace keeps files read-only until checked out). Check with a read-only command (`test -w <file>`, or PowerShell `(Get-Item <file>).IsReadOnly`). For read-only files: if `tf` is available, tell the user and run `tf checkout <files>` (one command, their normal permission prompt applies); otherwise list the files and ask the user to check them out in Visual Studio (Solution Explorer → Check Out for Edit), then re-check. Never clear the read-only flag yourself. Log the result (`Main agent`, `Action`).

Then:
- **Small problems** - stale line numbers, a moved or renamed path with one obvious match, typos, missing detail you can fill from the code without changing intent: fix the task file yourself and log each fix (`Main agent`, `Action`, `pre-check: <fix>`).
- After any fix, or when the task was checked and still holds, set the task's `Baseline` to the current state, so the next check starts from here.
- **Big problems** - the Required Outcome, scope, or set of files must change materially; the outcome is already met; a conflict with other code or tasks; evidence no longer holds and the approach is in doubt: stop, show the problems, and ask the user: update the task as proposed and continue, `/foreman:change P-NN`, or cancel the task. Log the answer (`User`, `Decision`). Continue only on the first choice.

## 3. Mark In Progress

Set the task to `In Progress` following the status rules (TRK table, History, INDEX).

Record the start state so you can isolate the task's changes later ("Version control" in rules.md): git - `git status --porcelain` and `git diff --stat`; tfvc with `tf` - `tf status`, plus a snapshot; tfvc without `tf` and none - a snapshot in `workbench/.baseline/P-NN/TASK-TT/`. With tfvc, the snapshot is kept even when `tf` works, so the diff of each listed file never depends on the workspace type.

**Baseline tests**: unless the contract's Working Rules say `Baseline tests: no` (missing = `yes`), run the contract's test/build commands now, before the worker starts. Record each command with the failing tests (names and exact errors) in the Activity log (`Main agent`, `Action`, `baseline tests: ...`). If anything already fails, tell the user which tests fail before the task and ask: proceed (those failures are not counted against the worker), or stop and fix them first (`Hold` with the reason). Log the answer (`User`, `Decision`).

## 4. Delegate

Launch the `foreman-worker` subagent (`foreman:foreman-worker`) with a prompt of exactly these lines and nothing else - never paste file contents, summaries, or instructions (the worker's own definition already has them):

```
Task: workbench/subtasks/P-NN-<slug>/TASK-TT-<task-slug>.md
Contract: workbench/contracts/CONT-NN-<slug>.md
Output: <Concise | Normal>
Version control: <git | tfvc | none>
```

## 5. Verify

When the worker returns its report:
1. Inspect the actual changes against the recorded start state: git - `git diff` and new files from `git status`; tfvc - `tf status` / `tf diff /format:unified` if `tf` is available, and the snapshot diff; none - the snapshot diff and the modification-time check ("Snapshot" in rules.md). Also read the files listed in the report.
2. Check:
   - Only files in `Files Expected to Change` were modified. Any other file is a deviation - judge whether it is justified; if not, the task fails verification.
   - Nothing listed in the task's or contract's Out of Scope was touched.
   - The Required Outcome is met and the Implementation requirements were followed.
   - The report covers every Report Requirement.
   - `workbench/` was not modified by the worker.
   - Files were changed only with `Edit` / `Write` ("How to change files" in `${CLAUDE_PLUGIN_ROOT}/agents/foreman-worker.md`). Scan Commands Run for shell file writes (redirects, `Set-Content`, `Out-File`, `Add-Content`, `sed -i`, heredocs or here-strings into files, script one-liners that write files), deletes or renames of files not listed for that, and file-changing commands (formatters, generators, installs) not named in the task or Working Rules. Each one is a deviation: list it under **Wrong** ("use Edit/Write, not the shell"), or under **Revert** if the change itself is unwanted, and tell the user which files were changed through the shell. If the content is right, the worker does not redo it; the item reminds it of the rule for the rest of the task.
3. **Show every change made outside `Edit` / `Write` as a diff.** The user must see every change to a code or docs file as a diff. For each file changed, created, deleted, or renamed by a shell command (named generators and installs, listed deletes and renames, and any rule break found above), show the user:
   - code and docs files (source, tests, config, Markdown, ...): the full diff of the file (`git diff`, `tf diff`, or the snapshot diff); for a new file, its full content as an added-lines diff;
   - deleted files: path and line count; renamed files: old → new path plus any content diff;
   - lockfiles, build output, binaries, and other generated non-source files: path and size of the change only (e.g. `git diff --stat`).
   Show this before the Pass/Fail decision, so the user sees it even when verification passes.
4. Run the test/build commands from the contract Working Rules (and any the project obviously uses). Record the results. Compare with the baseline tests: only failures that are new since the baseline fail verification. A baseline failure the user agreed to proceed with does not count against the worker - unless the task's Required Outcome is to fix it. Report baseline failures that still fail in one line.
5. Log the test run (`Main agent`, `Action`, command + result) and the worker round (`Worker`, `Action`, files changed + commands run from its report).
6. If every check and test passes, go to step 7 (Pass). Otherwise go to step 6.

## 6. Fix rounds

Read `- Fix rounds:` in the INDEX `Settings` (a whole number; missing or invalid = `4`; `0` = no fix rounds). Run fix rounds automatically, without asking the user, until verification passes or the limit is reached.

Each round starts with one progress line to the user: `Fix round <n>/<limit>: <count> issues sent to worker`. Then:
1. Build feedback with three lists. Each item: file (and line if known), the problem, the expected result. Omit an empty list.
   - **Revert** - changes that must be undone (out-of-scope edits, unjustified files outside Files Expected to Change, unwanted changes).
   - **Not done** - parts of the Required Outcome, Implementation, or Report Requirements still missing.
   - **Wrong** - done but incorrect: new failed tests since the baseline (quote the exact error), wrong behavior, broken rules or standards.
2. Send the feedback to the **same** worker so it keeps its context (continue it with SendMessage using the agent ID returned in step 4). Send only the feedback lists - no task content, no repeated context. If continuing is not possible, launch a new `foreman-worker` with the same lines as step 4, plus `Fix round: <n>` and the feedback lists (no previous report).
3. Add a TRK History row: `TASK-TT | In Progress -> In Progress | Main agent | Fix round <n>: <count> issues`, and an Activity row (`Main agent`, `Action`) with the feedback items in short.
4. When the worker replies, verify again exactly as in step 5 (all checks, all tests, logging), not only the listed items.

If verification passes, go to step 7 (Pass). If the limit is reached and issues remain, go to step 7 (Fail) with the remaining issues.

## 7. Close

- **Pass**:
  1. Set the task to `Done` with a short note that includes the fix rounds used (e.g. `verified; 2 fix rounds`).
  2. Update `workbench/docs/DOC-NN-<slug>.md`: add an `Implemented Tasks` entry (what changed, files, decisions) and refresh Summary, Architecture / Key Files, How to Extend, Known Limitations as needed. Set Last Updated.
  3. Version control ("Version control" in rules.md):
     - git: apply the contract's commit policy (commit only if the policy says so; the commit message references `P-NN TASK-TT`). Log a commit as `Main agent`, `Action`, with its hash.
     - tfvc: never check in. Deletes and renames the worker reported as needed, and new files: with `tf` available, propose `tf delete` / `tf rename` / `tf add` for those files and run them only on the user's yes; without `tf`, list them for the user to do in Visual Studio. Then tell the user the task's changes are ready to review and check in (pending changes). Log what was run.
     - none: nothing to do.
     - Delete the task's snapshot folder `workbench/.baseline/P-NN/TASK-TT/`, if any.
  4. Recompute the plan status. If every non-canceled task is now `Done`, apply the contract's Auto-close rule (missing or unclear value = `Ask`):
     - `Ask`: ask the user "All tasks Done. Run /foreman:close P-NN now?" and run it only on yes. Log the answer (`User`, `Decision`).
     - `Yes`: after the report in step 8, run `/foreman:close P-NN` (follow `${CLAUDE_PLUGIN_ROOT}/commands/close.md`).
     - `No`: only tell the user they can run `/foreman:close P-NN`.
- **Fail** (fix rounds used up, or blocked):
  - Set `Hold` with the reason `Verification failed after <n> fix rounds` plus the remaining issues in the TRK note. Delete the task's snapshot folder, if any (a re-run takes a new one). Use `Canceled` only if the task turned out to be obsolete, with the reason.
  - Show the user the remaining Revert / Not done / Wrong items and propose the next step: `/foreman:resume` then re-run, `/foreman:change`, or a manual fix.

## 8. Report to the user

Give a short summary: task result, number of fix rounds used, files changed, tests run and results, status changes, and the next ready tasks.
