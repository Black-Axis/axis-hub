---
description: View and change this project's foreman settings from a menu (current value and default for each), or directly by argument; reset to defaults
argument-hint: "[vcs git|tfvc|none] [workbench tracked|ignored] [output concise|normal] [fix-rounds 0-10] [claude-md yes|no] [rules] [reset]"
allowed-tools: Read, Glob, Edit(workbench/**), Bash(git ls-files:*), PowerShell(git ls-files:*), Bash(tf status:*), PowerShell(tf status:*), AskUserQuestion
---

# /foreman:settings

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

If `workbench/INDEX.md` does not exist, tell the user to run `/foreman:init` (or that the first `/foreman:new`, `/foreman:interview`, or `/foreman:import` creates the settings from their defaults) and stop.

## Settings and defaults

The user's defaults (set when the plugin was enabled; change with `/config`):
- Default output: `${user_config.default_output}`
- Default workbench in version control: `${user_config.default_git}`
- Default fix rounds: `${user_config.default_fix_rounds}`
- Default CLAUDE.md block: `${user_config.default_claude_md}`

The **default** of a setting is the user's default above; if it is empty, still shows the literal `${user_config...}` text, or is invalid, use the built-in default from this table.

| Group | Setting | Values | Built-in default | Effect |
|-------|---------|--------|------------------|--------|
| Project | Version control (`vcs`) | `git`, `tfvc`, `none` | detected ("Version control" in rules.md) | The project's version control |
| Project | Workbench | `tracked`, `ignored` | `ask` (no value: the user must choose) | Whether `workbench/` is kept in version control (older line: `Git: committed / ignored`; `git committed\|ignored` is accepted as an argument) |
| Project | CLAUDE.md | `yes`, `no` | `ask` (no value: the user must choose) | Whether a short foreman block in `CLAUDE.md` (Workbench `tracked`) or `CLAUDE.local.md` (Workbench `ignored`) tells Claude about `workbench/` |
| Behavior | Output | `Concise`, `Normal` | `Concise` | Style of all foreman replies, reports, and files |
| Behavior | Fix rounds | `0`-`10` | `4` | Times `/foreman:run` sends failed-verification feedback back to the worker before Hold; `0` = none |
| Working rules | Commit policy | never auto-commit / main agent commits after each verified task / other text | `never auto-commit` (always `never auto-commit (user checks in)` for tfvc and none - not asked) | Proposed for every new contract; existing contracts do not change |
| Working rules | Auto-close | `Ask`, `Yes`, `No` | `Ask` | Same |
| Working rules | Tests | command(s), or "none available" | proposed from the project (step 2 of `${CLAUDE_PLUGIN_ROOT}/reference/setup.md`) | Same |
| Working rules | Baseline tests | `yes`, `no` | `yes` | Same |
| Working rules | Standards | text | proposed from the project | Same |
| Working rules | Ask the user when | text | proposed from the project | Same |

Working rules values live in the INDEX `Working Rules Defaults` section (missing section: all `not set`).

## 1. Read

Read the `Settings` block and the `Working Rules Defaults` section of `workbench/INDEX.md`. A missing line counts as `not set`; an old `Git:` line is the Workbench value (`committed` = `tracked`); a missing Version control shows the detected value, marked `(detected)`.

## 2. Mode

- **No arguments**: menu (steps 3-5).
- **`reset`**: reset (step 6).
- **`rules`**: menu with only the Working rules group (steps 4-5).
- **Other arguments**: parse them (case-insensitive). Reject unknown settings or values and show the valid ones. Then go to step 5 with these changes (the confirmation is skipped when the user named every change in the arguments, except for changes with side effects outside `workbench/` - show those and confirm).

## 3. Overview

Show one table with every setting: `Setting | Current | Default | Values`, grouped as in the table above (Project, Behavior, Working rules). Mark with `*` each current value that differs from its default. Below the table, one line: "`*` = differs from the default. Your defaults for new projects: `/config`."

## 4. Choose

1. Ask with one `AskUserQuestion` (multi-select): which groups to change - `Project`, `Behavior`, `Working rules`. If the user picks none, stop.
2. For each chosen group, one `AskUserQuestion` call with one question per setting of that group (at most 4 per call; Working rules needs two calls: Commit policy, Auto-close, Baseline tests, Tests - then Standards, Ask the user when). For each question:
   - Options are the valid values. The current value comes first, labeled `(current)`; label the default `(default)` (one option can carry both). Add a short description of what each option does.
   - Fix rounds: options `4`, `2`, `6`, and the current value if different; other numbers via "Other".
   - Text settings (Tests, Standards, Ask the user when, Commit policy "other"): offer the current value, a value proposed from the project, and "Other" to type.
   - Skip Commit policy for tfvc and none, and Workbench for none (always `tracked`). Use the Version control value chosen on the same screen, if it changed.
3. A question answered with the current value is no change.

## 5. Confirm and apply

1. If nothing changed, say so and stop.
2. Show a summary: one line per change, `Setting: old -> new`, and under it each side effect (from step 7): files outside `workbench/` that will be edited, the CLAUDE.md block moving, ignore file lines, warnings. Ask: apply all, or cancel. Apply only on yes.
3. Apply each change to INDEX: `Settings` block (add the line if missing; Output values in Title Case, the others in lowercase; replace an old `Git:` line with `- Workbench:` when writing Workbench) or the `Working Rules Defaults` section (create it after `Settings` if missing, with the fields of the INDEX template). Then apply the side effects (step 7).
4. Confirm the new values in one line, plus: "Your defaults for new projects: `/config` (foreman: Default output style, Default for workbench/ in version control, Default fix rounds, Default CLAUDE.md block)."

## 6. Reset

Build the change list: every setting to its default - Version control re-detected; Output, Fix rounds, and the working rules with a built-in value to their default; Tests, Standards, Ask the user when re-proposed from the project. For Workbench and CLAUDE.md whose default is `ask`, ask the user (as in step 4) instead of guessing. Skip settings already at their default. Then go to step 5 (the summary and confirmation are always shown for reset).

## 7. Side effects

- **Workbench** (ignore file per "Version control" in rules.md):
  - To `ignored`, git: add `workbench/` to `.gitignore` (create it if missing; no duplicate line). If `git ls-files workbench` lists tracked files, warn that they stay tracked until removed from the index, and offer to run `git rm -r --cached workbench`. Run it only on explicit yes.
  - To `ignored`, tfvc: add `\workbench` to `.tfignore` (create it if missing; no duplicate line). Warn that files already in source control stay there until the user removes them in Visual Studio (`.tfignore` only affects new files). Never delete anything from source control.
  - To `tracked`: remove the `workbench/` (or `\workbench`) line from the ignore file if present. Add `workbench/.baseline/` instead (git and tfvc). Do not stage, commit, add, or check in anything.
  - With Version control `none`: no ignore file; only the CLAUDE.md target changes.
  - If CLAUDE.md is `yes`: the target file changed, so write the block to the new target and remove it from the old one ("Project instructions block" in rules.md).
- **Version control**: to `tfvc` or `none`, set the Working Rules Defaults Commit policy (if present) to `never auto-commit (user checks in)` and tell the user that existing contracts with an auto-commit policy are no longer committed by foreman. Move the ignore lines to the new version control's ignore file (none: leave the old file as it is). Never run state-changing version control commands.
- **CLAUDE.md** ("Project instructions block" in rules.md): to `yes`, write the block; to `no`, remove it.
- **Working rules**: none - existing contracts keep their rules; say so once.
