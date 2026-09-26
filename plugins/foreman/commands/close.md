---
description: Close a feature - verify every contract acceptance criterion, run full tests, finalize the doc, mark the plan Done
argument-hint: <P-NN>
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), Bash(git status:*), Bash(git diff:*), Bash(git ls-files:*), AskUserQuestion
---

# /foreman:close

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

A plan only becomes `Done` through this command (or through `/foreman:import` for work finished before foreman).

## 1. Check preconditions

Resolve `P-NN` (ask if missing). Refuse and explain if:
- The contract Status is not `Approved` (for `Amended Pending Approval`, tell the user to run `/foreman:approve P-NN`).
- The plan is `Canceled` or `Hold`.
- Any task is not `Done` or `Canceled`. List those tasks and the command to continue each.
- The plan is already `Done`.

## 2. Verify acceptance

1. Run the full test/build commands from the contract Working Rules (and any the project obviously uses). Record the results.
2. Check every item in the contract's Acceptance Criteria against the actual code and test results. For each, record: criterion, `Pass` / `Fail`, evidence (file:line, test name, command output).
3. Check that nothing listed in the contract's Out of Scope was changed by this feature's tasks.

## 3. Close or report

- **All criteria Pass and tests pass**:
  1. Set the plan status to `Done` in the TRK file; add a History row `P-NN | In Progress -> Done | Main agent | Closed: acceptance verified`.
  2. Finalize `workbench/docs/DOC-NN-<slug>.md`: fill the Acceptance section with the results table, refresh Summary, Architecture / Key Files, How to Extend, Known Limitations. Set Last Updated.
  3. Update `workbench/INDEX.md` Progress.
  4. Apply the contract's commit policy for any doc/final changes, if it says to commit.
- **Any criterion Fails or tests fail**:
  - Leave the plan status unchanged. Show the failing criteria with evidence.
  - Propose the fix: usually `/foreman:change P-NN <add task for ...>` to add follow-up tasks, then `/foreman:run`.

## 4. Report

Show the acceptance results table and the final plan status.
