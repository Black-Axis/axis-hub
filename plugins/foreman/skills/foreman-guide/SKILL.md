---
name: foreman-guide
description: Suggests the right /foreman command, only in a project that already uses foreman (it has workbench/INDEX.md) or when the user explicitly asks to plan, track, or contract feature work. Then for - without a /foreman command - building a feature, a feature idea or requirements, continuing planned work, progress, scope changes, pausing or canceling, closing a feature, or a status report. Suggest only - never runs commands. In other projects, do not use it for ordinary coding requests.
---

# Foreman guide

The user described a need that a foreman command handles, but did not use one. Suggest the command; do not run it and do not start the work yourself.

Use it only when one of these is true; otherwise do nothing and never mention foreman:
- `workbench/INDEX.md` exists in the project (check with Glob), or
- the user explicitly asks to plan, track, or contract feature work (e.g. "plan this feature with tasks", "track progress", "use foreman").

Skip it also when the user is already running a `/foreman:*` command, explicitly asked to work without foreman, or you already suggested a foreman command for this same topic in this session (suggest at most once per topic).

## Steps

1. Map the need to a command using the list of commands in `${CLAUDE_PLUGIN_ROOT}/commands/*.md` (read their `description` and `argument-hint`).
   - Set up foreman in this project (before any feature): `/foreman:init`
   - Build/add a feature, has requirements or working files: `/foreman:new`
   - Has only an idea, wants to brainstorm or be questioned about a feature, or continue an open interview: `/foreman:interview`
   - Move existing plans/tasks from another workflow into foreman: `/foreman:import`
   - Approve the plan/contract: `/foreman:approve`
   - Implement / continue / next task: `/foreman:run`; all remaining tasks of a plan in one go: `/foreman:run P-NN all`
   - A task's result is wrong or incomplete (also after it was marked done), send it back for rework: `/foreman:round`
   - Progress, what's left: `/foreman:status`
   - Scope or requirement change: `/foreman:change`
   - Pause / stop / continue paused work: `/foreman:hold`, `/foreman:cancel`, `/foreman:resume`
   - Finish a feature: `/foreman:close`
   - Something looks broken in `workbench/`: `/foreman:doctor`
   - Report for a manager or team: `/foreman:report`
   - A picture of all features and their files (diagram): `/foreman:map`
   - View or change project settings (version control, workbench tracked or ignored, output style, fix rounds, CLAUDE.md block, working rules defaults): `/foreman:settings`
   - What does foreman provide: `/foreman:catalog`
   - Not sure: `/foreman:ask`
2. If `workbench/INDEX.md` exists, read it and the relevant TRK file to fill real arguments (e.g. the next ready task for "continue"). Follow the rules: unapproved contract means `/foreman:approve` first; `Hold` means `/foreman:resume`.
3. Follow the Output style in `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` (Concise unless `INDEX.md` says `Normal`). Reply briefly: the exact command in a code block and one sentence why. Then let the user decide - they can run it, or ask you to proceed without foreman.
