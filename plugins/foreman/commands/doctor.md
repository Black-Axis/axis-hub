---
description: Check workbench/ for inconsistencies and fix them after your confirmation
argument-hint: "[P-NN]"
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), AskUserQuestion
---

# /foreman:doctor

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

With `P-NN`, check only that feature; otherwise check all of `workbench/`. If `workbench/INDEX.md` does not exist, tell the user to start with `/foreman:new` and stop.

## 1. Check

List the folders explicitly (`workbench/plans/`, `contracts/`, `tracking/`, `subtasks/`, `docs/`, `reports/`) and check:

1. **Feature files** - every feature in INDEX has its plan, contract, tracking, doc, and subtasks folder, with the same number and slug. Any of those files without an INDEX row.
2. **Naming** - file names follow the rules (prefix, 2-digit zero padding, kebab-case slug).
3. **Numbering** - duplicate feature numbers; duplicate task numbers inside a plan. (Gaps are only reported, never renumbered.)
4. **Tasks vs tracking** - every task file has a TRK row and every TRK row has a task file; titles match.
5. **Tasks vs plan** - the plan's Task Breakdown lists the same tasks; `Depends On` references tasks that exist.
6. **Statuses** - every status is a valid value (exact Title Case); the TRK table matches the last History entry for each target; the plan status follows the derivation rule; a plan is `Done` only if a `Closed` or `Imported` History entry exists.
7. **Contract** - valid Status; Auto-close is `Ask`, `Yes`, or `No`; `Approved` has a date; Change Requests with an Approved date only if the contract is `Approved`.
8. **INDEX** - Settings has valid Git (`committed` / `ignored`), Output (`Concise` / `Normal`), and Fix rounds (whole number 0-10) values; Contract Status and Progress match the contract and TRK files.
9. **Task files** - all mandatory sections exist and are not empty or still `{{...}}` placeholders.
10. **Tracking format** - every TRK file has the `History` table with a `By` column and an `Activity` table (older files: propose adding them, empty; never back-fill guessed rows).
11. **Imported gaps** - list every `Missing - from import` field (report only; the user fills them).

## 2. Report

Show a numbered list of findings. For each: file, problem, proposed fix. Mark fixes that need a judgement call (e.g. which of two conflicting statuses is correct, a missing task file) and ask the user how to resolve those instead of proposing a guess.

If nothing is wrong, say so and stop.

## 3. Fix after confirmation

Ask the user which fixes to apply (all, or a list of numbers). Apply only those. Never delete files; for an orphan file, ask whether to link it or leave it. Record each status correction as a TRK History row with reason "doctor: <what was fixed>". Report what was fixed and what remains.
