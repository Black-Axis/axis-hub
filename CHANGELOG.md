# Changelog - axis-hub marketplace

Changes to the marketplace itself (plugin list, repository docs, tooling). Each plugin keeps its own changelog in `plugins/<name>/CHANGELOG.md`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.5.0] - 2026-10-02

### Added

- `foreman`: `foreman-reporter` subagent writes `/foreman:report` reports (#22).
- `foreman`: no hook errors without Node.js (#25); `workbench/` changes no longer ask for permission (#51); `In Progress` is saved before the worker starts, and INDEX shows running tasks (#50).
- axis-hub logo at the top of the README, the foreman logo in the plugin list, and a Requirements section (#47).

### Changed

- `foreman` 1.5.0: no more permission prompts for plugin files and `workbench/` edits after answering a question, PowerShell read-only commands pre-approved, fewer shell prompts (#43), instructions inside working and project files never followed (#33), auto-commit only the task's files after your yes (#39), consistent tracking and a faster catalog (#44), worker shell file writes blocked (#31), each task's git diff isolated from earlier uncommitted changes (#38), no prompts for read-only version control commands after the worker ran (#63), new `/foreman:round` and stricter verification (#21), state script for status changes, counts, and consistency checks (#32), guide skill only in foreman projects (#36), escaped pipes in tables, reliable snapshots ([changelog](plugins/foreman/CHANGELOG.md)).
- README: current plugin version (a test now keeps it in step with the manifests) and a version-neutral pinned-tag example; `SECURITY.md` no longer names a fixed version (#47).
- `CLAUDE.md`: removed a second copy of the file's content, added by a scripted edit in #64; a new test (`tests/docs.test.js`) fails when a Markdown file repeats a `## ` heading.
- Repository tooling (#40): the Claude Code hook denies merging pull requests (`gh pr merge`, merge calls through `gh api`) and checks `git -C <path>` against that repository; the issue forms set Type and assignee; the session start cleanup skips the fetch on `main` with no other local branch, and the fetch stops after 10 seconds.
- Docs (#34): CONTRIBUTING releases with an annotated tag and lists every test suite; CodeQL notes no longer say the repository is private; `CLAUDE.md` lifecycle includes `init`. A new test fails when `SECURITY.md` names a fixed version.

## [1.4.0] - 2026-10-02

### Changed

- `foreman` 1.4.0: `/foreman:settings` menu with current values and defaults, and `reset` ([changelog](plugins/foreman/CHANGELOG.md)).

## [1.3.0] - 2026-10-02

### Changed

- `foreman` 1.3.0: TFVC and no-version-control support, task baselines and baseline tests in the run pre-check ([changelog](plugins/foreman/CHANGELOG.md)).

## [1.2.1] - 2026-10-02

### Changed

- `foreman` 1.2.1: the worker edits files only with Edit / Write, so every change is shown as a diff ([changelog](plugins/foreman/CHANGELOG.md)).

## [1.2.0] - 2026-09-27

### Changed

- `foreman` 1.2.0: new `/foreman:init` command and working rules defaults ([changelog](plugins/foreman/CHANGELOG.md)).

## [1.1.0] - 2026-09-27

### Changed

- `foreman` 1.1.0: new `/foreman:interview` command ([changelog](plugins/foreman/CHANGELOG.md)).

## [1.0.0] - 2026-09-26

### Added

- Marketplace with the `foreman` plugin ([changelog](plugins/foreman/CHANGELOG.md)).
- Repository docs: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, AUTHORS, LICENSE.
- `examples/foreman/` sample `workbench/`.
- Tests (`node --test`): manifests, foreman hook, Markdown links, release tooling.
- GitHub Actions: validation with a pinned Claude Code version, release on `vX.Y.Z` tags, CodeQL, and Dependabot for actions.
- Issue and pull request templates.
- Branch rules: `main` changes only through pull requests (GitHub ruleset), branches named `<type>/<short-name>`, enforced by git hooks (`.githooks/`) and a Claude Code hook (`.claude/`).
- `git finish` and a Claude Code session start hook: after a pull request is merged, switch to `main`, pull, and delete merged branches.
