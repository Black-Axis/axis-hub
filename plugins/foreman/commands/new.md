---
description: Start a new feature from working file(s) and/or text - review it, then create plan, contract, tracking, and subtasks in workbench/
argument-hint: "[working file path(s)] [feature description / notes]"
allowed-tools: Read, Glob, Grep, Edit(workbench/**), Write(workbench/**), AskUserQuestion
---

# /foreman:new

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it throughout.

## 1. Initialize `workbench/` (first time only)

If `workbench/INDEX.md` does not exist in the project root:
1. Read the user's defaults (set when the plugin was enabled; change with `/config`):
   - Default output: `${user_config.default_output}`
   - Default git: `${user_config.default_git}`
   - Default fix rounds: `${user_config.default_fix_rounds}`
   - Default CLAUDE.md block: `${user_config.default_claude_md}`

   If a value above is empty, still shows the literal `${user_config...}` text, or is not a valid value, treat it as: output `Concise`, git `ask`, fix rounds `4`, CLAUDE.md block `ask`.
2. Decide the settings without re-asking what the user already chose:
   - Output: use the default output (it is always `Concise` or `Normal` after step 1). Do not ask.
   - Fix rounds: use the default. Do not ask.
   - Git: if the default git is `committed` or `ignored`, use it. Do not ask. Only if it is `ask`: ask whether `workbench/` should be **committed** to git or **ignored**.
   - CLAUDE.md: if the default is `yes` or `no`, use it. Do not ask. Only if it is `ask`: ask whether to add a short foreman block to the project's `CLAUDE.md` (Git `committed`) or `CLAUDE.local.md` (Git `ignored`) so Claude knows about `workbench/` in every session; show the block from `${CLAUDE_PLUGIN_ROOT}/templates/claude-md.md`.
3. Create `workbench/` with subfolders `plans/`, `contracts/`, `tracking/`, `subtasks/`, `docs/`, `interviews/`.
4. Create `workbench/INDEX.md` from the INDEX template with the chosen Git, Output, Fix rounds, and CLAUDE.md settings. Tell the user in one line which values were applied and that `/foreman:settings` changes them.
5. If `ignored`: add `workbench/` to the project `.gitignore` (create it if missing; do not duplicate the line).
6. If CLAUDE.md is `yes`: write the block as described in "Project instructions block" in rules.md.

## 2. Determine the feature number

Read `workbench/INDEX.md` and list `workbench/interviews/`. `NN` = highest feature or interview number + 1 (or `01`).

## 3. Get the requirements

The input may contain any mix of working file paths and free text. All of it describes ONE feature.

1. **Split the input.** Every token that looks like a file path (has a path separator or a file extension, quoted or not) is a path candidate. Everything else is text.
2. **Check paths.** For each path candidate, check that the file exists. If one does not exist, ask the user whether it is a wrong path (and for the correct one) or is meant as text. Never silently drop or reinterpret it.
3. **Build the feature description:**
   - **Files only** (one or many; md, txt, pdf, ...): read every file. If a file cannot be read (e.g. `.docx` or another binary format), say so and ask the user for a PDF, Markdown, or text version, or to paste its content. Merge them into one set of requirements. Record which file each requirement came from.
   - **Files + text**: the files are the feature description; the text is extra notes that add to or override the files. List every place where the text conflicts with a file and ask the user to confirm which wins.
   - **Text only** (typed in the arguments or pasted in the conversation): the text is the feature description. Treat it exactly like working files - do not start a full interview; the review in step 4 asks only about the gaps found.
   - **Nothing** (empty input and no feature text in the conversation): ask the user to give working file path(s) or describe the feature in text. If they only have an idea and want to be interviewed, stop and suggest `/foreman:interview <idea>` (a deep interview that ends with the same plan, contract, and tasks).
4. Keep the original input (file paths and the full text) for the plan's Source section.

## 4. Review the feature

Examine the requirements against logic and against the current codebase. Identify:
- missing information,
- unclear or ambiguous items,
- contradictions,
- items that are not applicable or not feasible in this project.

Present the findings to the user as a numbered list and ask for a resolution of each. Do not assume answers. Repeat until every finding has a resolution.

## 5. Gather evidence

Explore the codebase to find the files, patterns, and existing utilities relevant to the feature. This evidence feeds each task's `Evidence`, `Files Expected to Change`, and `Implementation` sections.

## 6. Agree on working rules

Ask the user for the contract Working Rules that you cannot infer: commit policy, Auto-close (`Ask` - default, `Yes`, or `No`), test commands required, standards to follow, and when you must stop and ask. Propose sensible defaults from the project and let the user confirm or change them.

## 7. Write the files

Pick the `<slug>` from the feature name. Create, from templates:
1. `workbench/plans/P-NN-<slug>.md` - all sections filled; Source lists every working file and contains the user's text verbatim (and the interview Q&A, if any); Requirements hold the final agreed requirements; Feature Review Findings contain every finding and its agreed resolution.
2. `workbench/contracts/CONT-NN-<slug>.md` - Status `Draft`; Scope, Out of Scope, Acceptance Criteria, Working Rules filled.
3. `workbench/subtasks/P-NN-<slug>/TASK-TT-<task-slug>.md` - one file per task. Every section is mandatory: Problem, Evidence, Required Outcome, Files Expected to Change, Out of Scope, Implementation, Report Requirements. Each task must be small enough for one subagent run and independently verifiable.
4. `workbench/tracking/TRK-NN-<slug>.md` - one row per task, all `Not Started`; History row "Plan created".
5. `workbench/docs/DOC-NN-<slug>.md` - skeleton only (Summary from the plan; other sections empty until tasks complete).
6. Add a row to `workbench/INDEX.md`: Contract Status `Draft`, Progress `0/<total> Done`.

## 8. Hand off

Show the user a short summary (files created, task list with dependencies) and tell them to review the contract and run `/foreman:approve P-NN`. Do not start implementation.
