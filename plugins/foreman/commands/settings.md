---
description: View or change this project's foreman settings (Version control, Workbench, Output, Fix rounds, CLAUDE.md) and working rules defaults
argument-hint: "[vcs git|tfvc|none] [workbench tracked|ignored] [output concise|normal] [fix-rounds 0-10] [claude-md yes|no] [rules]"
allowed-tools: Read, Edit(workbench/**), Bash(git ls-files:*), Bash(tf status:*), AskUserQuestion
---

# /foreman:settings

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

If `workbench/INDEX.md` does not exist, tell the user to run `/foreman:init` (or that the first `/foreman:new`, `/foreman:interview`, or `/foreman:import` creates the settings from their defaults) and stop.

## Settings

| Setting | Values | Effect |
|---------|--------|--------|
| Version control (`vcs`) | `git`, `tfvc`, `none` | The project's version control ("Version control" in rules.md) |
| Workbench | `tracked`, `ignored` | Whether `workbench/` is kept in version control (older name: `Git: committed / ignored`; `git committed|ignored` is accepted as an argument) |
| Output | `Concise`, `Normal` | Style of all foreman replies, reports, and files |
| Fix rounds | `0`-`10` (default `4`) | Times `/foreman:run` sends failed-verification feedback back to the worker before Hold; `0` = none |
| CLAUDE.md | `yes`, `no` | Whether a short foreman block in `CLAUDE.md` (Workbench `tracked`) or `CLAUDE.local.md` (Workbench `ignored`) tells Claude about `workbench/` |
| rules | - | The INDEX `Working Rules Defaults` (commit policy, auto-close, tests, standards, ask-when) proposed for every new contract; existing contracts do not change |

## Steps

1. Read the `Settings` block in `workbench/INDEX.md`. A missing line counts as not set; an old `Git:` line is the Workbench value (`committed` = `tracked`).
2. **No arguments**: show the current values as a table (mark missing ones `not set`; for a missing Version control show the detected value), then ask which to change. If nothing, stop.
3. **With arguments**: parse them (case-insensitive). Reject unknown settings or values and show the valid ones.
4. Apply each change to the `Settings` block (add the line if missing; Output values in Title Case, the others in lowercase). When writing Workbench, replace an old `Git:` line with `- Workbench:`.
5. Workbench side effects (ignore file per "Version control" in rules.md):
   - To `ignored`, git: add `workbench/` to `.gitignore` (create it if missing; no duplicate line). If `git ls-files workbench` lists tracked files, warn that they stay tracked until removed from the index, and offer to run `git rm -r --cached workbench`. Run it only on explicit yes.
   - To `ignored`, tfvc: add `\workbench` to `.tfignore` (create it if missing; no duplicate line). Warn that files already in source control stay there until the user removes them in Visual Studio (`.tfignore` only affects new files). Never delete anything from source control.
   - To `tracked`: remove the `workbench/` (or `\workbench`) line from the ignore file if present. Add `workbench/.baseline/` instead (git and tfvc). Do not stage, commit, add, or check in anything.
   - With Version control `none`: no ignore file; only the CLAUDE.md target changes.
   - If CLAUDE.md is `yes`: the target file changed, so write the block to the new target and remove it from the old one ("Project instructions block" in rules.md).
6. Version control side effects: to `tfvc` or `none`, set the INDEX `Working Rules Defaults` Commit policy (if present) to `never auto-commit (user checks in)` and tell the user that existing contracts with an auto-commit policy are no longer committed by foreman. Move the ignore lines to the new version control's ignore file (none: leave the old file as it is). Never run state-changing version control commands.
7. CLAUDE.md side effects ("Project instructions block" in rules.md): to `yes`, write the block; to `no`, remove it.
8. `rules`: show the current `Working Rules Defaults` (or `not set` if the section is missing), then ask which to change, proposing values as in step 2 of `${CLAUDE_PLUGIN_ROOT}/reference/setup.md`. Write the section after `Settings` (create it if missing). With no arguments, include the working rules defaults in the table from step 2.
9. Confirm the new values in one line. User-level defaults for new projects are changed in `/config` (foreman: Default output style, Default for workbench/ in version control, Default fix rounds, Default CLAUDE.md block).
