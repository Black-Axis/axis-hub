---
name: axis-release
description: "Release the marketplace: prepare the versions and changelogs in a release PR, then tag, push, and close the milestone after the merge."
argument-hint: "[X.Y.Z] [<plugin>=X.Y.Z ...]"
disable-model-invocation: true
allowed-tools: Bash(node scripts/release.js:*), Bash(node .githooks/finish.js), Bash(git switch -c chore/release-:*), Bash(git status:*), Bash(git diff:*), PowerShell(node scripts/release.js:*), PowerShell(node .githooks/finish.js), PowerShell(git switch -c chore/release-:*), PowerShell(git status:*), PowerShell(git diff:*)
---

Release the marketplace. Versions from the user: $ARGUMENTS

Repository `Black-Axis/axis-hub`. Run each command on its own (no `cd`, no chaining), so the pre-approved forms match. `scripts/release.js` does every edit, check, and git / GitHub write; never edit the release files or run `git tag` / `git push` yourself.

## 1. State

`node scripts/release.js status` (add the version from the user if given). Its `phase:` line picks the step:

- `prepare`: section 2.
- `tag`: section 3. On a `chore/release-*` branch: the release pull request is not merged yet; say so and stop.
- `close`: section 3, step 4 only.
- `none`: nothing to release; report the lines and stop.

A `milestone ... open issues: #a #b` line: stop and list them (the rule: every issue of the milestone is closed before a release; the release pull request closes none). `milestone ... not found` or `milestone: no open vX.Y.Z milestone`: stop; the release version is the milestone title `vX.Y.Z`.

## 2. Prepare (release branch and pull request)

Propose and ask once with `AskUserQuestion` (keeps this turn, so the pre-approvals stay): the marketplace version from the milestone (the `marketplace:` line; show its `changes need ...` note when present), the plugin versions from `status` or the user (a `major` line always needs the user's yes; every plugin with a version line must get one), the date (today), branch `chore/release-X-Y-Z`, and the pull request values below. Options: go as proposed, or change them.

After the yes:

1. With uncommitted changes, stop and ask. Then `node .githooks/finish.js` and `git switch -c chore/release-X-Y-Z`.
2. `node scripts/release.js prepare X.Y.Z [<plugin>=X.Y.Z ...]`: prints `changed:` lines and `notes: vX.Y.Z ok`; anything else, stop and report it.
3. One `axis-test-runner` call (all checks).
4. Write two files in your scratchpad directory with the Write tool: the commit message (`chore: release X.Y.Z`, a body listing the versions, then the `Co-Authored-By` trailer this session's instructions give for commits) and the pull request body (`## Summary` with the versions and a pointer to the root CHANGELOG section, `## Test plan` with the checks, no closing keywords, ending with this session's attribution line for pull requests).
5. One `axis-pr-opener` call, prompt lines only: `Branch:`, `Files:` (the `changed:` files), `Commit message file:`, `Title: chore: release X.Y.Z`, `Body file:`, `Labels: enhancement, marketplace` plus `plugin: <name>` per released plugin, `Assignee: krypton225`, `Milestone: vX.Y.Z`, `Linked issues: none`.
6. Report its line, then wait for CI: `node scripts/ci-watch.js pr <n>` (Bash timeout 600000 ms). Tell the user to merge, run `git finish`, and run `/axis-release` again.

## 3. Tag (after the merge)

1. `git status --short --branch`: on `main`, clean, not behind; otherwise ask the user to run `git finish`.
2. Ask with `AskUserQuestion`: create the annotated tag `vX.Y.Z` on `main` at this commit and push it to GitHub (this starts the Release workflow, which publishes the release page). Options: tag and push, or stop.
3. After the yes: `node scripts/release.js tag X.Y.Z` (it checks the branch, GitHub's `main`, the open issues, and the release notes again; pushes only the tag, to the remote whose URL is `Black-Axis/axis-hub`). Then `node scripts/ci-watch.js tag vX.Y.Z` (Bash timeout 600000 ms).
4. When `Release: success`: `node scripts/release.js close X.Y.Z`. On a failure, report the lines and stop: the tag stays, the milestone stays open.

## 4. Report

The script lines as they are, plus the release page `https://github.com/Black-Axis/axis-hub/releases/tag/vX.Y.Z` after a successful tag. On a `release: <reason>` line, say what to do; never retry with other values without asking.
