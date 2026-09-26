---
description: Approve a feature contract so its tasks can be run
argument-hint: <P-NN>
allowed-tools: Read, Glob, Edit(workbench/**), AskUserQuestion
---

# /foreman:approve

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it.

1. Resolve `P-NN` to `workbench/contracts/CONT-NN-<slug>.md`. If the argument is missing or no match exists, list available plans from `workbench/INDEX.md` and ask which one.
2. If Status is already `Approved`, say so and stop.
3. Show the user a concise summary of the contract: Scope, Out of Scope, Acceptance Criteria, Working Rules, and any Change Requests without an Approved date.
4. Ask the user to confirm approval. If they decline, stop and leave Status unchanged.
5. On confirmation:
   - Set Status to `Approved` and Approved to today's date.
   - Fill today's date in the Approved column of every pending Change Request.
   - Update the Contract Status column in `workbench/INDEX.md`.
6. Tell the user which tasks are ready (dependencies met, `Not Started`) and that they run with `/foreman:run P-NN TASK-TT`.
