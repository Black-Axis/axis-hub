# Changelog - axis-hub marketplace

Changes to the marketplace itself (plugin list, repository docs, tooling). Each plugin keeps its own changelog in `plugins/<name>/CHANGELOG.md`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
