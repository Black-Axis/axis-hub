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
├─ interviews/INT-NN-<slug>.md   # created by /foreman:interview
├─ .baseline/P-NN/TASK-TT/...    # temporary file snapshots during /foreman:run (tfvc without tf, none)
└─ reports/REP-NN-<slug>.md      # created on demand by /foreman:report
```

## Naming

- One feature = one plan, one contract, one tracking file, one doc, one subtasks folder. All share the same number `NN` and the same `<slug>`.
- `NN` is the feature number, zero-padded to 2 digits (`01`, `02`, ... `99`, then `100`). Next number = highest number in `INDEX.md` or in `workbench/interviews/` + 1.
- An interview `INT-NN-<slug>` reserves its number and slug: the plan it creates uses the same `NN` and `<slug>`. A canceled interview's number stays used.
- `TT` is the task number inside its plan, zero-padded to 2 digits, starting at `01` for every plan.
- `<slug>` is lowercase kebab-case, ASCII letters, digits and hyphens only, max ~40 characters (e.g. `user-login`).
- Plan IDs are written `P-NN`, task IDs `TASK-TT`. A task is always addressed together with its plan: `P-01 TASK-03`.

## Setup

`workbench/` is created by `/foreman:init` (asks every setting and the working rules defaults) or, when missing, automatically by `/foreman:new`, `/foreman:interview`, and `/foreman:import` from the user's defaults. The steps are in `${CLAUDE_PLUGIN_ROOT}/reference/setup.md`. `.gitkeep` files in subfolders are not feature files.

## Version control

INDEX `Settings` holds two lines:
- `- Version control: git | tfvc | none` - the project's version control. `tfvc` is Team Foundation Version Control (Azure DevOps Server / TFS).
- `- Workbench: tracked | ignored` - whether `workbench/` is kept in version control. The older line `- Git: committed | ignored` means the same (`committed` = `tracked`): read it as `Workbench`; `/foreman:doctor` offers to rename it.

**Detection** (setup, doctor, and any command that finds the `Version control` line missing): a `.git` folder or file in the project root or a parent folder → `git`; a `$tf` or `.tf` folder (TFVC local workspace) or a `.tfignore` file in the root or a parent folder → `tfvc`; otherwise `none`. TFVC server workspaces leave no marker: when the result is `none`, ask the user (`git` / `tfvc` / `none`). When the line is missing, add the detected value and tell the user in one line.

**`tf` availability** (tfvc only): at the start of `/foreman:run` and `/foreman:close`, run `tf status` once. If the command is not found or fails, `tf` is unavailable for that run: use snapshots and ask the user for source control actions.

| Operation | git | tfvc | none |
|-----------|-----|------|------|
| Ignore file (Workbench `ignored`, `CLAUDE.local.md`) | `.gitignore` (`workbench/`, `CLAUDE.local.md`) | `.tfignore` (`\workbench`, `\CLAUDE.local.md`) | nothing to ignore |
| Empty subfolders | `.gitkeep` in each when `tracked` | not needed (TFVC versions folders) | not needed |
| Start state of a task | `git status --porcelain`, `git diff --stat` | `tf status` (if available), and a snapshot | snapshot |
| Changes of a task | `git diff`, new untracked files from `git status` | `tf diff /format:unified` and `tf status` (if available), otherwise the snapshot | the snapshot |
| Commit after a task | as the contract's commit policy says | never: the user checks in | never |
| Read-only files | - | possible (server workspace): see pre-check in `/foreman:run` | - |
| Deletes and renames | worker, listed files only | main agent: `tf delete` / `tf rename` if `tf` is available, on the user's yes; otherwise the user does it in Visual Studio | worker, listed files only |
| New files | - | `tf add` if `tf` is available, on the user's yes; otherwise list them for the user to add | - |

In `tfvc` and `none` projects, the contract's Commit policy is always `never auto-commit (user checks in)`; do not ask about it.

Never run version control commands that change state (commit, check-in, shelve, checkout, add, delete, rename, undo) except where this table and the command files say so, and then only after telling the user. Read-only commands (`git status`, `git diff`, `git log`, `git ls-files`, `tf status`, `tf diff`, `tf history`, and read-only file listings for modification times) are always fine.

**Task baseline** - the project state a task file was written against, in the task header `Baseline` row. Every command that creates a task file or rewrites its Evidence, Files Expected to Change, or Implementation (`new`, `interview`, `import`, `change`, the `run` pre-check) sets it:
- git: the current commit, `git log -1 --format=%H`.
- tfvc with `tf`: the latest changeset, `C<number>` from `tf history . /recursive /stopafter:1 /noprompt`.
- tfvc without `tf`, and none: the current date and time, `YYYY-MM-DD HH:MM`, taken from a command (`date '+%Y-%m-%d %H:%M'`, or PowerShell `Get-Date -Format 'yyyy-MM-dd HH:mm'`), never from memory.

To see what changed in a task's files since its baseline:
- git: `git log --oneline <hash>..HEAD -- <files>` and `git diff <hash> -- <files>` (includes uncommitted changes).
- tfvc with `tf`: `tf history <file> /version:C<n+1>~T /noprompt` per file, and `tf status <files>` for pending changes.
- date baseline (or a value of another version control): the files' modification times compared with the baseline time (read-only command, as for snapshots). This shows that a file changed, not how; read it again in full.
A missing or unreadable baseline (tasks created before 1.3.0): use the task's Created date as a date baseline.

**Snapshot** (tfvc without `tf`, and none): before the worker starts, copy every existing file in the task's `Files Expected to Change` to `workbench/.baseline/P-NN/TASK-TT/<same relative path>` and create the stamp file `.stamp` there; its modification time is the snapshot time. Do it with one shell command (the user's normal permission prompt applies), never with Read + Write, which can change line endings, a BOM, or the encoding, cannot copy binary files, and loads every file into context:
- shell: `mkdir -p <dir> && tar cf - <files> | tar xf - -C <dir> && touch <dir>/.stamp`
- PowerShell: `foreach ($f in @('<file>', ...)) { $d = Join-Path '<dir>' $f; New-Item -ItemType Directory -Force (Split-Path $d) | Out-Null; Copy-Item $f $d }; New-Item -ItemType File '<dir>/.stamp' | Out-Null`

Afterwards:
- Diff each listed file against its copy (`diff -u <copy> <file>` if a `diff` command exists; otherwise compare them yourself and show the changed lines in unified diff form). A listed file with no copy is new: show it in full.
- Find files changed outside the list: list files modified after the stamp with a read-only command (`find . -newer <dir>/.stamp -type f`, or PowerShell `Get-ChildItem -Recurse -File | Where-Object LastWriteTime -gt (Get-Item '<dir>/.stamp').LastWriteTime`), excluding `workbench/` and dependency and build folders. Without version control this cannot see deleted files or every change; tell the user once per task that changes outside the list are checked by modification time only.
- Delete `workbench/.baseline/P-NN/TASK-TT/` when the task leaves `In Progress`, with one shell command (`rm -rf <dir>`, or PowerShell `Remove-Item -Recurse -Force '<dir>'`; the user's normal permission prompt applies). Keep `workbench/.baseline/` out of version control (add it to the ignore file when Workbench is `tracked`).

## Templates

In every Markdown table cell written under `workbench/`, write a literal `|` as `\|` (e.g. `npm test \| tail`), so the row keeps its columns; `hooks/session-start.js` reads `\|` as part of the cell.

Create files from these templates, replacing every `{{...}}` placeholder:

- `${CLAUDE_PLUGIN_ROOT}/templates/INDEX.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/plan.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/contract.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/tracking.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/task.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/doc.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/report.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/interview.md`
- `${CLAUDE_PLUGIN_ROOT}/templates/claude-md.md` (the project instructions block, see below)

## Project instructions block

The INDEX setting `- CLAUDE.md: yes | no` controls a short block that tells Claude about `workbench/` in every session of the project. The block is the full content of the `claude-md.md` template, from `<!-- foreman:start` to `<!-- foreman:end -->`. Never change text outside these markers.

- **Target file**: if Workbench is `tracked`, the project's shared instructions: `CLAUDE.md` at the project root, or `.claude/CLAUDE.md` if that exists and the root one does not. If Workbench is `ignored`, the personal `CLAUDE.local.md` at the project root, and add `CLAUDE.local.md` to the ignore file of the project's version control (see "Version control"; no duplicate line).
- **AGENTS.md projects**: if the project has an `AGENTS.md` and none of `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, creating a CLAUDE file makes Claude Code stop reading `AGENTS.md`. Tell the user and ask: create the file starting with the line `@AGENTS.md` (keeps AGENTS.md loaded - recommended), or do not add the block (set `CLAUDE.md: no`). Never write the block into `AGENTS.md`.
- **Write (`yes`)**: if the target file has the markers, replace everything between and including them with the template; otherwise append the block at the end, after one blank line (create the file if missing). Remove a foreman block from the other CLAUDE file if one is there.
- **Remove (`no`)**: delete the block, markers included, from every CLAUDE file that has one. If a file is left empty (or only `@AGENTS.md` that foreman added), ask before deleting the file.
- These files are outside `workbench/`: the user's normal permission prompt applies. Tell the user in one line which file was changed.

