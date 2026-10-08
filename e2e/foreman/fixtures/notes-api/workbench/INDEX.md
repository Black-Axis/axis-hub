# Foreman Index

## Settings

- Version control: git
- Workbench: tracked
  <!-- whether workbench/ is kept in version control -->
- Output: Concise
  <!-- Concise (default) | Normal - style of all foreman replies, reports, and files -->
- Fix rounds: 2
  <!-- times the main agent sends failed-verification feedback back to the worker before Hold; 0 = none -->
- CLAUDE.md: no
  <!-- yes = a short foreman block in CLAUDE.md (Workbench tracked) or CLAUDE.local.md (Workbench ignored) tells Claude about workbench/ -->

- Created: 2026-10-01

## Working Rules Defaults

<!-- proposed for every new contract's Working Rules; set by /foreman:init, changed by /foreman:settings rules -->
- Commit policy: never auto-commit
- Auto-close: Ask
- Tests: `npm test`
- Baseline tests: yes
- Full tests: close
- Standards: CommonJS, 2-space indent, single quotes, semicolons; node:test specs in `spec/`; no new dependencies
- Ask the user when: a new dependency is needed; a route or response shape changes

## Features

| # | Feature | Plan | Contract | Tracking | Doc | Contract Status | Progress |
|---|---------|------|----------|----------|-----|-----------------|----------|
| 01 | Health check | [P-01](plans/P-01-health-check.md) | [CONT-01](contracts/CONT-01-health-check.md) | [TRK-01](tracking/TRK-01-health-check.md) | [DOC-01](docs/DOC-01-health-check.md) | Approved | 2/2 Done |
| 02 | Search notes | [P-02](plans/P-02-search-notes.md) | [CONT-02](contracts/CONT-02-search-notes.md) | [TRK-02](tracking/TRK-02-search-notes.md) | [DOC-02](docs/DOC-02-search-notes.md) | Approved | 1/3 Done |
| 03 | Note stats | [P-03](plans/P-03-note-stats.md) | [CONT-03](contracts/CONT-03-note-stats.md) | [TRK-03](tracking/TRK-03-note-stats.md) | [DOC-03](docs/DOC-03-note-stats.md) | Draft | 0/1 Done |
