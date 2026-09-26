# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`axis-hub` is a Claude Code plugin marketplace (owner Black-Axis). There is no build, lint, or test toolchain — plugins are Markdown instruction files plus JSON manifests. It is hosted on GitHub (`Black-Axis/axis-hub`, remote `repo`); contributions go there only.

## Commands

```
claude plugin validate .                     # validate marketplace.json
claude plugin validate plugins/<name>        # validate a plugin's plugin.json
claude --plugin-dir plugins/<name>           # load a plugin without installing (restart to pick up edits)
node --test                                  # all tests (manifest sync, changelog entries, foreman hook)
node --test tests/foreman/session-start.test.js   # a single test file
```

CI (`.github/workflows/validate.yml`) runs the validations and `node --test` on PRs and pushes to `main`, with Claude Code pinned by `CLAUDE_CODE_VERSION` (keep it equal in `validate.yml` and `release.yml`; a test enforces this). `release.yml` runs on `vX.Y.Z` tags, which must match `metadata.version` in `marketplace.json`, and builds release notes from the root `CHANGELOG.md` via `.github/scripts/release-notes.js`. `tests/links.test.js` fails on broken relative Markdown links (plugin templates are skipped). `examples/foreman/workbench/` is both user-facing sample and the hook test fixture — keep it in step with `plugins/foreman/templates/`.

Marketplace-level test inside Claude Code: `/plugin marketplace add <repo path>`, `/plugin install <name>@axis-hub`; after edits `/plugin marketplace update axis-hub` and restart the session.

## Branches

Never commit on `main` or push to it; `main` changes only through pull requests (GitHub ruleset in `.github/rulesets/main.json`, requires the `validate` check). Before changing anything, create a branch `<type>/<short-name>` (`feat`, `fix`, `docs`, `test`, `ci`, `chore`, `refactor`; kebab-case, e.g. `feat/foreman-bug-command`). The rules live in `.githooks/guard.js`, used by the git hooks (`git config core.hooksPath .githooks`) and by the PreToolUse hook `.claude/hooks/guard-git.js`, which denies Claude's git commands that break them. GitHub deletes merged branches automatically; locally, `.githooks/finish.js` (`git finish`, and the SessionStart hook `.claude/hooks/finish-on-start.js`) switches to `main`, pulls, and deletes merged branches (tip contained in `main` and PR `MERGED` via `gh`, or upstream deleted). It must never delete unmerged work or act with uncommitted changes; `tests/git-finish.test.js` covers this.

## Structure

- `.claude-plugin/marketplace.json` lists every plugin with `"source": "./plugins/<name>"`. Adding a plugin = new `plugins/<name>/.claude-plugin/plugin.json` + an entry here. Keep `version`, `description`, and `keywords` in sync between the two manifests (enforced by `tests/manifests.test.js`), and add a `## [version]` entry to the plugin's `CHANGELOG.md` for each version.
- Plugin commands are invoked namespaced: `commands/new.md` in `foreman` becomes `/foreman:new`; plugin agents become `<plugin>:<agent>` (e.g. `foreman:foreman-worker`).
- Inside command bodies, plugin-local files are referenced via `${CLAUDE_PLUGIN_ROOT}/...` and user input via `$ARGUMENTS`.

## foreman plugin architecture

`plugins/foreman` manages feature work in the *consumer* project's `workbench/` folder (not this repo). Key design points that span files:

- `reference/rules.md` is the single source of shared rules (folder layout, naming, statuses, approval gate, scope discipline). Every command starts by reading it — change cross-cutting behavior there, not in each command.
- `templates/*.md` define the exact sections of each generated file (INDEX, plan, contract, tracking, task, doc, report); commands fill `{{...}}` placeholders. Changing a section means updating the template and any command that reads/writes that section.
- Roles: the main agent (running the commands) owns all `workbench/` writes and all status changes; `agents/foreman-worker.md` (`model: sonnet`) implements exactly one task per `/foreman:run`, never edits `workbench/`, never commits, and returns its report only to the main agent, which verifies (diff vs. Files Expected to Change / Out of Scope, runs tests) before marking done. Failed verification triggers automatic fix rounds (Revert / Not done / Wrong feedback) sent via SendMessage to the same worker, up to the INDEX `Fix rounds` setting (default 4), then `Hold`.
- Naming: one feature shares a 2-digit number and slug across `P-NN`, `CONT-NN`, `TRK-NN`, `DOC-NN`; tasks live in `subtasks/P-NN-<slug>/TASK-TT-*.md` with numbering restarting per plan.
- Lifecycle: `new` (feature from working file(s), text, both, or interview → review findings resolved with user) → contract `Draft` → `approve` → `run` one user-chosen task at a time → `change`: small changes (Scope / Out of Scope / Acceptance Criteria unchanged) are approved inline; big ones set contract `Amended Pending Approval` and block runs until re-approved. `run` accepts no args (proposes next ready task) or `TASK-TT` alone (single active plan). Task/plan statuses: `Not Started`, `In Progress`, `Hold`, `Done`, `Canceled`; every change is logged in the TRK History and reflected in INDEX progress.
- A plan becomes `Done` only via `/foreman:close` (acceptance criteria verified) or `/foreman:import` (finished before foreman); task completion alone leaves it `In Progress`. `doctor` enforces this through `Closed` / `Imported` History entries.
- `hooks/session-start.js` (Node, no dependencies) parses `workbench/` Markdown tables — `## Tasks` in TRK, `## Task Breakdown` in P, `- Status:` / `- Plan Status:` fields. Changing those template headings or fields requires updating the script. It must always exit 0.
- `skills/foreman-guide` only suggests commands; it must never run them.
- Token efficiency is built in, not delegated to another plugin: the `Output` setting in INDEX (`Concise` default / `Normal`) and the "Output style" section of `reference/rules.md` govern replies, worker prompts/reports, and `workbench/` files. New commands inherit it by reading rules.md; `run.md` passes the setting to the worker.
- Settings: user-level defaults are `userConfig` in `plugin.json` (`default_output`, `default_git`, `default_fix_rounds`), read in `new.md` and `import.md` via `${user_config.KEY}` with a fallback if unsubstituted (substitution happens only when Claude Code loads the command, never when a file is opened with Read, so every command that needs the defaults must contain the placeholders itself); defaults are applied without re-asking (only git `ask` prompts); per-project values live in INDEX `Settings` and are changed by `/foreman:settings`. `options` is deliberately not used on `userConfig` (it would block Claude Code < v2.1.271 from loading the plugin).
- Permissions: command `allowed-tools` must stay scoped to `Edit(workbench/**)`, `Write(workbench/**)`, and read-only git. Broad `Edit`/`Write`/`Bash` there pre-approves the worker's edits too and bypasses the user's manual mode. Plugin agents can't set `permissionMode` (ignored for plugins).
- Tracking: TRK History has a `By` column (`User` / `Main agent` / `Worker`); the TRK `Activity` table logs user decisions and worker/main-agent actions (rules in `reference/rules.md`). `run.md` pre-checks the task file before delegating (auto-fix small, ask on big).
- Worker prompt is path-only (`Task:`, `Contract:`, `Output:` lines); the worker reads the files itself. Keep all worker instructions in `agents/foreman-worker.md`, never in the prompt. Fix rounds send only the feedback lists.
