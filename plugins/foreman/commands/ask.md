---
description: Describe a need in plain words; get the right foreman command
argument-hint: "[what you want to do]"
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill
---

# /foreman:ask

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it. Do not modify any file in this command itself.

## 1. Get the need

If the input is empty, ask the user what they want to do. If the need is ambiguous (for example, it could mean two different commands, or two different features), ask a short clarifying question. Do not guess.

## 2. Know the available commands

Read the `description` and `argument-hint` frontmatter of every `${CLAUDE_PLUGIN_ROOT}/commands/*.md` (except this one). Use them, not memory, to choose.

## 3. Read the project state

If `workbench/INDEX.md` exists, read it and the relevant plan, contract, and TRK files so you can fill real arguments:
- Match the feature the user mentions (by name, slug, or number) to its `P-NN`.
- For "continue / next task": pick the next ready task (`Not Started`, all `Depends On` tasks `Done`). If several are ready, list them and let the user choose.
- Respect the rules: if the contract is not `Approved`, the right command is `/foreman:approve P-NN` before any run; if the target is on `Hold`, it is `/foreman:resume`.

If `workbench/` does not exist, the right starting point is almost always `/foreman:new`.

## 4. Answer

Reply with:
1. **Command** - the exact command with arguments filled in, in a code block, e.g. `/foreman:run P-01 TASK-04`.
2. **Why** - one or two sentences linking the command to the user's need and the current state.
3. **Then** - the likely next command after it, if obvious.

If the need requires more than one command in sequence, list them in order and recommend starting with the first.

If no foreman command covers the need, say so clearly, then suggest the closest command. If none is close, tell the user this is outside foreman and can be asked of Claude directly.

## 5. Offer to run

Ask the user with `AskUserQuestion`: "Run it now?" Only on an explicit yes, run the recommended command through the Skill tool (its name, e.g. `foreman:run`, with the arguments), so it loads with its own permissions and the user's defaults. If the Skill tool is not available or fails, never follow the command's file yourself: give the exact command for the user to type. On no, stop.
