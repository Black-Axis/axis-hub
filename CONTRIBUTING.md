# Contributing to axis-hub

`axis-hub` is a Claude Code plugin marketplace maintained by Black-Axis. Plugins are Markdown instruction files (commands, agents, skills), JSON manifests, and small hook scripts. There is no build step; changes are verified with `claude plugin validate` and by running the plugin in Claude Code.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Repository layout

```
axis-hub/
├─ .claude-plugin/marketplace.json   # marketplace manifest: lists every plugin
├─ plugins/
│  └─ <plugin>/
│     ├─ .claude-plugin/plugin.json  # plugin manifest (name, version, userConfig, ...)
│     ├─ commands/*.md               # slash commands -> /<plugin>:<file name>
│     ├─ agents/*.md                 # subagents -> <plugin>:<agent name>
│     ├─ skills/<name>/SKILL.md      # auto-triggered skills
│     ├─ hooks/hooks.json            # hooks (+ scripts they run)
│     ├─ CHANGELOG.md                # plugin changes per version
│     └─ README.md                   # user-facing docs for the plugin
├─ examples/<plugin>/                # sample output (also test fixtures)
├─ tests/                            # node --test suites (manifests, hooks)
├─ .github/                          # workflows, release script, Dependabot, main branch ruleset, issue and PR templates
├─ .githooks/                        # git hooks: branch rules (no commits on or pushes to main)
├─ .claude/                          # Claude Code settings for this repo (applies the branch rules to Claude)
├─ AUTHORS.md                        # maintainers and contributors
├─ CHANGELOG.md                      # marketplace-level changes
├─ CLAUDE.md                         # guidance for Claude Code working in this repo
├─ CODE_OF_CONDUCT.md                # community standards
├─ CONTRIBUTING.md                   # this guide
├─ LICENSE.md                        # MIT
├─ README.md                         # marketplace install + plugin list
└─ SECURITY.md                       # how to report vulnerabilities
```

## Repository

The project lives on GitHub: https://github.com/Black-Axis/axis-hub. Open issues and submit changes as pull requests against `main` there.

## Development setup

Requirements:
- Claude Code (the `claude` CLI).
- Node.js 22 or later, to run the tests and hook scripts (e.g. `plugins/foreman/hooks/session-start.js`).

After cloning, run once:

```
git config core.hooksPath .githooks   # turn on the repository's git hooks
git config fetch.prune true           # forget remote branches deleted after their pull request is merged
git config alias.finish '!node .githooks/finish.js'   # `git finish`: clean up after a merge (see below)
```

Load a plugin straight from your working copy (restart the session to pick up edits):

```
claude --plugin-dir plugins/<plugin>
```

Or test the full marketplace install path inside Claude Code:

```
/plugin marketplace add <path to your axis-hub clone>
/plugin install <plugin>@axis-hub
```

After edits: `/plugin marketplace update axis-hub`, then restart the session. Remove with `/plugin uninstall <plugin>@axis-hub` and `/plugin marketplace remove axis-hub`.

## Branches and pull requests

`main` only changes through pull requests. Never commit on `main` or push to it.

1. Update `main` and create a branch for your work:
   ```
   git switch main
   git pull
   git switch -c <type>/<short-name>
   ```
   `<type>` is one of `feat`, `fix`, `docs`, `test`, `ci`, `chore`, `refactor` (the same types as commit messages), and `<short-name>` is kebab-case. For example: `feat/foreman-bug-command`, `fix/run-fix-rounds`, `docs/install-guide`.
2. Commit on the branch, then push it: `git push -u origin <type>/<short-name>`.
3. Open a pull request against `main`. It can be merged when the **validate** check passes.
4. After the merge, GitHub deletes the branch on GitHub automatically (it can be restored from the pull request page). Clean up your clone with one command:
   ```
   git finish
   ```
   It switches to `main`, pulls it, and deletes every local branch whose pull request was merged. A branch is deleted only if all its commits are in `main` and GitHub reports its pull request as merged (with the `gh` CLI) or its GitHub copy was deleted. It changes nothing while you have uncommitted changes or while your current branch is not merged yet. In Claude Code, the same cleanup runs automatically when a session starts, unless you are on `main` with no other local branch (then nothing needs cleaning up, so it skips the fetch; run `git finish` to pull `main`). The fetch stops after 10 seconds, so a slow or missing network does not hold up the start. Then go back to step 1 for the next change.

These rules are enforced in three places:

