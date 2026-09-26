# Foreman Shared Rules

These rules apply to every `/foreman:*` command. The main agent (you) owns every file under `workbench/`. Subagents never edit `workbench/`.

## Folder layout (project root)

```
workbench/
├─ INDEX.md
├─ plans/P-NN-<slug>.md
├─ contracts/CONT-NN-<slug>.md
├─ tracking/TRK-NN-<slug>.md
├─ subtasks/P-NN-<slug>/TASK-TT-<task-slug>.md
├─ docs/DOC-NN-<slug>.md
└─ reports/REP-NN-<slug>.md      # created on demand by /foreman:report
```

## Naming

- One feature = one plan, one contract, one tracking file, one doc, one subtasks folder. All share the same number `NN` and the same `<slug>`.
- `NN` is the feature number, zero-padded to 2 digits (`01`, `02`, ... `99`, then `100`). Next number = highest number in `INDEX.md` + 1.
- `TT` is the task number inside its plan, zero-padded to 2 digits, starting at `01` for every plan.
- `<slug>` is lowercase kebab-case, ASCII letters, digits and hyphens only, max ~40 characters (e.g. `user-login`).
- Plan IDs are written `P-NN`, task IDs `TASK-TT`. A task is always addressed together with its plan: `P-01 TASK-03`.

## Templates

Create files from these templates, replacing every `{{...}}` placeholder:

- `${CLAUDE_PLUGIN_ROOT}/templates/INDEX.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/plan.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/contract.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/tracking.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/task.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/doc.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/report.md`

## Statuses

- Task and plan statuses: `Not Started`, `In Progress`, `Hold`, `Done`, `Canceled`.
- Contract statuses: `Draft`, `Approved`, `Amended Pending Approval`.
- Every status change of a task or plan must:
  1. Update the row in the TRK `Tasks` table (Status, Updated date, Note).
  2. Append a row to the TRK `History` table: date, target (`P-NN` or `TASK-TT`), `old -> new`, By (`User` if the user asked for it, otherwise `Main agent`), reason.
  3. Update the `Progress` column in `INDEX.md` as `<done>/<total excluding Canceled> Done`.
- Plan Status in TRK is derived: `In Progress` when any task is `In Progress` or `Done` (including when all tasks are `Done`); otherwise `Not Started`. Explicit `Hold`/`Canceled` of the whole plan overrides this. A plan becomes `Done` only through `/foreman:close`, after the contract's Acceptance Criteria are verified, or through `/foreman:import` for a feature already finished before foreman.
- You may set `Hold` or `Canceled` on your own (e.g. blocked, verification failed, task made obsolete), but always write the reason in History and tell the user.

## Activity log

Log in the feature's TRK `Activity` table (date, target, By, Type, details - one line each):
- **User decisions** (`User`, `Decision`): every answer or choice the user gives that affects the feature - feature review finding resolutions, working rules, contract approval, change request confirmation, proceed-anyway on dependencies, pre-check answers, cancel confirmations, import mapping confirmations. Details: the question in short and the answer.
- **Worker actions** (`Worker`, `Action`): per worker round - files changed, commands run (from the worker report).
- **Main agent actions** (`Main agent`, `Action`): task-file auto-fixes, test runs and results, commits (with hash), fix-round feedback sent.

## Permissions

Never work around the user's permission mode. Foreman commands pre-approve only edits inside `workbench/` and read-only git (`status`, `diff`, `ls-files`); every other edit and command - by you or the worker - goes through the user's normal permission prompts. Never suggest granting broader or session-wide permissions.

## Output style

Read `- Output:` in the INDEX `Settings` block. `Concise` (the default when missing or unclear) applies the rules below to all foreman work: replies to the user, questions, subagent prompts and reports, and every file written under `workbench/`. `Normal` means your usual style. This style applies only while running foreman commands, the worker, or the foreman-guide skill.

Concise rules:
- Lead with the result. No preamble, no restating the request, no narration of steps, no closing recap, no pleasantries or hedging.
- Short plain sentences. Prefer bullets and tables over paragraphs. One line per item.
- Never paste file content into chat that the user can open; give the path and the key facts.
- Questions to the user: short, one decision each, with options when possible.
- Files: bullets and tables, no padding prose. Keep every required section and every fact (evidence, criteria, reasons, dates) - cut words, never substance.
- Stakeholder reports: same brevity, plain words, no jargon or code.
- Research and tool use: search (Grep/Glob) before reading; read only the needed files or line ranges; never re-read a file already in context; no exploratory dumps.
- Never shorten: error messages (quote exactly), security warnings, and confirmations before destructive or irreversible actions.

## Dates

Use today's date in `YYYY-MM-DD`.

## Approval gate

No task may be run unless the contract Status is `Approved`.

## Scope discipline

Never change anything listed under a contract's or task's Out of Scope. If a need arises, stop and tell the user; suggest `/foreman:change`.
