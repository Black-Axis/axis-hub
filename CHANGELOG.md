# Changelog - axis-hub marketplace

Changes to the marketplace itself (plugin list, repository docs, tooling). Each plugin keeps its own changelog in `plugins/<name>/CHANGELOG.md`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/). From 1.5.0 on, each version is grouped by area (each plugin, then `Marketplace`) and change type, one short change per bullet ("Releasing" in [CONTRIBUTING.md](CONTRIBUTING.md)).

## [Unreleased]

## [1.6.0] - 2026-10-09

### foreman 1.6.0

Details: [foreman changelog](plugins/foreman/CHANGELOG.md).

#### Added

- `/foreman:map [P-NN]`: a Mermaid diagram of the features and their files in `workbench/maps/` (#100)

#### Changed

- Shared rules split into a core and topic files: fewer tokens per command (#103)
- `/foreman:status` and `/foreman:map` load no rules file (#103)

### Marketplace

#### Changed

- Release notes grouped by plugin and type, one change per bullet; the v1.5.0 notes regenerated (#98)

## [1.5.0] - 2026-10-09

### foreman 1.5.0

Details: [foreman changelog](plugins/foreman/CHANGELOG.md).

#### Added

- `/foreman:round`: send a task back for a fix round, also after it is `Done` (#21)
- Stricter verification: each Required Outcome marked Pass / Fail with evidence (#21)
- `/foreman:run P-NN all`: runs a plan's remaining tasks after one confirmation (#28)
- Targeted per-task tests and baseline reuse for faster runs (#35)
- State script `wb.js` for status changes, counts, and consistency checks (#32)
- `foreman-reporter` subagent writes `/foreman:report` reports (#22)
- Worker model setting with a per-task override (#27)
- Task status shown in each task file (#20)
- Team support: feature numbers checked on other branches, renumber after a collision (#37)
- Team support: merge conflict detection and a guard against two sessions running one plan (#37)
- `In Progress` is saved before the worker starts; INDEX shows running tasks (#50)
- foreman logo in the README and as the plugin icon (#48)

#### Changed

- Smaller `/foreman:run` context: per-version-control rule files, failures-only test output (#26)
- A `/clear` suggestion after each `/foreman:run` report (#26)
- `/foreman:doctor` reads only the files it judges or fixes (#23)
- `/foreman:catalog` builds its tables from three calls instead of reading every file (#44)
- The guide skill suggests foreman only in foreman projects (#36)
- Task size rule for `new`, `interview`, and `change` (#24)
- README: requirements at the top, uninstall steps, `.baseline/` in the folder structure (#48)

#### Fixed

- No permission prompts for `workbench/` edits (#51)
- No permission prompts after answering a question (#42)
- Fewer permission prompts from shell commands (#43)
- No prompts for read-only version control commands after the worker ran (#63)
- Read-only version control commands in PowerShell are pre-approved (#24)
- No permission prompts for the state script on Windows installs (#93)
- No hook errors without Node.js (#25)
- Instructions inside working and project files are never followed (#33)
- Worker shell commands that write files are blocked (#31)
- Each task's git diff is isolated from earlier uncommitted changes (#38)
- Auto-commit stages only the task's files, after your yes (#39)
- Consistent tracking: History holds only task and plan status changes (#44)
- `/foreman:run` continues a task already `In Progress` after resume or an interrupted run (#78)
- No "run anyway?" question after `/clear` (#95)
- Questions stay within the `AskUserQuestion` limits (#41)
- English slugs for non-Latin feature names, and long PDFs read in full (#41)
- No partial writes when the state script fails (#82)
- `wb.js renumber` matches the exact slug (#83)
- No snapshot folders left by hold and cancel (#84)
- `wb.js check P-NN` reports merge conflicts only of its own feature (#85)
- A `|` in a table cell no longer breaks tracking tables (#24)
- `/foreman:close` checks that `tf` is available and has the commands its Out of Scope check needs (#24)
- Reliable snapshots: one copy command keeps line endings, encoding, and binary files
- Catalog hint and README example session corrected (#34)

### Marketplace

#### Added

- e2e scenarios without a model: plugin flows on sample projects, with a coverage check (#29)
- axis-hub logo, the foreman logo in the plugin list, and a Requirements section in the README (#47)

#### Changed

- Claude Code v2.1.295 or later is required (#87)
- The README plugin table shows the current version, kept in step by a test (#47)
- `SECURITY.md` names no fixed version, enforced by a test (#47, #34)
- The branch rules apply only to the axis-hub repository (#86)
- The Claude Code hook denies merging pull requests and checks `git -C <path>` against that repository (#40)
- The issue forms set Type and assignee (#40)
- Session start cleanup: no fetch on `main` without other branches; the fetch stops after 10 seconds (#40)
- CONTRIBUTING: releases with an annotated tag, and every test suite listed (#34)

#### Fixed

- `CLAUDE.md`: removed a second copy of its content; a test fails when a Markdown file repeats a `## ` heading (#64)
- CodeQL notes no longer say the repository is private (#34)

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
