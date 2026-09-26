---
name: foreman-guide
description: Suggests the right /foreman command when the user, without using a /foreman command, asks to build or add a feature, has feature requirements or working files, wants to continue or resume planned work, asks about progress or task status, wants to change scope, pause or cancel work, close/finish a feature, or wants a status report. Suggest only - never runs commands.
---

# Foreman guide

The user described a need that a foreman command handles, but did not use one. Suggest the command; do not run it and do not start the work yourself.

Skip this skill when the user is already running a `/foreman:*` command, or explicitly asked to work without foreman.

## Steps

1. Map the need to a command using the list of commands in `${CLAUDE_PLUGIN_ROOT}/commands/*.md` (read their `description` and `argument-hint`).
   - Build/add a feature, has requirements or working files: `/foreman:new`
   - Move existing plans/tasks from another workflow into foreman: `/foreman:import`
   - Approve the plan/contract: `/foreman:approve`
   - Implement / continue / next task: `/foreman:run`
   - Progress, what's left: `/foreman:status`
   - Scope or requirement change: `/foreman:change`
   - Pause / stop / continue paused work: `/foreman:hold`, `/foreman:cancel`, `/foreman:resume`
   - Finish a feature: `/foreman:close`
   - Something looks broken in `workbench/`: `/foreman:doctor`
   - Report for a manager or team: `/foreman:report`
   - View or change project settings (git, output style, fix rounds): `/foreman:settings`
   - What does foreman provide: `/foreman:catalog`
   - Not sure: `/foreman:ask`
2. If `workbench/INDEX.md` exists, read it and the relevant TRK file to fill real arguments (e.g. the next ready task for "continue"). Follow the rules: unapproved contract means `/foreman:approve` first; `Hold` means `/foreman:resume`.
3. Follow the Output style in `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` (Concise unless `INDEX.md` says `Normal`). Reply briefly: the exact command in a code block and one sentence why. Then let the user decide - they can run it, or ask you to proceed without foreman.
