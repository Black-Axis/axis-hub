---
description: View or change this project's foreman settings (Git, Output, Fix rounds, CLAUDE.md)
argument-hint: "[git committed|ignored] [output concise|normal] [fix-rounds 0-10] [claude-md yes|no]"
allowed-tools: Read, Edit(workbench/**), Bash(git ls-files:*), AskUserQuestion
---

# /foreman:settings

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

If `workbench/INDEX.md` does not exist, tell the user settings are created by the first `/foreman:new` or `/foreman:import` and stop.

## Settings

| Setting | Values | Effect |
|---------|--------|--------|
| Git | `committed`, `ignored` | Whether `workbench/` is tracked by git |
| Output | `Concise`, `Normal` | Style of all foreman replies, reports, and files |
| Fix rounds | `0`-`10` (default `4`) | Times `/foreman:run` sends failed-verification feedback back to the worker before Hold; `0` = none |
| CLAUDE.md | `yes`, `no` | Whether a short foreman block in `CLAUDE.md` (Git `committed`) or `CLAUDE.local.md` (Git `ignored`) tells Claude about `workbench/` |

## Steps

1. Read the `Settings` block in `workbench/INDEX.md`. A missing line counts as not set.
2. **No arguments**: show the current values as a table (mark missing ones `not set`), then ask which to change. If nothing, stop.
3. **With arguments**: parse them (case-insensitive). Reject unknown settings or values and show the valid ones.
4. Apply each change to the `Settings` block (add the line if missing; Output values in Title Case, Git and CLAUDE.md in lowercase).
5. Git side effects:
   - To `ignored`: add `workbench/` to `.gitignore` (create it if missing; no duplicate line). If `git ls-files workbench` lists tracked files, warn that they stay tracked until removed from the index, and offer to run `git rm -r --cached workbench`. Run it only on explicit yes.
   - To `committed`: remove the `workbench/` line from `.gitignore` if present. Do not stage or commit anything.
   - If CLAUDE.md is `yes`: the target file changed, so write the block to the new target and remove it from the old one ("Project instructions block" in rules.md).
6. CLAUDE.md side effects ("Project instructions block" in rules.md): to `yes`, write the block; to `no`, remove it.
7. Confirm the new values in one line. User-level defaults for new projects are changed in `/config` (foreman: Default output style, Default git choice, Default fix rounds, Default CLAUDE.md block).
