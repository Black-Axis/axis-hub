# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`axis-hub` is a Claude Code plugin marketplace (owner Black-Axis). There is no build, lint, or test toolchain — plugins are Markdown instruction files plus JSON manifests. It is hosted on GitHub (`Black-Axis/axis-hub`); contributions go there only. Committed files never name a git remote (clones differ): use the upstream, or the remote whose URL is `Black-Axis/axis-hub`.

## Commands

```
node scripts/check-all.js [test files]       # all checks below (tests incl. e2e, validations): one line each + failures only
claude plugin validate .                     # validate marketplace.json
claude plugin validate plugins/<name>        # validate a plugin's plugin.json
claude --plugin-dir plugins/<name>           # load a plugin without installing (restart to pick up edits)
node --test                                  # all tests (manifest sync, changelog entries, foreman hook)
node --test tests/foreman/session-start.test.js   # a single test file
node e2e/run.js [plugin] [scenario]          # e2e flows on sample projects, no model
node scripts/context-budget.js [--base main] # foreman commands near their context budget or changed vs main
node scripts/ci-watch.js pr <n> | branch <name> | tag <name>   # wait for CI, one line per workflow and CodeQL alert
```

Run these checks through the `axis-test-runner` subagent (`.claude/agents/`), which returns failures only; `.claude/settings.json` allows `check-all.js`, `e2e/run.js`, `context-budget.js`, `ci-watch.js`, and `issue-fields.js` without a prompt (nothing broader). For locate questions (where is X, what reads Y, which test covers Z) use the `axis-investigator` subagent: `file:line` rows instead of file dumps. After a change to documented behavior, `axis-docs-sync` lists the stale doc lines (and fixes them when the prompt says `Edit: yes`). The repo's own subagents and skills use `axis-` names (`tests/repo-claude.test.js`).

CI (`.github/workflows/validate.yml`) runs the validations and `node --test` on PRs and pushes to `main`, with Claude Code pinned by `CLAUDE_CODE_VERSION` (keep it equal in `validate.yml` and `release.yml`; a test enforces this). `release.yml` runs on `vX.Y.Z` tags, which must match `metadata.version` in `marketplace.json`, and builds release notes from the root `CHANGELOG.md` via `.github/scripts/release-notes.js`. `tests/links.test.js` fails on broken relative Markdown links (plugin templates are skipped). `examples/foreman/workbench/` is both user-facing sample and the hook test fixture — keep it in step with `plugins/foreman/templates/`.

Paid live checks (`claude -p` with a plugin from this repo, in a scratch project under the OS temp folder): ask the user before each run, then hand the checks (name, prompt file, expectation, options) to the `axis-live-check` subagent, which runs `node scripts/live-check.js` (budget cap, default model `haiku`; never allowed in settings, so each run prompts) and returns one verdict line per check.

Marketplace-level test inside Claude Code: `/plugin marketplace add <repo path>`, `/plugin install <name>@axis-hub`; after edits `/plugin marketplace update axis-hub` and restart the session.

## e2e scenarios

`e2e/` plays each plugin's flows on a sample project without a model (`node e2e/run.js`; also part of `node --test` and CI). **Anything added to or changed in a plugin - command, agent, skill, hook script, `wb.js` subcommand, template, check, hook decision - gets an e2e scenario or scenario step in the same PR**; a coverage test fails for any component no scenario `covers`. Details: [e2e/CLAUDE.md](e2e/CLAUDE.md). Give the plugin, the changed file paths, and a one-line description (no pasted diff) to the `axis-e2e-writer` subagent: it writes the steps (edits only `e2e/`, guarded by `.claude/hooks/e2e-writer-guard.js`), runs them, and returns the changed files and a pass/fail line.

## Branches

Never commit on `main` or push to it; `main` changes only through pull requests (ruleset `.github/rulesets/main.json`, requires the `validate` check). Before changing anything, create a branch `<type>/<short-name>` from an up-to-date `main` (the user runs `/axis-new-branch`; types and naming in `.githooks/guard.js`, e.g. `feat/foreman-bug-command`). The user merges: the PreToolUse hook `.claude/hooks/guard-git.js` denies Claude's git commands that break these rules and any pull request merge (the rules are in `.githooks/guard.js`, also used by the git hooks; details in both files' comments). After a merge, `git finish` (`.githooks/finish.js`, also run by the SessionStart hook `.claude/hooks/finish-on-start.js`) switches to `main`, pulls, and deletes merged branches. It must never delete unmerged work or act with uncommitted changes (`tests/git-finish.test.js`).

## GitHub issues and pull requests

The user opens them with `/axis-new-issue` and `/axis-open-pr`: both propose every value and ask first, then hand the confirmed values to the `axis-issue-creator` / `axis-pr-opener` subagents. The main agent may call those subagents itself after the user confirmed the values in chat. Before a pull request, the `axis-reviewer` subagent reviews the branch against the repo rules (`/axis-open-pr` runs it); after it, `axis-ci-watcher` waits in the background for the CI runs and CodeQL alerts of a PR, branch, or tag. The rules:

- **Issues**: labels `bug` or `enhancement` (or another fitting one) plus `plugin: <name>` or `marketplace`; Type `Bug` / `Feature` / `Task`; assignee `krypton225`; a milestone; fields `Priority` (`Urgent` / `High` / `Medium` / `Low`) and `Effort` (`High` / `Medium` / `Low`) always, `Start date` / `Target date` only when the user gives them (`node .github/scripts/issue-fields.js`). Propose the values and let the user correct them. The issue forms in `.github/ISSUE_TEMPLATE/` set labels, Type, and assignee for issues opened on the web.
- **Pull requests**: assignee `krypton225`; labels as for issues, never `documentation`; the issues' milestone; a closing keyword line per solved issue (`Closes #24`; `Part of #24` for a partial fix, which is not linked), checked with `gh pr view <n> --json closingIssuesReferences`.

## Structure

- `.claude-plugin/marketplace.json` lists every plugin with `"source": "./plugins/<name>"`. Adding a plugin = new `plugins/<name>/.claude-plugin/plugin.json` + an entry here. Keep `version`, `description`, and `keywords` in sync between the two manifests, and the version also in the root README plugin table and the plugin README's `Version X.Y.Z` line (all enforced by `tests/manifests.test.js`), and add a `## [version]` entry to the plugin's `CHANGELOG.md` for each version.
- Plugin commands are invoked namespaced: `commands/new.md` in `foreman` becomes `/foreman:new`; plugin agents become `<plugin>:<agent>` (e.g. `foreman:foreman-worker`).
- Inside command bodies, plugin-local files are referenced via `${CLAUDE_PLUGIN_ROOT}/...` and user input via `$ARGUMENTS`.
- The foreman plugin's architecture is in `.claude/rules/foreman.md`, loaded only when Claude reads or edits foreman files.