## Statuses

- Task and plan statuses: `Not Started`, `In Progress`, `Hold`, `Done`, `Canceled`.
- Contract statuses: `Draft`, `Approved`, `Amended Pending Approval`.
- Interview statuses: `In Progress`, `Done` (plan created), `Canceled`. Interviews are not in the INDEX features table until their plan exists.
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

Never work around the user's permission mode. Foreman commands pre-approve only edits inside `workbench/` and read-only version control commands (`git status`, `git diff`, `git ls-files`, `git log`, `tf status`, `tf diff`, `tf history`, through Bash or PowerShell); every other edit and command - by you or the worker - goes through the user's normal permission prompts. Never suggest granting broader or session-wide permissions.

Every change to a code or docs file must reach the user as a diff. The worker therefore changes files only with `Edit` / `Write` (shell only for running commands; rules in `${CLAUDE_PLUGIN_ROOT}/agents/foreman-worker.md`), and `/foreman:run` shows the diff of any file a command changed.

## Questions and follow-up turns

A command's `allowed-tools` apply only in the turn the command was run in; they end when the user sends the next message. After that, reading plugin files and editing `workbench/` go through the user's permission prompts. So:

- **Read first.** Before the first question, read every plugin file the command will need later (`${CLAUDE_PLUGIN_ROOT}/...`: templates, `reference/setup.md`, other command files it follows). Files already read stay in context; never re-read them in a later turn.
- **Ask with `AskUserQuestion`.** It keeps the command's turn, so its permissions stay. Use it for every question, including open ones: the user types free text with "Other". At most 4 questions per call (2-4 options each); for more, use several calls in a row.
- **Plain-text questions** only when `AskUserQuestion` is not available or fails. End that message with one line: "Your answer continues in a new turn: `workbench/` edits may ask for permission." Then continue normally after the answer; never work around a prompt. If a needed plugin file is not in context and its read is refused, stop, name the file, and tell the user to run the command again or allow the read.

