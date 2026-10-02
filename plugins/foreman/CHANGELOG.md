# Changelog - foreman

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
