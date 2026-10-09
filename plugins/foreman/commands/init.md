---
description: Set up workbench/ in this project - ask every setting and the default working rules, then create the folders and INDEX
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), Bash(git log:*), PowerShell(git log:*), AskUserQuestion
---

# /foreman:init

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it throughout.

The user's defaults (set when the plugin was enabled; change with `/config`):
- Default output: `${user_config.default_output}`
- Default workbench in version control: `${user_config.default_git}`
- Default fix rounds: `${user_config.default_fix_rounds}`
- Default CLAUDE.md block: `${user_config.default_claude_md}`
- Default worker model: `${user_config.default_worker_model}`

## New project

If `workbench/INDEX.md` does not exist: follow `${CLAUDE_PLUGIN_ROOT}/reference/setup.md` in **Ask all** mode with the defaults above. Then suggest the next step: `/foreman:new` for a feature with a description or working files, `/foreman:interview` for an idea.

## Already set up (repair)

If `workbench/INDEX.md` exists, never overwrite anything. Check and fill only what is missing:

1. Missing subfolders from setup.md step 3.1: create them as in that step (git: `Write` an empty `.gitkeep`; tfvc and none: the `mkdir` / `New-Item` form).
2. Missing settings lines (Version control, Workbench, Output, Fix rounds, CLAUDE.md): ask for those only, as in setup.md step 1 (Ask all), and add them; apply their side effects as in `/foreman:settings`. An old `Git:` line counts as Workbench; offer to rename it.
3. Missing `Working Rules Defaults` section: ask whether to set it now; on yes, follow setup.md step 2 and add the section after `Settings`.

Report in one line what was added, or that nothing was missing. For changing existing values point to `/foreman:settings`; for consistency checks, to `/foreman:doctor`.
