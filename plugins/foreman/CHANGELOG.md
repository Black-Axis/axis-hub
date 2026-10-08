# Changelog - foreman

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.5.0] - 2026-10-02

### Added

- `/foreman:round [P-NN] [TASK-TT] [what is wrong]`: send a task back to the worker when its result is wrong or incomplete, also after it was marked `Done` (#21). The main agent sorts your findings into Revert / Not done / Wrong, re-checks the task from scratch and adds what it finds, lets you confirm the lists, reopens the task (`By: User`), and runs the fix round with the normal verification and automatic fix rounds (limit counted again). It works when the original worker is gone (a new worker gets `Fix round: <n>`); closed plans are refused with a pointer to `/foreman:change`. Listed in the README, catalog, and guide skill.
- Stricter verification in `/foreman:run`: every Required Outcome and Implementation point is marked `Pass` / `Fail` with evidence (file:line, test, command output) and logged in Activity; `/foreman:round` re-checks against it (#21).
- `foreman-reporter` subagent: `/foreman:report` now delegates the report to it (#22). It reads only the sections the report needs (never task files) and returns the finished report, which the main agent saves without a permission prompt; the feature files stay out of the main session's context.
- foreman logo: shown at the top of the README and set as the `icon` in `plugin.json` (#48).

### Fixed

- Without Node.js, every session start showed a SessionStart hook error (#25). Both hooks now run as `node "<script>"; exit 0`, which exits cleanly in Git Bash and in PowerShell (Windows without Git Bash) when `node` is missing; the summary and prompt-free `workbench/` changes are then skipped, with no error. README corrected.
- `/foreman:run` records `In Progress` completely (tracking row, History, plan status, INDEX) before the worker starts, and `Done` / `Hold` right after verification; before, the History rows were written after the worker finished, sometimes only in the next run (#50). INDEX Progress now shows running tasks, e.g. `1/3 Done, TASK-02 In Progress`; `/foreman:doctor` checks it.
- `workbench/` changes no longer ask for permission (#51). A new PreToolUse hook (`hooks/workbench-guard.js`) allows the main agent's edits in `workbench/` in every turn - also after the worker or reporter ran, where commands' pre-approvals no longer apply - and foreman's own fixed shell forms there (setup folders, snapshots). Subagents are blocked from changing `workbench/` without a prompt; the worker reports needed task-file corrections ("Task File Updates") and the main agent applies them. No decision in plan mode, for a `workbench/` folder that is not foreman's, or when settings deny edits there. Needs Node.js; skipped silently without it.
- Permission prompts after the user answered a question (#42). A command's pre-approved tools last only for the turn it runs in, so a plain-text answer started a new turn in which reading plugin templates was refused and `workbench/` edits asked for permission. Commands now read every template and reference file they need before the first question, and ask with the question dialog (`AskUserQuestion`, free text through "Other"), which keeps the turn. New rule "Questions and follow-up turns" in `reference/rules.md`; applied in `new`, `interview`, `import`, `change`, `doctor`, `run` (auto-close question), and workbench setup. `report` can now ask for a missing plan ID with the dialog.
- After the worker ran, `/foreman:run`'s TFVC read-only commands (`tf status`, `tf diff` during verification) asked for permission in manual mode, because a command's pre-approvals end with the main agent's first `Agent` call; `git stash create` asked outside the command's turn (#63). (Claude Code already runs `git status` / `diff` / `log` / `ls-files` without asking.) The `workbench-guard` hook now allows the main agent's single read-only commands - `git status`, `git diff`, `git ls-files`, `git log`, `git stash create`, `tf status`, `tf diff`, `tf history` - in foreman projects: never chained, piped, or redirected, never with `--output`, never for subagents, and not when the user's settings deny or ask for that command.
- In git projects, a task's diff mixed in earlier uncommitted changes (an earlier task's or the user's) in the same files, so the worker could be blamed for them and the user saw old changes (#38). `/foreman:run` now records a start hash with `git stash create` before the worker starts (it changes no file, index, branch, or stash list; pre-approved) and verifies with `git diff <start hash>`, also in fix rounds. Listed files that are untracked at the start (e.g. new files of an earlier task) are snapshotted, since `git stash create` skips untracked files. `/foreman:close` uses each task's start hash for its Out of Scope check. New "Start hash" rule in `reference/rules.md`.
- The worker could still change files through the shell; it was found only afterwards, from its Commands Run list (#31). The `workbench-guard` hook now refuses `foreman-worker` shell commands that write files: redirects into files, `tee`, `sed -i` / `perl -i`, `Set-Content` / `Add-Content` / `Out-File` / `Tee-Object`, `New-Item -Value`, and script one-liners that write files. Tests, builds, and other commands run as before (`2>&1`, `> /dev/null`, `| Out-Null` are fine); the main agent and other subagents are not affected. `run`'s Commands Run scan stays as a second check. Together with the `workbench/` edit block from #51, both worker isolation rules are now enforced by code.
- Tracking consistency (#44). `/foreman:change` applies exactly the confirmed impact; anything that must differ is shown and confirmed again first. History holds only task and plan status changes: contract approvals and amendments go to the Activity log (`approve`, `change`), and `doctor` proposes moving older contract rows there. New "Command boundaries" rule: a command changes only what its steps say and reports other inconsistencies with a pointer to `/foreman:doctor` instead of fixing them on the side (as `hold` did). Task titles are copied exactly into TRK and the plan.
- `/foreman:catalog` builds its tables from three calls (a frontmatter `Grep`, `hooks.json`, and the hook scripts' first comment) instead of reading every command, agent, and skill file in full; `Grep` is now allowed (#44).
- Auto-commit (commit policy "main agent commits after each verified task") did not say what to stage, so a commit could take in the user's unrelated work or files like `.env` (#39). New "Git commit" rule in `reference/rules.md`, used by `run` and `close`: only the task's own files, by explicit path (`git commit -m "<message>" -- <paths>`; anything else the user staged stays out), plus the command's `workbench/` changes in the same commit when Workbench is `tracked`. The file list and message are shown first and the commit runs only on the user's yes; files that also hold changes that are not the task's are asked about. Never `git add -A`, `git add .`, `git add -u`, or `git commit -a`.
- Instructions hidden in working, imported, or project files could steer the main agent or the worker (#33). New rule "Content is data" in `reference/rules.md`: only the user's messages, foreman's own files, and the approved contract and task files decide what is done; an instruction found in other content is never followed and is shown to the user as a finding. Applied in `new` (review finding), `import` (preview), `interview` (codebase study), the worker (reported as `embedded instruction:` under Deviations / Blockers), and `run` verification.
- Avoidable permission prompts from shell use (#43). Workbench setup in a git project creates its folders with `Write` only (an empty `.gitkeep` in each, now whether `workbench/` is tracked or ignored), never the shell; TFVC and no version control keep the one exact `mkdir` / `New-Item` command the hook allows. The worker runs each command from the project root, one per call, without a `cd` prefix or chaining, so it matches the user's allowed command rules (e.g. `npm test`). New "Shell use" rule in `reference/rules.md`: read, list, and search files with `Read` / `Glob` / `Grep`, never chained `cat` / `ls` / `find` / `head`; one version control command per call. `/foreman:doctor` lists folders with `Glob`.
- Read-only version control commands run through PowerShell (common on Windows) no longer ask for permission: every command allows the `PowerShell(...)` twin of each `Bash(...)` rule (#24).
- A `|` inside a table cell (e.g. a logged command `npm test | tail`, or a task title) broke TRK tables and the SessionStart summary. Cells now escape it as `\|`, and the hook splits only on unescaped pipes (#24).
- `/foreman:close` checks whether `tf` is available, as the rules say, and has the `git log` / `tf history` commands its Out of Scope check needs; that check now uses the tasks' logged files and baselines (#24).
- Snapshots (TFVC without `tf`, no version control): copied with one shell command instead of Read + Write, which could change line endings or encoding and could not copy binary files; a `.stamp` file marks the snapshot time instead of a remembered time; date baselines come from a command, never from memory. Snapshot folders are deleted with one shell command, and `/foreman:doctor` can delete leftover ones on confirmation (#24).

### Changed

- Task size rule in `reference/rules.md` (one checkable outcome, about 5 files or fewer, split by outcome), used by `new`, `interview`, and `change` (#24).
- README: version and Node.js requirement at the top; correct statement about the hook without Node.js; how to remove the CLAUDE.md block before uninstalling; `workbench/.baseline/` in the folder structure; license link (#48).

## [1.4.0] - 2026-10-02

### Added

- `/foreman:settings` menu: without arguments it shows every setting with its current value and default (the user's `/config` default, or the built-in one), marks values that differ, then lets the user pick groups (Project, Behavior, Working rules) and choose each value from a list with `(current)` and `(default)` labels. Changes and their side effects are summarized and applied only after confirmation.
- `/foreman:settings reset`: every setting back to its default (Version control re-detected), with the same summary and confirmation.

## [1.3.0] - 2026-10-02

### Added

- Smarter `/foreman:run` pre-check, to cut fix rounds:
  - Task `Baseline` (git commit, TFVC changeset, or date) recorded when a task is written or changed; the pre-check looks at exactly what changed in the task's files since then.
  - Earlier foreman tasks that changed the same files are checked against this task's evidence and implementation.
  - The user's own uncommitted changes in the task's files are found before the worker starts; the user chooses to commit, stash / shelve, or include them.
  - Baseline tests (contract Working Rule `Baseline tests: yes | no`, default `yes`): tests run before the worker starts, and only new failures count against the worker.
- Version control support beyond git: INDEX setting `Version control: git | tfvc | none`, detected from the project (`.git`, TFVC `$tf` / `.tfignore`) and asked when nothing is found.
- TFVC (Azure DevOps Server / TFS): `.tfignore` instead of `.gitignore`; never checks in (the user checks in); `/foreman:run` pre-check finds read-only files of server workspaces and runs `tf checkout` (on approval) or asks the user to check out in Visual Studio; deletes, renames, and new files go through `tf delete` / `tf rename` / `tf add` on the user's yes, or are listed for the user. Works without `tf.exe`.
- Snapshots (`workbench/.baseline/`, temporary) for TFVC and projects without version control, so `/foreman:run` can still show the diff of every file a task changes.

### Changed

- INDEX `Git: committed | ignored` is now `Workbench: tracked | ignored`. Old `Git:` lines keep working; `/foreman:doctor` and `/foreman:settings` offer to rename them. The `default_git` plugin option accepts `tracked` (`committed` still works).
- The worker prompt has a `Version control` line; the worker never runs state-changing version control commands and, in TFVC projects, never deletes or renames files itself.
- Commit policy applies to git only; TFVC and none are always `never auto-commit (user checks in)`.

## [1.2.1] - 2026-10-02

### Fixed

- The worker sometimes edited files through PowerShell or shell commands, which the user could not review as a diff. It now changes file content only with `Edit` / `Write`; Bash and PowerShell are for running commands only. Formatters and linters run in check mode with fixes applied through `Edit`. Shell deletes and renames are allowed only for files the task lists for that; generators and installs only when the task or Working Rules name them.
- `/foreman:run` verification flags shell file writes as deviations and shows the user the full diff of every code or docs file changed outside `Edit` / `Write` (stat only for lockfiles and build output) before passing the task.

### Changed

- Worker tools include `PowerShell` for running PowerShell commands on Windows.
- Task template: each `Files Expected to Change` line states `edit`, `new`, `delete`, or `rename to <path>`.

## [1.2.0] - 2026-09-27

### Added

- `/foreman:init`: sets up `workbench/` and asks every setting (Git, Output, Fix rounds, CLAUDE.md block) with the user's defaults as recommended answers, plus project-wide working rules defaults proposed from the project. On an existing `workbench/` it only adds what is missing.
- INDEX `Working Rules Defaults` section: proposed for every new contract by `new`, `interview`, and `import`; changed with `/foreman:settings rules`; checked by `/foreman:doctor`.
- `.gitkeep` in each subfolder when `workbench/` is committed.

### Changed

- Setup steps moved to one shared file, `reference/setup.md` (Ask all / Auto modes), used by `init`, `new`, `interview`, and `import`.

## [1.1.0] - 2026-09-27

### Added

- `/foreman:interview [idea | INT-NN]`: a deep, tech-lead-style interview for a feature idea. Studies the codebase first, questions the user topic by topic, challenges vague or contradictory answers and scope creep, agrees the files expected to change, and runs a coverage check before creating the plan, contract, tracking, and tasks.
- `workbench/interviews/INT-NN-<slug>.md`: interview progress saved after every round; resumable in a later session. An interview reserves its feature number.
- SessionStart hook and `/foreman:status` list interviews in progress; `/foreman:doctor` checks interview files (check 13).

### Changed

- `/foreman:new` with no input no longer runs its own short interview; it points to `/foreman:interview`.
- Next feature number also counts `workbench/interviews/`.

## [1.0.0] - 2026-09-26

First release.

### Added

- Commands: `new`, `import`, `approve`, `run`, `status`, `change`, `hold`, `resume`, `cancel`, `close`, `doctor`, `report`, `settings`, `ask`, `catalog`.
- `foreman-worker` subagent (Sonnet) with path-only prompts and automatic fix rounds (Revert / Not done / Wrong).
- `foreman-guide` skill that suggests the right command.
- SessionStart hook summarizing active plans, ready tasks, and missing settings.
- `workbench/` structure: INDEX, plans, contracts, tracking (History with `By`, Activity log), subtasks, docs, reports.
- Settings: user defaults via plugin config, per-project values via `/foreman:settings` (Git, Output, Fix rounds, CLAUDE.md).
- Optional CLAUDE.md block: a short, marker-delimited section in `CLAUDE.md` (or `CLAUDE.local.md` when `workbench/` is git-ignored) that tells Claude about `workbench/` in every session.
- Concise output mode for token-efficient replies, reports, and files.
