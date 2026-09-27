# Changelog - foreman

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
