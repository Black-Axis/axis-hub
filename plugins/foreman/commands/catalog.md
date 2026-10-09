---
description: List all foreman commands, subagents, skills, and hooks with what each does
allowed-tools: Read, Glob, Grep
---

# /foreman:catalog

This command is read-only: do not modify any file. Build the output from the plugin's actual files so it stays accurate when components are added or removed.

## 1. Collect components

All paths are under `${CLAUDE_PLUGIN_ROOT}`. Use exactly these three calls (run them together), never read a command, agent, skill, or script file in full:

1. `Grep` with pattern `^(name|description|argument-hint|model):`, output mode `content`, on `${CLAUDE_PLUGIN_ROOT}` with glob `{commands,agents,skills}/**/*.md`. Each match gives the file and one frontmatter field.
2. `Read` `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json`.
3. `Grep` with pattern `^// Foreman`, output mode `content`, `-A 1`, on `${CLAUDE_PLUGIN_ROOT}/hooks` with glob `*.js` (the first comment of each hook script says what it does).

Build the rows from those results:

- **Commands**: every `commands/*.md`. Name = `/foreman:<file name without .md>`. Description = the `description` field. Append the `argument-hint` (if any) after the command name, e.g. `/foreman:run [P-NN] [TASK-TT | all]`.
- **Subagents**: every `agents/*.md`. Name = the `name` field. Description = the `description` field, plus the model in parentheses if a `model` field exists (e.g. "(model: sonnet)").
- **Skills**: every `skills/*/SKILL.md`. Name = the `name` field (or the folder name). Description = the `description` field.
- **Hooks**: one row per hook in `hooks.json`: Name = the event (e.g. `SessionStart`) plus the matcher if any; description = what the script's first comment says.

A component type with no matches means the plugin provides none of it.

## 2. Output

Print exactly four sections in this order, each with a Markdown table. Number rows from 1 within each table, sorted by the natural workflow for commands (`init`, `new`, `interview`, `import`, `approve`, `run`, `round`, `status`, `change`, `hold`, `cancel`, `resume`, `close`, `doctor`, `report`, `map`, `settings`, `ask`, `catalog`, then any others alphabetically) and alphabetically for the rest. Keep each "What it does" to one short sentence.

### Commands

| # | Command | What it does |
|---|---------|--------------|

### Subagents

| # | Subagent | What it does |
|---|----------|--------------|

### Skills

| # | Skill | What it does |
|---|-------|--------------|

### Hooks

| # | Hook | What it does |
|---|------|--------------|

If a component type has none, still show its table with a single row: `| — | None | This plugin provides no <type> yet. |`.

After the tables, add one line: "Start a feature with `/foreman:new`, or describe what you need with `/foreman:ask`."
