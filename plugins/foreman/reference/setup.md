# Workbench setup

Creates `workbench/` and its settings. Used in two modes:

- **Ask all** - by `/foreman:init`: ask every setting and the working rules defaults.
- **Auto** - by `/foreman:new`, `/foreman:import`, and `/foreman:interview` when `workbench/INDEX.md` does not exist: apply the user's defaults without asking.

The calling command gives you the user's defaults (only a command file gets them filled in, never this file). A default that is empty, still shows the literal `${user_config...}` text, or is invalid counts as: output `Concise`, git `ask`, fix rounds `4`, CLAUDE.md block `ask`.

## 1. Settings

| Setting | Auto | Ask all |
|---------|------|---------|
| Git (`committed` / `ignored`) | Use the default; ask only if it is `ask` | Ask; the default (if not `ask`) is the recommended option |
| Output (`Concise` / `Normal`) | Use the default | Ask; default recommended |
| Fix rounds (`0`-`10`) | Use the default | Ask; default recommended |
| CLAUDE.md (`yes` / `no`) | Use the default; ask only if it is `ask` | Ask; default (if not `ask`) recommended |

When asking about CLAUDE.md, explain it in one line: a short foreman block in the project's `CLAUDE.md` (Git `committed`) or `CLAUDE.local.md` (Git `ignored`) so Claude knows about `workbench/` in every session. Show the block from `${CLAUDE_PLUGIN_ROOT}/templates/claude-md.md`. Apply the AGENTS.md rule from "Project instructions block" in rules.md before writing.

Ask the settings together in one `AskUserQuestion` call when possible.

## 2. Working rules defaults (Ask all only)

Project-wide defaults for every new contract's Working Rules. `/foreman:new` and `/foreman:interview` propose them instead of asking from scratch.

1. Look at the project first: test and build commands (`package.json` scripts, `Makefile`, `pyproject.toml`, CI files, ...), linters and formatters, `CONTRIBUTING` or style docs, the commit style in `git log`.
2. Propose a value for each, based on what you found, and ask the user to confirm or change it:
   - Commit policy: never auto-commit / main agent commits after each verified task / other.
   - Auto-close: `Ask` (default) / `Yes` / `No`.
   - Tests: the commands to run after each task, or "none available".
   - Standards: coding standards and conventions to follow.
   - Ask the user when: situations where the main agent must stop and ask.

In Auto mode, remove the `Working Rules Defaults` section from INDEX; each feature asks its own rules.

## 3. Create

1. `workbench/` with subfolders `plans/`, `contracts/`, `tracking/`, `subtasks/`, `docs/`, `interviews/`, `reports/`.
2. `workbench/INDEX.md` from `${CLAUDE_PLUGIN_ROOT}/templates/INDEX.md` with the chosen values and Created = today.
3. Git `ignored`: add `workbench/` to the project `.gitignore` (create it if missing; no duplicate line).
4. Git `committed`: put an empty `.gitkeep` in each subfolder, so the folders survive a clone while empty.
5. CLAUDE.md `yes`: write the block ("Project instructions block" in rules.md).

## 4. Tell the user

One line with the applied values and that `/foreman:settings` changes them (and `/config` changes the defaults for new projects). In Ask all mode, also list the working rules defaults.
