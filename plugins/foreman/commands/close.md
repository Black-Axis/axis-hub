---
description: Verify acceptance criteria and full tests, then close a feature
argument-hint: <P-NN>
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), Bash(git status:*), PowerShell(git status:*), Bash(git diff:*), PowerShell(git diff:*), Bash(git ls-files:*), PowerShell(git ls-files:*), Bash(tf status:*), PowerShell(tf status:*), Bash(git log:*), PowerShell(git log:*), Bash(tf diff:*), PowerShell(tf diff:*), Bash(tf history:*), PowerShell(tf history:*), Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), AskUserQuestion
---

# /foreman:close

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` with its topic files `${CLAUDE_PLUGIN_ROOT}/reference/version-control.md` and `${CLAUDE_PLUGIN_ROOT}/reference/tasks.md` ("Topic files" in rules.md) and follow them.

State script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js"` ("State script" in rules.md).

A plan only becomes `Done` through this command (or through `/foreman:import` for work finished before foreman).

## 1. Check preconditions

Resolve `P-NN` (ask if missing). Refuse and explain if:
- The contract Status is not `Approved` (for `Amended Pending Approval`, tell the user to run `/foreman:approve P-NN`).
- The plan is `Canceled` or `Hold`.
- Any task is not `Done` or `Canceled`. List those tasks and the command to continue each.
- The plan is already `Done`.

Read `Version control` in INDEX (missing: detect and add it, "Version control" in version-control.md), then read the vcs file `${CLAUDE_PLUGIN_ROOT}/reference/vcs-<value>.md`. For `tfvc`, check once whether `tf` is available ("`tf` availability" in the vcs file).

## 2. Verify acceptance

1. Run the full test/build commands from the contract Working Rules (and any the project obviously uses), never a task's `Tests` row ("Test runs" in tasks.md). Record the results.
2. Check every item in the contract's Acceptance Criteria against the actual code and test results. For each, record: criterion, `Pass` / `Fail`, evidence (file:line, test name, command output).
3. Check that nothing listed in the contract's Out of Scope was changed by this feature's tasks: take the files each task changed from the TRK `Activity` rows, and what changed in them since the earliest task `Baseline`; git: per task, from its `start state: <hash>` Activity row (`git diff <hash>` up to the next task's start hash or the task's commit), so a change by the user or another task is not counted against this one ("Task baseline" in version-control.md: `git log` / `git diff`, `tf history` / `tf status`, or modification times).

## 3. Close or report

- **All criteria Pass and tests pass**:
  1. Set the plan status to `Done`: `wb.js status P-NN Done --by "Main agent" --reason "Closed: acceptance verified"` (TRK Plan Status and the History row `P-NN | In Progress -> Done | Main agent | Closed: acceptance verified`).
  2. Finalize `workbench/docs/DOC-NN-<slug>.md`: fill the Acceptance section with the results table, refresh Summary, Architecture / Key Files, How to Extend, Known Limitations. Set Last Updated.
  3. `wb.js refresh P-NN` (INDEX Progress).
  4. git: apply the contract's commit policy for any doc/final changes, if it says to commit, as in "Commit" in the vcs file (files: those this command changed; message references `P-NN`). tfvc and none: never commit or check in ("Commit" in the vcs file). Delete `workbench/.baseline/P-NN/` if any is left (one shell command, as in "Snapshot cleanup" in version-control.md).
- **Any criterion Fails or tests fail**:
  - Leave the plan status unchanged. Show the failing criteria with evidence.
  - Propose the fix: usually `/foreman:change P-NN <add task for ...>` to add follow-up tasks, then `/foreman:run`.

## 4. Report

Show the acceptance results table and the final plan status.
