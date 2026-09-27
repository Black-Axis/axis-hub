---
description: List all foreman commands, subagents, skills, and hooks with what each does
allowed-tools: Read, Glob
---

# /foreman:catalog

This command is read-only: do not modify any file. Build the output from the plugin's actual files so it stays accurate when components are added or removed.

## 1. Collect components

All paths are under `${CLAUDE_PLUGIN_ROOT}`:

- **Commands**: every `commands/*.md`. Name = `/foreman:<file name without .md>`. Description = the `description` frontmatter field. Append the `argument-hint` (if any) after the command name, e.g. `/foreman:run <P-NN> <TASK-TT>`.
- **Subagents**: every `agents/*.md`. Name = the `name` frontmatter field. Description = the `description` field, plus the model in parentheses if a `model` field exists (e.g. "(model: sonnet)").
- **Skills**: every `skills/*/SKILL.md`. Name = the `name` frontmatter field (or the folder name). Description = the `description` field.
- **Hooks**: `hooks/hooks.json` (and any hooks declared in `.claude-plugin/plugin.json`). One row per hook: Name = the event (e.g. `SessionStart`) plus the matcher if any; description = what the hook command does (read the script it runs if needed).

A folder or file that does not exist means the plugin provides none of that component.

## 2. Output

Print exactly four sections in this order, each with a Markdown table. Number rows from 1 within each table, sorted by the natural workflow for commands (`new`, `interview`, `import`, `approve`, `run`, `status`, `change`, `hold`, `cancel`, `resume`, `close`, `doctor`, `report`, `settings`, `ask`, `catalog`, then any others alphabetically) and alphabetically for the rest. Keep each "What it does" to one short sentence.

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