## Output style

Read `- Output:` in the INDEX `Settings` block. `Concise` (the default when missing or unclear) applies the rules below to all foreman work: replies to the user, questions, subagent prompts and reports, and every file written under `workbench/`. `Normal` means your usual style. This style applies only while running foreman commands, the worker, or the foreman-guide skill.

Concise rules:
- Lead with the result. No preamble, no restating the request, no narration of steps, no closing recap, no pleasantries or hedging.
- Short plain sentences. Prefer bullets and tables over paragraphs. One line per item.
- Never paste file content into chat that the user can open; give the path and the key facts.
- Questions to the user: short, one decision each, with options when possible (asked as in "Questions and follow-up turns").
- Files: bullets and tables, no padding prose. Keep every required section and every fact (evidence, criteria, reasons, dates) - cut words, never substance.
- Stakeholder reports: same brevity, plain words, no jargon or code.
- Research and tool use: search (Grep/Glob) before reading; read only the needed files or line ranges; never re-read a file already in context; no exploratory dumps.
- Never shorten: error messages (quote exactly), security warnings, confirmations before destructive or irreversible actions, and the diffs `/foreman:run` must show for files changed outside `Edit` / `Write`.

## Dates

Use today's date in `YYYY-MM-DD`.

## Approval gate

No task may be run unless the contract Status is `Approved`.

## Task size

A task must fit one worker run and be verifiable on its own:
- One clear outcome that a test, a command, or a short check can confirm.
- About 5 files or fewer in `Files Expected to Change` (tests included). Split a bigger task by outcome (e.g. data, logic, UI, tests), with `Depends On` between the parts.
- No task that only prepares work for another one without a checkable result of its own.

## Scope discipline

Never change anything listed under a contract's or task's Out of Scope. If a need arises, stop and tell the user; suggest `/foreman:change`.
