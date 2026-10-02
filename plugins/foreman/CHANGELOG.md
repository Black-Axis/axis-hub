# Changelog - foreman

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
