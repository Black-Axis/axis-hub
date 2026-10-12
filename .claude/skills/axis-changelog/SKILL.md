---
name: axis-changelog
description: "Write this branch's CHANGELOG entries (root and plugin) under Unreleased, after proposing them."
argument-hint: "[issue numbers or notes]"
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(gh issue view:*), PowerShell(git status:*), PowerShell(git diff:*), PowerShell(gh issue view:*), Edit(./CHANGELOG.md), Edit(./plugins/*/CHANGELOG.md)
---

Write the CHANGELOG entries for this branch. Notes from the user: $ARGUMENTS

Repository `Black-Axis/axis-hub`. Run each command on its own (no `cd`, no chaining), so the pre-approved forms match. Versions and the `## [Unreleased]` rename are `/axis-release`'s job: never bump a version or rename a section here.

## 1. Look up

- `git status --short` and `git diff main --stat`: what changed. Files under `plugins/<name>/` are that plugin's change; everything else is `Marketplace`.
- The issues (from the notes or the branch's commits): `gh issue view <n> --repo Black-Axis/axis-hub --json title --jq .title`.
- `Read` only the top of `CHANGELOG.md` and of each changed plugin's `CHANGELOG.md` (the `## [Unreleased]` section, about 40 lines), and the plugin's current `version` in `.claude-plugin/marketplace.json`.

## 2. Propose, then ask

Root `CHANGELOG.md`, under `## [Unreleased]` (`tests/release.test.js` checks it):

- Area `### <plugin> X.Y.Z` (the plugin's current version; `/axis-release` sets the released one) with the line `Details: [<plugin> changelog](plugins/<plugin>/CHANGELOG.md).`, or `### Marketplace`; plugins first, `Marketplace` last.
- Type `#### Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`, in that order.
- One short change per bullet, `- ` at the start, at most 140 characters, ending with the issue: `(#N)`. Add to an existing area or type heading; never repeat one.
- A fix to something still listed under Unreleased gets no bullet of its own (change that bullet if needed).

Plugin `CHANGELOG.md`, under its `## [Unreleased]`: `### <type>` headings, one bullet per change with the details users need: `- <what> (#N): <how it works, what changes for the user>`.

Never mention GitLab or `.workbench`; no personal email addresses. Show the proposed bullets, grouped by file and heading, and ask with `AskUserQuestion`: write as proposed, or change them.

## 3. Write and check

Edit only those sections, keeping each file's line endings. Then one `axis-test-runner` call: `Test files: tests/release.test.js tests/manifests.test.js tests/docs.test.js`. Report the files changed and its line.