| Where | What it refuses |
|-------|-----------------|
| GitHub ruleset on `main` ([`.github/rulesets/main.json`](.github/rulesets/main.json)) | Direct pushes, force pushes, and deleting `main`; merging a pull request before **validate** passes |
| Git hooks in `.githooks/` (after `git config core.hooksPath .githooks`) | Commits on `main`, pushes to `main` on GitHub, and branch names not following `<type>/<short-name>` |
| Claude Code hook (`.claude/settings.json`) | The same, for git commands Claude runs in this repository (also with `git -C <path>`, checked against that repository), plus merging pull requests (`gh pr merge`, merge calls through `gh api`): you review and merge every pull request |

## Validation and tests

Run these before every push:

```
claude plugin validate .                  # marketplace.json
claude plugin validate plugins/<plugin>   # the plugin's plugin.json
node --test                               # all tests (finds every *.test.js)
```

The tests check that:

- both manifests agree (name, version, description, keywords);
- each plugin has a README and a CHANGELOG entry for its current version, and is listed in the root README;
- each plugin's version is the same in the root README plugin table and the plugin README;
- the foreman hooks work (session start summary for the sample in `examples/foreman/`, the `workbench/` guard), as do the state script `wb.js` and the command files (scoped `allowed-tools`, shared rules read first, every command listed in the README, the catalog order, and the guide skill);
- the git hooks enforce branch names and keep `main` protected, and `git finish` deletes only merged branches;
- no Markdown file repeats a `## ` heading;
- relative links in every Markdown file point to files that exist (plugin templates are skipped);
- the release script accepts only tags that match the marketplace version, and all workflows pin the same Claude Code version.

GitHub Actions runs:

