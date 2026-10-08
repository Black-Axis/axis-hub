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

## GitHub issues

Every issue opened on `Black-Axis/axis-hub` gets, at creation:

- **Labels**: `bug` or `enhancement` (or another fitting label), plus the plugin label (e.g. `plugin: foreman`) or `marketplace`.
- **Type**: `Bug`, `Feature`, or `Task` (organization issue types).
- **Assignee**: `krypton225`.
- **Fields** (organization issue fields): `Priority` (`Urgent` / `High` / `Medium` / `Low`) and `Effort` (`High` / `Medium` / `Low`) always; `Start date` and `Target date` only when the user gives them. Propose the values with the issue and let the user correct them.

Write the body to a scratchpad file, then:

```
gh issue create --title "<title>" --body-file <file> --label <label> --type <Bug|Feature|Task> --assignee krypton225
```

Fields are set through GraphQL. Look up the issue node ID (`gh issue view <n> --json id`) and the field and option IDs (`gh api graphql -f query='{ organization(login:"Black-Axis"){ issueFields(first:20){ nodes{ __typename ... on IssueFieldSingleSelect { id name options{ id name } } ... on IssueFieldDate { id name } } } } }'`), then:

```
gh api graphql -f query='mutation($issue:ID!){ setIssueFieldValue(input:{issueId:$issue, issueFields:[{fieldId:"<Priority id>", singleSelectOptionId:"<option id>"}, {fieldId:"<Effort id>", singleSelectOptionId:"<option id>"}]}){ clientMutationId } }' -f issue=<issue node id>
```

Date fields use `dateValue: "YYYY-MM-DD"` instead of `singleSelectOptionId`.

## GitHub pull requests

Every pull request opened on `Black-Axis/axis-hub` gets:

- **Assignee**: `krypton225` (`gh pr create --assignee krypton225`).
- **Linked issues**: when the PR solves an issue, put a closing keyword line in the body for each one (`Closes #24`, `Fixes #25`). GitHub then lists the issue in the PR's **Development** section and closes it when the PR is merged. A PR that only partly solves an issue references it without a keyword (`Part of #24`) and is not linked.

```
gh pr create --base main --title "<title>" --body-file <file> --label <label> --assignee krypton225
```

After creating it, check the link: `gh pr view <n> --json closingIssuesReferences`.

## Structure

- `.claude-plugin/marketplace.json` lists every plugin with `"source": "./plugins/<name>"`. Adding a plugin = new `plugins/<name>/.claude-plugin/plugin.json` + an entry here. Keep `version`, `description`, and `keywords` in sync between the two manifests, and the version also in the root README plugin table and the plugin README's `Version X.Y.Z` line (all enforced by `tests/manifests.test.js`), and add a `## [version]` entry to the plugin's `CHANGELOG.md` for each version.
- Plugin commands are invoked namespaced: `commands/new.md` in `foreman` becomes `/foreman:new`; plugin agents become `<plugin>:<agent>` (e.g. `foreman:foreman-worker`).
- Inside command bodies, plugin-local files are referenced via `${CLAUDE_PLUGIN_ROOT}/...` and user input via `$ARGUMENTS`.

## foreman plugin architecture

`plugins/foreman` manages feature work in the *consumer* project's `workbench/` folder (not this repo). Key design points that span files:

- `reference/rules.md` is the single source of shared rules (folder layout, naming, statuses, approval gate, scope discipline). Every command starts by reading it — change cross-cutting behavior there, not in each command.
- `templates/*.md` define the exact sections of each generated file (INDEX, plan, contract, tracking, task, doc, report); commands fill `{{...}}` placeholders. Changing a section means updating the template and any command that reads/writes that section.
- Roles: the main agent (running the commands) owns all `workbench/` writes and all status changes; `agents/foreman-worker.md` (`model: sonnet`) implements exactly one task per `/foreman:run`, never edits `workbench/`, never commits, changes files only with Edit / Write (shell only for running commands, so every change reaches the user as a diff; `run.md` shows the diff of anything a command changed), and returns its report only to the main agent, which verifies (diff vs. Files Expected to Change / Out of Scope, runs tests) before marking done. Failed verification triggers automatic fix rounds (Revert / Not done / Wrong feedback) sent via SendMessage to the same worker, up to the INDEX `Fix rounds` setting (default 4), then `Hold`.
- Naming: one feature shares a 2-digit number and slug across `P-NN`, `CONT-NN`, `TRK-NN`, `DOC-NN`; tasks live in `subtasks/P-NN-<slug>/TASK-TT-*.md` with numbering restarting per plan.
- Lifecycle: `new` (feature from working file(s), text, or both → review findings resolved with user) or `interview` (deep tech-lead Q&A saved per round in `workbench/interviews/INT-NN-<slug>.md`, resumable; reserves the feature number, then reuses `new.md` steps to write the files) → contract `Draft` → `approve` → `run` one user-chosen task at a time → `change`: small changes (Scope / Out of Scope / Acceptance Criteria unchanged) are approved inline; big ones set contract `Amended Pending Approval` and block runs until re-approved. `run` accepts no args (proposes next ready task) or `TASK-TT` alone (single active plan). Task/plan statuses: `Not Started`, `In Progress`, `Hold`, `Done`, `Canceled`; every change is logged in the TRK History and reflected in INDEX progress.
- A plan becomes `Done` only via `/foreman:close` (acceptance criteria verified) or `/foreman:import` (finished before foreman); task completion alone leaves it `In Progress`. `doctor` enforces this through `Closed` / `Imported` History entries.
- `hooks/session-start.js` (Node, no dependencies) parses `workbench/` Markdown tables — `## Tasks` in TRK, `## Task Breakdown` in P, `- Status:` / `- Plan Status:` fields. Changing those template headings or fields requires updating the script. It must always exit 0.
- `skills/foreman-guide` only suggests commands; it must never run them.
- CLAUDE.md block: with INDEX `CLAUDE.md: yes`, the consumer project's `CLAUDE.md` (Workbench `tracked`) or `CLAUDE.local.md` (Workbench `ignored`) gets `templates/claude-md.md` between `<!-- foreman:start` / `<!-- foreman:end -->` markers. All rules (target file, AGENTS.md-only projects get `@AGENTS.md` first, never edit outside the markers) are in the "Project instructions block" section of `reference/rules.md`; `new`, `import`, `settings`, and `doctor` apply them. Keep the block short: it is loaded in every session of the user's project.
- Token efficiency is built in, not delegated to another plugin: the `Output` setting in INDEX (`Concise` default / `Normal`) and the "Output style" section of `reference/rules.md` govern replies, worker prompts/reports, and `workbench/` files. New commands inherit it by reading rules.md; `run.md` passes the setting to the worker.
- Settings: user-level defaults are `userConfig` in `plugin.json` (`default_output`, `default_git`, `default_fix_rounds`, `default_claude_md`), read via `${user_config.KEY}` in `init.md`, `new.md`, `interview.md`, and `import.md`, which then follow the shared `reference/setup.md` (`init` in Ask all mode: asks everything plus the INDEX `Working Rules Defaults`; the others in Auto mode: defaults applied without re-asking, only git and CLAUDE.md `ask` prompt). Substitution happens only when Claude Code loads the command, never when a file is opened with Read, so every command that needs the defaults must contain the placeholders itself and `setup.md` must contain none (`tests/foreman/commands.test.js`). Per-project values live in INDEX `Settings` and are changed by `/foreman:settings`, which also contains the placeholders: its menu shows each setting's current value next to its default (user default, else the built-in default in its table) and confirms a summary of changes and side effects before applying. `options` is deliberately not used on `userConfig` (it would block Claude Code < v2.1.271 from loading the plugin).
- Permissions: command `allowed-tools` must stay scoped to `Edit(workbench/**)`, `Write(workbench/**)`, and read-only version control (`git status/diff/ls-files/log`, `tf status/diff/history`), each as a `Bash(...)` and a `PowerShell(...)` rule. Broad `Edit`/`Write`/`Bash` there pre-approves the worker's edits too and bypasses the user's manual mode. Plugin agents can't set `permissionMode` (ignored for plugins). `allowed-tools` apply only in the turn the command runs and end with the user's next message (also reading `${CLAUDE_PLUGIN_ROOT}` files is then refused or prompts): commands read every plugin file they need before the first question and ask with `AskUserQuestion`, which keeps the turn ("Questions and follow-up turns" in `reference/rules.md`, enforced by `tests/foreman/commands.test.js`).
- Tracking: TRK History has a `By` column (`User` / `Main agent` / `Worker`); the TRK `Activity` table logs user decisions and worker/main-agent actions (rules in `reference/rules.md`). `run.md` pre-checks the task file before delegating (auto-fix small, ask on big): it diffs the task's files against the task header `Baseline` ("Task baseline" in rules.md), checks earlier Done tasks that touched the same files and the user's uncommitted changes, and runs baseline tests (contract `Baseline tests`, default yes) so only new failures count against the worker.
- Version control: INDEX `Version control: git | tfvc | none` (detected; `tfvc` = TFS / Azure DevOps Server TFVC) and `Workbench: tracked | ignored` (older name `Git: committed | ignored`, still read everywhere, including `hooks/session-start.js`). All per-VCS behavior (ignore file, change detection, check-in, read-only files, deletes/renames, snapshots in `workbench/.baseline/`) is in the "Version control" section of `reference/rules.md`; commands only point to it. Never assume git in a command: `tf.exe` may be missing, so every TFVC path has a no-`tf` fallback.
- Reporter: `/foreman:report` delegates to `agents/foreman-reporter.md` (tools Read, Grep, Glob; no Write, no shell). Path-only prompt (`Plan`, `Contract`, `Tracking`, `Doc`, `Output`); it reads only the sections in its table and returns `STATUS: ...` plus the finished report. The main agent saves it verbatim with `Write(workbench/reports/**)` (pre-approved in `report.md`) and never reads the feature files. Subagents don't get a command's `allowed-tools` pre-approvals, and the main agent loses them for the rest of the turn once it has called `Agent` (both tested on Claude Code 2.1.287, Manual mode); the `workbench-guard` hook covers the save.
- `hooks/workbench-guard.js` (PreToolUse on Edit / Write / MultiEdit / NotebookEdit / Bash / PowerShell, Node, run only if `node` exists): main agent's file edits inside `<project>/workbench/` → `allow` (also in follow-up turns and after `Agent`, which `allowed-tools` cannot cover); main agent's shell → `allow` only for the exact forms in rules.md (`mkdir -p` / `touch` in `workbench/`, `date`, snapshot `tar` copy + `.stamp`, `rm -rf` in `.baseline/`, and their PowerShell twins); subagent edits in `workbench/` → `deny` (the worker reports "Task File Updates" instead; the main agent applies them). No decision in plan mode, for a `workbench/` without `INDEX.md`, or when settings deny Edit / Write there (a hook `allow` overrides deny rules). If you change a shell form in rules.md, change the hook regex and `tests/foreman/workbench-guard.test.js` too. Must always exit 0.
- Worker prompt is path-only (`Task:`, `Contract:`, `Output:`, `Version control:` lines); the worker reads the files itself. Keep all worker instructions in `agents/foreman-worker.md`, never in the prompt. Fix rounds send only the feedback lists.
