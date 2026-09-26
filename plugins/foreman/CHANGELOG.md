# Changelog - foreman

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