| Workflow | When | What |
|----------|------|------|
| `validate.yml` | Every pull request and push to `main` | Both validations and `node --test` |
| `codeql.yml` | Pull requests, pushes to `main`, weekly | CodeQL scan of the JavaScript (skipped on private copies, such as private forks) |
| `release.yml` | Push of a `vX.Y.Z` tag | See [Releasing](#releasing) |

CI installs a pinned Claude Code version (`CLAUDE_CODE_VERSION` in `validate.yml` and `release.yml`). To move to a newer version, change it in both files in one pull request. Dependabot (`.github/dependabot.yml`) opens weekly pull requests to update the GitHub Actions used by the workflows.

Then check in a Claude Code session that the plugin loads: its commands appear when you type `/<plugin>:`, its agents appear in `/agents`, and `claude --debug` shows no load errors.

## Adding a plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json` with `name`, `version`, `description`, `author`, `license` (MIT), and `keywords`.
2. Add its components (`commands/`, `agents/`, `skills/`, `hooks/`), a `README.md` explaining what it does, its commands, and how to use it, and a `CHANGELOG.md` with an entry for its first version.
3. Add an entry to `.claude-plugin/marketplace.json` with `"source": "./plugins/<name>"` and the same `version`, `description`, and `keywords` as `plugin.json`.
4. Add a row to the Plugins table in the root `README.md`, and an entry in the root `CHANGELOG.md`.
5. Add it to the `Plugin` dropdowns in `.github/ISSUE_TEMPLATE/bug_report.yml` and `feature_request.yml`, and to the checklist in `.github/pull_request_template.md`. Create a `plugin: <name>` label on GitHub for its issues and pull requests (maintainers: `gh label create "plugin: <name>" --color 1D76DB --description "The <name> plugin"`).
6. Add a section to `CLAUDE.md` for any design rule that spans several files and is not obvious from reading one of them.
7. If it has hook scripts, add tests under `tests/<name>/` (and a sample under `examples/<name>/` if they need fixtures).
8. Validate and test as described above.

## Changing a plugin

- **Versions**: bump `version` in both `plugin.json` and the plugin's `marketplace.json` entry for every change you ship, and keep them equal. Use semantic versioning: patch for fixes, minor for new commands or options, major for changes that break existing users (e.g. renamed commands, changed file formats).
- **Manifests in sync**: `description` and `keywords` must match between `plugin.json` and `marketplace.json`.
- **Changelog**: add your change under `## [Unreleased]` in the plugin's `CHANGELOG.md` (and the root `CHANGELOG.md` for repository-level changes). On release, rename it to the new version with the date.
- **Docs**: update the plugin's `README.md` whenever commands, arguments, settings, or behavior change, and `CLAUDE.md` when a cross-file design rule changes.

## Releasing

A release is a git tag `vX.Y.Z` that matches `metadata.version` in `.claude-plugin/marketplace.json`. Users can pin it (`/plugin marketplace add https://github.com/Black-Axis/axis-hub.git#vX.Y.Z`).

1. Bump the versions of the changed plugins (both manifests) and `metadata.version` in `marketplace.json`.
2. In each changed plugin's `CHANGELOG.md` and in the root `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and add a new empty `## [Unreleased]` above it.
3. Update the version in the root `README.md` plugin table.
4. Check the notes: `node .github/scripts/release-notes.js vX.Y.Z` (fails if the tag does not match or the changelog has no section).
5. Merge to `main`, then create an annotated tag on `main` and push it to GitHub (`origin` in a plain clone of `Black-Axis/axis-hub`):
   ```
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

`release.yml` then checks the tag again, validates, runs the tests, and creates the GitHub release with the root changelog section and the plugin versions as notes.

## Conventions for plugin files

- **Commands** (`commands/*.md`): YAML frontmatter with `description`, `argument-hint` (if the command takes arguments), and `allowed-tools`. Use `$ARGUMENTS` for user input and `${CLAUDE_PLUGIN_ROOT}/...` for files inside the plugin.
- **`allowed-tools` must be narrow.** Tools listed there run without a permission prompt, and this also affects subagents the command launches. Never list bare `Edit`, `Write`, or `Bash`; scope them (e.g. `Edit(workbench/**)`, `Bash(git status:*)`) so users in manual mode are still asked for everything else.
- **`allowed-tools` last one turn.** The grant ends when the user sends the next message. A command that asks questions reads every plugin file it needs before the first question and asks with `AskUserQuestion`, which keeps the turn going.
- **Agents** (`agents/*.md`): frontmatter with `name`, `description`, `model`, and `tools`. Plugin agents cannot set `permissionMode`, `hooks`, or `mcpServers`; Claude Code ignores them for plugins.
- **User settings** (`userConfig` in `plugin.json`): read them with `${user_config.KEY}` inside the command, skill, or agent that needs them. The value is filled in only when Claude Code loads that file, not when a file is opened with Read, so always provide a fallback for an unfilled value. Do not use `options` on `userConfig` fields: plugins that use it fail to load on Claude Code older than v2.1.271.
- **Hooks**: scripts must never block the session. Always exit `0`, stay silent when there is nothing to report, and avoid dependencies beyond the runtime (Node.js with no packages for foreman).
- **Token efficiency**: keep prompts, subagent prompts, and generated output short. Put reusable instructions in the agent or reference file rather than repeating them in prompts.
- **Writing style**: instruction files are written for Claude. Be explicit and step by step, and say what to do when input is missing or invalid. Never let a command guess on the user's behalf: ask.

## foreman-specific rules

Read the "foreman plugin architecture" section of `CLAUDE.md` before changing `plugins/foreman`. In short:

- `reference/rules.md` holds all cross-cutting rules (layout, naming, statuses, permissions, activity log, output style). Change shared behavior there, not in individual commands.
- `templates/*.md` define every generated `workbench/` file. If you change a template's headings or fields, update every command that reads or writes them, `commands/doctor.md`, and `hooks/session-start.js` (it parses the `## Tasks` and `## Task Breakdown` tables and the `- Status:` / `- Plan Status:` fields).
- The worker (`agents/foreman-worker.md`) gets a path-only prompt. Keep its instructions in its agent file.
- New commands must start by reading `reference/rules.md`, and must be added to the command order in `commands/catalog.md` and the command table in `plugins/foreman/README.md`.

Testing a foreman change end to end, in a throwaway git project:

1. `/foreman:new` with a short text feature description, then check the `workbench/` tree, file names, and `INDEX.md`.
2. `/foreman:run` before approval must be refused; `/foreman:approve P-01`, then `/foreman:run P-01 TASK-01`.
3. Check TRK History and Activity rows, the doc update, and that the worker did not touch `workbench/`.
4. Exercise the command you changed (`hold`/`resume`, `change`, `close`, `doctor`, `import`, `settings`, ...).
5. For hook changes, run `node --test`, and run the script directly against the sample:
   ```
   echo '{}' | CLAUDE_PROJECT_DIR=examples/foreman node plugins/foreman/hooks/session-start.js
   ```
6. If you change a template, update the matching files in `examples/foreman/workbench/` so the sample stays accurate.

## Pull request checklist

- [ ] Work is on a `<type>/<short-name>` branch, not `main`.
- [ ] `claude plugin validate .` and `claude plugin validate plugins/<plugin>` pass.
- [ ] `node --test` passes.
- [ ] `CHANGELOG.md` updated (plugin and/or root).
- [ ] The plugin loads in Claude Code and the changed commands, agents, skills, or hooks were tried.
- [ ] `version` bumped and equal in `plugin.json` and `marketplace.json`; `description` and `keywords` in sync.
- [ ] Plugin `README.md`, root `README.md` (plugin table), and `CLAUDE.md` updated where relevant.
- [ ] `allowed-tools` stays scoped; no broad `Edit`, `Write`, or `Bash`.
- [ ] No secrets, tokens, or personal data in any file.
- [ ] First contribution: added yourself to [AUTHORS.md](AUTHORS.md).

Found a security issue? Do not open a public issue or pull request - follow [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE.md).
