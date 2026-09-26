---
description: Import plans, tasks, and progress from another workflow's local files into workbench/ (originals are never changed)
argument-hint: <path(s) to old workflow files or folders>
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), AskUserQuestion
---

# /foreman:import

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

Sources are local files only (md, txt, json, yaml, or any text). Never move, edit, or delete source files.

## 1. Prepare

1. If no path is given, ask for the folder(s) or file(s) of the old workflow. Check every path exists; ask about any that does not.
2. If `workbench/INDEX.md` does not exist, initialize it:
   - User defaults (set when the plugin was enabled; change with `/config`): output `${user_config.default_output}`, git `${user_config.default_git}`, fix rounds `${user_config.default_fix_rounds}`, CLAUDE.md block `${user_config.default_claude_md}`. A value that is empty, still shows the literal `${user_config...}` text, or is invalid counts as output `Concise`, git `ask`, fix rounds `4`, CLAUDE.md block `ask`.
   - Output and Fix rounds: use the defaults. Do not ask.
   - Git: use the default if it is `committed` or `ignored`. Do not ask. Only if it is `ask`: ask whether `workbench/` should be **committed** or **ignored**.
   - CLAUDE.md: use the default if it is `yes` or `no`. Do not ask. Only if it is `ask`: ask as in step 1.2 of `${CLAUDE_PLUGIN_ROOT}/commands/new.md`.
   - Create the folders and `INDEX.md`, update `.gitignore`, and write the CLAUDE.md block if `yes`, as in steps 1.3-1.6 of `${CLAUDE_PLUGIN_ROOT}/commands/new.md` (use only those steps from that file; its defaults are not filled in when read as a file).
   - Tell the user in one line which values were applied and that `/foreman:settings` changes them.
3. Next feature number = highest in INDEX + 1.

## 2. Scan and map

Read the sources (list folders first; read only text files that look like plans, tasks, specs, trackers, notes). Build a mapping:

- **Features**: group content into features. Each becomes one `P-NN`, numbered in the old workflow's order (or by date if no order).
- **Tasks**: each old task becomes `TASK-TT` in its feature (order kept, numbering from `01`). Old sub-steps of one task stay inside that task.
- **Statuses**: map old status words to foreman statuses. Obvious ones directly (todo/open/backlog → `Not Started`; doing/wip → `In Progress`; done/closed/complete → `Done`; dropped/wontfix → `Canceled`). For any other word, propose a mapping (e.g. blocked/waiting → `Hold`, review/testing → `In Progress`) for the user to confirm.
- **Fully finished features** (every task done): plan `Done`.
- **Content**: requirements, scope, decisions, acceptance criteria, dependencies, and completed-work notes from the sources.
- **Unassigned items**: content that fits no feature or task.

## 3. Preview (nothing written yet)

Show:
1. Table: `# | Old source | → P-NN <slug> | Tasks | Plan status | Contract status`.
2. Per feature, table: `Old task | → TASK-TT | Old status → New status`.
3. Proposed status mappings that need confirmation.
4. Unassigned items and gaps (e.g. no acceptance criteria, no scope).

Ask the user to confirm or correct. Apply corrections and re-show only what changed. Write nothing until the user confirms.

## 4. Write

Per feature, from the templates:
- **Plan**: Source `Type: import`, listing every source file used; other sections from the sources. Missing content: `Missing - from import` (never invent).
- **Contract**:
  - Unfinished feature: Status `Draft`. Scope, Out of Scope, Acceptance Criteria from the sources; Working Rules as in `/foreman:new` step 6 (ask the user once for all imported features, not per feature).
  - Fully finished feature: Status `Approved`, Approved = today, with a note line `Imported - completed before foreman`.
- **Tasks**: all mandatory sections; header Source = the old source file path. Fill from sources; fill Evidence and Files Expected to Change from the codebase where you can verify them; otherwise `Missing - from import`. Done tasks: summarize what was done in Required Outcome.
- **Tracking**: one row per task with its mapped status and note `imported`. History: one row per task and one for the plan, `— -> <status> | Main agent | Imported from <source path>`.
- **Doc**: Implemented Tasks from Done tasks (what, files, decisions if known). For a fully finished feature, also Summary, Architecture / Key Files, How to Extend; Acceptance: `Not verified - imported`.
- **INDEX**: one row per feature.

## 5. Report

One line per feature: `P-NN <slug> - <tasks> tasks, <status>`, plus the count of `Missing - from import` fields. Then:
- Run `/foreman:doctor` to check the result.
- Unfinished features need `/foreman:approve P-NN` before any `/foreman:run`; fill `Missing - from import` fields first (or via `/foreman:change`).
- Source files were not changed; the user can archive or delete them when ready.
