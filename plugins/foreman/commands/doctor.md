---
description: Check workbench/ for inconsistencies and fix them after your confirmation
argument-hint: "[P-NN]"
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), AskUserQuestion
---

# /foreman:doctor

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

State script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js"` ("State script" in rules.md).

With `P-NN`, check only that feature; otherwise check all of `workbench/`. If `workbench/INDEX.md` does not exist, tell the user to start with `/foreman:init` or `/foreman:new` and stop.

## 1. Check

First run `wb.js check [P-NN]` (one call). It does every mechanical check below and prints one `finding:` line per problem and `note:` lines for report-only items (exit code 2 when there are findings; the tool result shows it, so run the command alone, without `echo` or anything after it). Take its findings as they are; do yourself only the checks it cannot do, marked **(you)** below: Version control detection, the ignore file, and the CLAUDE.md block. With Node, read nothing else to check: not the feature files (plans, contracts, tracking, tasks, docs, interviews), only `workbench/INDEX.md` Settings, the ignore file, the CLAUDE files, and the block template. Without Node, do every check below yourself.

List the folders explicitly with `Glob`, never the shell ("Shell use" in rules.md) (`workbench/plans/`, `contracts/`, `tracking/`, `subtasks/`, `docs/`, `interviews/`, `reports/`) and check:

1. **Feature files** (ignore `.gitkeep` files and `workbench/.baseline/`) - every feature in INDEX has its plan, contract, tracking, doc, and subtasks folder, with the same number and slug. Any of those files without an INDEX row.
2. **Naming** - file names follow the rules (prefix, 2-digit zero padding, kebab-case slug).
3. **Numbering** - duplicate feature numbers (e.g. two branches both created `P-05`), also an interview number used by another feature; duplicate task numbers inside a plan. (Gaps are only reported, never renumbered.) Merge conflicts: `<<<<<<<` / `>>>>>>>` lines left in a `workbench/` file - a judgement call: the user resolves them in an editor (for INDEX, keep both sides' rows; the fix of finding 8 recomputes Progress and Contract Status), then runs doctor again. Never resolve them yourself.
4. **Tasks vs tracking** - every task file has a TRK row and every TRK row has a task file; titles match exactly in the task file, TRK, and the plan's Task Breakdown.
5. **Tasks vs plan** - the plan's Task Breakdown lists the same tasks; `Depends On` references tasks that exist.
6. **Statuses** - every status is a valid value (exact Title Case); the TRK table matches the last History entry for each target; the plan status follows the derivation rule; a plan is `Done` only if a `Closed` or `Imported` History entry exists; History has only task and plan rows (a contract status row, e.g. from an older version: propose moving it to Activity as `User`, `Decision`).
7. **Contract** - valid Status; Auto-close is `Ask`, `Yes`, or `No`; Baseline tests, if present, is `yes` or `no`; Full tests, if present, is `close` or `each task`; `Approved` has a date; Change Requests with an Approved date only if the contract is `Approved`.
8. **INDEX** - Settings has valid Version control (`git` / `tfvc` / `none`, and **(you)** it matches the detection in rules.md - a mismatch is a judgement call; a missing line gets the detected value), Workbench (`tracked` / `ignored`; an old `Git: committed / ignored` line is valid - propose renaming it to `Workbench: tracked / ignored`), **(you)** the ignore file matches Workbench ("Ignore file" in the vcs file `${CLAUDE_PLUGIN_ROOT}/reference/vcs-<value>.md`; `workbench/.baseline/` is ignored when tracked, git and tfvc), no leftover `workbench/.baseline/` snapshot folders or session markers (`TASK-TT.session`) for tasks that are not `In Progress` (fix for both: `wb.js refresh P-NN`), Output (`Concise` / `Normal`), Fix rounds (whole number 0-10), Worker model (`sonnet` / `opus` / `haiku`; a missing line is fine and means `sonnet`), and CLAUDE.md (`yes` / `no`) values; if a `Working Rules Defaults` section exists, it has the fields of the INDEX template, Auto-close is `Ask`, `Yes`, or `No`, Baseline tests is `yes` or `no`, and Full tests, if present, is `close` or `each task` (a missing section, or a missing Baseline tests line from before 1.3.0, is fine); Contract Status and Progress match the contract and TRK files (Progress `<done>/<total> Done`, plus `, TASK-TT In Progress` for each task In Progress; an older value without that part is reported, and the fix adds it).
9. **Task files** - all mandatory sections exist and are not empty or still `{{...}}` placeholders. A missing `Baseline` header row (tasks from before 1.3.0) is fine: report only. A missing `Tests` or `Worker model` header row (tasks from before 1.5.0) is fine, not reported; a `Worker model` row is `—`, `sonnet`, `opus`, or `haiku`. The `Status` header row matches the task's TRK status (TRK is the source of truth; fix: `wb.js refresh P-NN`, which rewrites every task file `Status` of the plan from TRK). A missing `Status` row (tasks from before 1.5.0) is a note: propose adding it with the same `wb.js refresh P-NN`, applied only on confirmation like any fix.
10. **Tracking format** - every TRK file has the `History` table with a `By` column and an `Activity` table (older files: propose adding them, empty; never back-fill guessed rows).
11. **Imported gaps** - list every `Missing - from import` field (report only; the user fills them).
12. **(you)** **CLAUDE.md block** ("Project instructions block" in rules.md) - `yes`: the block is in the right target file for the Workbench setting, only there, and matches `${CLAUDE_PLUGIN_ROOT}/templates/claude-md.md` exactly (an outdated block is refreshed from the template); `no`: no CLAUDE file has a foreman block.
13. **Interviews** - names follow `INT-NN-<slug>.md`; Status is `In Progress`, `Done`, or `Canceled`; a `Done` interview links an existing plan with the same number and slug, and that plan's Source Type is `interview`; no interview number is used by a different feature. List `In Progress` interviews (report only; `/foreman:interview INT-NN` continues them).

## 2. Report

Show a numbered list of findings. For each: file, problem, proposed fix. Mark fixes that need a judgement call (e.g. which of two conflicting statuses is correct, a missing task file) and ask the user how to resolve those instead of proposing a guess.

If nothing is wrong, say so and stop.

## 3. Fix after confirmation

Ask the user which fixes to apply with `AskUserQuestion`: all, none, or a list of numbers (typed with "Other"); judgement calls as separate questions. Apply only those. Read only the files you fix, and in them only the lines the fix needs. Never delete files, with one exception: leftover snapshot folders and session markers in `workbench/.baseline/` of tasks that are not `In Progress` (finding 8) are removed on confirmation with `wb.js refresh P-NN` (without Node: one shell command, as in "Snapshot" in rules.md). For an orphan file, ask whether to link it or leave it.

**Renumber** (duplicate feature number, finding 3): a judgement call. Ask which feature keeps the number (show both slugs and titles) and confirm the new number for the other (default: `wb.js next-number`, which also sees other git branches). Then `wb.js renumber P-NN <slug> [new number]` - it renames the feature's files and subtasks folder, rewrites its IDs and links, moves its INDEX row, and logs an Activity row; it refuses while a task of that feature is `In Progress`. Tell the user that version control sees the renames as deleted and new files, to commit with their next change; never stage or commit yourself. Record each status correction as a TRK History row with reason "doctor: <what was fixed>". Report what was fixed and what remains.
