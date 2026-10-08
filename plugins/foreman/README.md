<p align="center">
  <img src="assets/images/foreman-logo.png" alt="foreman" width="240">
</p>

# foreman

Plan, contract, track, delegate, and document feature work with Claude Code.

Version 1.4.1 - [changelog](CHANGELOG.md). Requires [Node.js](https://nodejs.org/) on `PATH` for the session-start summary.

The main agent acts as the foreman: it reviews requirements, writes the plan, agrees a contract with you, and tracks every task. Implementation of each task is delegated - one task at a time, chosen by you - to the `foreman-worker` subagent running on Sonnet. The main agent then verifies the result, runs tests, and updates tracking and docs.

## Install

```
/plugin marketplace add https://github.com/Black-Axis/axis-hub.git
/plugin install foreman@axis-hub
```

Other sources (SSH, pinned versions, local clone), shell commands, team setup, and updates: see the [marketplace README](../../README.md#install).

## Quick start

Five commands cover the everyday flow (the first is optional):

```
/foreman:init                                    # 0. optional: set up workbench/ and your project's defaults
/foreman:new add login with email and Google     # 1. describe the feature (or pass working file paths)
/foreman:approve P-01                            # 2. review the plan and contract, then approve
/foreman:run                                     # 3. run the next ready task (repeat)
/foreman:status                                  # any time: where things stand
```

Only have an idea? `/foreman:interview <idea>` questions you like a tech lead until every part is clear, then writes the same plan and contract.

Not sure which command you need? Type `/foreman:ask <what you want>`.

## Example session

```
> /foreman:new add a /health endpoint returning {status:"ok"} and the app version
  Add a foreman block to CLAUDE.local.md so Claude knows about workbench/?  > yes
  Applied settings: Version control git, Workbench ignored, Output Concise, Fix rounds 4, CLAUDE.md yes (change with /foreman:settings)
  Feature review - 2 findings:
    1. Where does the version come from? (unclear)
    2. Auth required on /health? (missing)
  ... you answer ...
  Created P-01 health-endpoint: 2 tasks (TASK-01 route, TASK-02 tests). Review, then /foreman:approve P-01

> /foreman:approve P-01
  Approved. Ready: TASK-01

> /foreman:run
  Next ready task: P-01 TASK-01 (route). Run it?  > yes
  Pre-check OK. Worker running... Verified: 1 file changed, tests pass. TASK-01 Done. Ready: TASK-02

> /foreman:run
  ... TASK-02 Done. All tasks Done. Run /foreman:close P-01 now?  > yes
  Acceptance: 3/3 Pass. P-01 Done.
```

## Workflow in detail

0. **`/foreman:init`** (optional) - sets up `workbench/`, detects the version control (git, TFVC, or none), and asks every setting (Version control, Workbench, Output, Fix rounds, CLAUDE.md block), with your `/config` defaults as the recommended answers. It also agrees the project's **working rules defaults** (commit policy, auto-close, test commands, standards, when to ask), proposed from what it finds in the project; every new contract starts from them. Skip it and the first `new`, `interview`, or `import` sets up `workbench/` silently from your defaults. Run on an existing `workbench/`, it only adds what is missing and never overwrites.
1. **`/foreman:new [working file path(s)] [text]`** - Claude reads the feature description from one or more working files, from your text, or both (text then acts as extra notes over the files; conflicts are confirmed with you). Text alone is treated as the feature description. With no input it asks for files or text, or points you to `/foreman:interview`. It reviews the feature for missing / unclear / conflicting / non-applicable items, resolves each finding with you, explores the codebase, and creates the plan, contract (`Draft`), tracking, task files, and a doc skeleton. Readable working file formats: Markdown, text, PDF (not `.docx` - export it to PDF or paste the text).
   **Or `/foreman:interview [idea]`** - for an idea without a written description. Claude studies the codebase, then interviews you topic by topic (goal and users, flows, data, edge cases, security, performance, UI, integrations, migration, tests, acceptance criteria, out of scope) as a blunt tech lead: vague answers ("fast", "the usual way"), contradictions, and scope creep are challenged until the answer is concrete. It proposes the files expected to change for you to confirm, shows a coverage check, and only then creates the plan, contract, tracking, and tasks. Progress is saved after every round in `workbench/interviews/INT-NN-<slug>.md`; `/foreman:interview INT-NN` continues it in a later session.
2. **`/foreman:approve P-01`** - after you review the files.
3. **`/foreman:run [P-01] [TASK-01]`** - with no arguments, foreman proposes the next ready task; with only `TASK-01`, it uses the single active plan. The main agent first pre-checks the task against the current code. It looks at what changed in the task's files since the task was written (each task records a baseline: git commit, TFVC changeset, or date), at earlier foreman tasks that touched the same files, and at your own uncommitted changes in those files (it asks you what to do with them). Then it checks paths, evidence, dependencies, not already done, still matches the contract: small problems like stale line numbers are fixed and logged; big ones are shown to you. With the contract rule `Baseline tests: yes` (default), it also runs the tests before the worker starts, so tests that already fail are not counted against the worker. Then the worker implements the task; the main agent verifies it (diff vs. expected files, out of scope, required outcome, tests), marks it `Done` or `Hold`, updates the doc, and applies the contract's commit policy. If verification finds problems, the main agent automatically sends the same worker a fix round listing what to **Revert**, what is **Not done**, and what is **Wrong**, shows you `Fix round n/limit`, then verifies again - up to `Fix rounds` times (default 4). Issues still open after that put the task on `Hold` with the list.
4. **Repeat step 3** for each task. Use `/foreman:status` any time.
5. **Scope changed?** `/foreman:change P-01 <request>`. Small changes (Scope, Out of Scope, and Acceptance Criteria unchanged - e.g. splitting a task) are approved in the same step. Big changes set the contract to `Amended Pending Approval` and need `/foreman:approve` again.
6. **All tasks Done?** The feature is not Done yet: `/foreman:close P-01` verifies every Acceptance Criterion, runs the full tests, finalizes the doc, and marks the plan `Done`. The contract's **Auto-close** rule decides what happens when the last task finishes: `Ask` (default) - Claude asks whether to close now; `Yes` - Claude runs close automatically; `No` - you run it yourself.

## Commands

**Core**

| Command | Purpose |
|---------|---------|
| `/foreman:init` | Set up `workbench/`: ask every setting and the working rules defaults (repairs only what is missing if already set up) |
| `/foreman:new [working file path(s)] [text]` | Start a feature: feature review, plan, contract, tracking, subtasks |
| `/foreman:interview [idea \| INT-NN]` | Deep tech-lead interview about an idea, then plan, contract, tracking, subtasks (resumable) |
| `/foreman:approve <P-NN>` | Approve the contract (required before running tasks) |
| `/foreman:run [P-NN] [TASK-TT]` | Delegate one task to the worker, verify, update tracking and docs (no args = next ready task) |
| `/foreman:status [P-NN]` | Overview of all features, or details of one plan |

**Manage**

| Command | Purpose |
|---------|---------|
| `/foreman:change <P-NN> <request>` | Change request: amend contract/plan/tasks (small = approved inline, big = re-approval) |
| `/foreman:hold <P-NN> [TASK-TT] <reason>` | Put a task or plan on hold |
| `/foreman:resume <P-NN> [TASK-TT] [note]` | Resume a task or plan from hold |
| `/foreman:cancel <P-NN> [TASK-TT] <reason>` | Cancel a task or plan |
| `/foreman:close <P-NN>` | Verify acceptance criteria and full tests, finalize doc, mark plan Done |

**Maintain**

| Command | Purpose |
|---------|---------|
| `/foreman:import <path(s)>` | Move plans/tasks/progress from another workflow's local files into `workbench/` (preview first; originals untouched) |
| `/foreman:doctor [P-NN]` | Find inconsistencies in `workbench/`; fix them after your confirmation |
| `/foreman:report <P-NN>` | Write a stakeholder report to `workbench/reports/REP-NN-<slug>.md` (by the `foreman-reporter` subagent) |
| `/foreman:settings [vcs ...] [workbench ...] [output ...] [fix-rounds N] [claude-md ...] [rules] [reset]` | Settings menu: every setting with current value and default; change by choosing, or directly by argument; reset to defaults |

**Help**

| Command | Purpose |
|---------|---------|
| `/foreman:ask [what you want]` | Describe your need; get the right command with arguments filled in, and optionally run it |
| `/foreman:catalog` | List all commands, subagents, skills, and hooks in the plugin |

## Settings

There are two levels. You normally only touch the second.

| Level | Where | What | Change with |
|-------|-------|------|-------------|
| Your defaults (all projects) | Claude Code plugin config, asked when you enable the plugin | Default output style, workbench in version control, fix rounds, CLAUDE.md block | `/config` |
| This project | `workbench/INDEX.md` `Settings`, asked by `/foreman:init` or filled from your defaults on the first `/foreman:new`, `/foreman:interview`, or `/foreman:import` | Version control, Workbench, Output, Fix rounds, CLAUDE.md, working rules defaults (init only) | `/foreman:settings` |

| Setting | Values | Meaning |
|---------|--------|---------|
| Version control | `git`, `tfvc`, `none` | Detected from the project (`.git`, TFVC `$tf` / `.tfignore`); asked when nothing is found. See [Version control](#version-control-git-tfvc-or-none) |
| Workbench | `tracked`, `ignored` | Whether `workbench/` is kept in version control (default choice `ask` = asked once per project). Called `Git: committed / ignored` before 1.3.0; old lines keep working |
| Output | `Concise` (default), `Normal` | `Concise` keeps all foreman replies, worker reports, and files short and token-efficient - no other plugin needed. Affects foreman only. |
| Fix rounds | `0`-`10` (default `4`) | Automatic fix rounds before a failing task goes on `Hold` |
| CLAUDE.md | `yes`, `no` (default choice `ask`) | Whether foreman adds a short block about `workbench/` to your project instructions (see below) |

`/foreman:settings` without arguments shows every setting with its current value and its default (your `/config` default, or foreman's built-in one), marking values that differ. You then pick the groups to change - Project (Version control, Workbench, CLAUDE.md), Behavior (Output, Fix rounds), Working rules - and choose each value from a list, with the current and default values labeled. foreman shows a summary of the changes and their side effects (for example, the CLAUDE.md block moving or ignore file lines) and applies them only after you confirm. `/foreman:settings reset` puts everything back to the defaults, with the same summary first. Direct changes still work: `/foreman:settings output normal`.

If a project's settings are missing, the session start summary tells you to run `/foreman:settings`.

### CLAUDE.md block

With `CLAUDE.md: yes`, foreman adds a short block to your project instructions, so Claude knows about `workbench/` in every session, even when you don't run a foreman command: it changes `workbench/` only through foreman commands, checks the active plan before feature work, stays within the contract's scope, and suggests the matching `/foreman:*` command.

- **Where**: `CLAUDE.md` when `workbench/` is tracked (shared with your team), `CLAUDE.local.md` when it is ignored (only you; foreman adds it to `.gitignore` or `.tfignore`). Changing Workbench with `/foreman:settings` moves the block.
- **Yours to control**: the block sits between `<!-- foreman:start -->` and `<!-- foreman:end -->` markers (Claude Code hides these comments from Claude). Foreman never touches anything outside them. `/foreman:settings claude-md no` removes it; `/foreman:doctor` refreshes it after a foreman update.
- **Projects with `AGENTS.md` only**: creating a CLAUDE file would make Claude Code stop reading `AGENTS.md`, so foreman asks first and, if you agree, starts the file with `@AGENTS.md` to keep it loaded.
- The block starts with "If the foreman plugin is installed", so Claude ignores it once the plugin is gone. It still stays in the file: run `/foreman:settings claude-md no` before you uninstall foreman to remove it.

## Permissions

Foreman respects your permission mode. Commands pre-approve only edits inside `workbench/` and read-only version control commands (`git status`, `git diff`, `git ls-files`, `git log`, `tf status`, `tf diff`, `tf history`), through Bash or PowerShell. Every other edit or command - by the main agent or the worker - asks you as usual in manual mode. In `acceptEdits`, auto, or bypass mode, Claude Code runs the worker in that same mode.

Changes to `workbench/` never ask you: a PreToolUse hook lets the main agent change files there at any time (also after you answer a question and after the worker ran), plus foreman's own few shell commands inside `workbench/` (creating its folders, snapshots). Subagents - the worker and the reporter - cannot change `workbench/` at all; the hook refuses without asking you, and the worker reports needed task-file corrections for the main agent to apply. The hook makes no decision in plan mode, for a `workbench/` folder without `INDEX.md` (not foreman's), or when your settings deny Edit / Write there.

The hook needs Node.js. Without it, the pre-approvals in the commands still cover `workbench/` edits, but only during the turn of the command and only until the worker starts, so you may be asked.

## Version control: git, TFVC, or none

foreman works with git, with Team Foundation Version Control (Azure DevOps Server / TFS), and without version control.

| | git | TFVC | none |
|-|-----|------|------|
| How foreman sees a task's changes | `git diff` | `tf diff` / `tf status` when `tf.exe` works, plus a snapshot of the task's files | snapshot of the task's files (temporary, in `workbench/.baseline/`) |
| Commits / check-ins | per the contract's commit policy | never - you check in | - |
| Ignore file | `.gitignore` | `.tfignore` | - |
| Read-only files (server workspace) | - | checked before the worker starts: foreman runs `tf checkout` (with `tf.exe`, on your approval) or asks you to check out in Visual Studio | - |
| Deletes, renames, new files | worker (listed files only) | foreman proposes `tf delete` / `tf rename` / `tf add`, or lists them for you | worker (listed files only) |

Without `tf.exe` (or without version control), foreman still shows you the diff of every file the task changes, from its snapshot. Changes outside the task's file list are then found by modification time only.

## Switching from another workflow

`/foreman:import <folder or files>` reads your old plans, tasks, and trackers (any text format), maps them to features, tasks, and statuses, and shows a preview. Unknown status words get a proposed mapping for you to confirm. Nothing is written until you confirm. Unfinished features get a `Draft` contract (approve before running); fully finished features are imported as `Done` with a doc. Anything not found in the sources is marked `Missing - from import`, never invented. Your old files are never changed. Run `/foreman:doctor` afterwards.

## Subagents, skill, hooks

- **`foreman-worker`** (subagent, Sonnet) - implements one task per `/foreman:run`; never edits `workbench/`, never commits. It changes files only with the Edit and Write tools, so every change reaches you as a readable diff; Bash / PowerShell are only for running commands (tests, builds, named generators). Formatters run in check mode and their fixes are applied with Edit. When a named command (generator, install) or a listed delete/rename changes files, the main agent shows you their diff before the task can pass.
- **`foreman-reporter`** (subagent, Sonnet) - writes the stakeholder report for `/foreman:report`. It reads only the sections the report needs (plan overview, risks, and task order; contract scope and change requests; task statuses; doc acceptance), never task files or code, and cannot write any file. It returns the finished report, which the main session saves without a permission prompt; the feature files never enter the main session's context.
- **`foreman-guide`** (skill) - when you ask for foreman-type work without a command (e.g. "let's build X", "what's left?"), Claude suggests the matching `/foreman:*` command. It never runs it.
- **PreToolUse hook** (`workbench-guard`) - lets the main agent change `workbench/` without permission prompts and blocks subagents from changing it (see [Permissions](#permissions)). Requires Node.js on `PATH`; without it, the hook is skipped silently.
- **SessionStart hook** - at session start, if the project has `workbench/`, shows each active plan with its contract status, progress, tasks In Progress, next ready tasks, plans waiting for `/foreman:close`, and interviews in progress. Requires Node.js on `PATH`; without it, Claude Code reports a SessionStart hook error and shows no summary.

## Folder structure (in your project)

```
workbench/
├─ INDEX.md                                   # settings + all features
├─ plans/P-01-user-login.md
├─ contracts/CONT-01-user-login.md
├─ tracking/TRK-01-user-login.md
├─ subtasks/P-01-user-login/TASK-01-create-api.md
├─ docs/DOC-01-user-login.md
├─ interviews/INT-02-dark-mode.md             # only with /foreman:interview
├─ .baseline/P-01/TASK-01/...                 # temporary snapshots during /foreman:run (TFVC without tf.exe, no version control)
└─ reports/REP-01-user-login.md               # only after /foreman:report
```

- One feature = one plan, contract, tracking file, doc, and subtasks folder, all sharing the same 2-digit number and slug.
- Task numbers restart at `TASK-01` for each plan.

## Files

- **Plan** - Overview, Source, Feature Review Findings, Requirements, Technical Approach, Task Breakdown, Risks, Open Questions.
- **Contract** - Status, Scope, Out of Scope, Acceptance Criteria, Working Rules (commit policy, auto-close, tests, baseline tests, standards, when to ask), Change Requests (`FEAT-n`).
- **Tracking** - task table (status, updated, note); status History with who made each change (`User` / `Main agent` / `Worker`); Activity log of every user decision, worker action (files changed, commands run), and main agent action (task fixes, test runs, commits).
- **Task** - header table (Plan, Contract, Tracking, Depends On, Source, Created, Baseline), then Problem, Evidence, Required Outcome, Files Expected to Change, Out of Scope, Implementation, Report Requirements.
- **Doc** - updated after each completed task: Summary, Implemented Tasks, Architecture / Key Files, How to Extend, Acceptance, Known Limitations.
- **Interview** - Status, Idea, Coverage (each topic `Open` / `Covered` / `N/A`), Files Expected to Change, Rounds (question, answer, challenge), Decisions, Open Gaps.
- **Report** - Summary, Scope, Progress, Change Requests, Acceptance, Risks and Blockers, Next Steps.

## Statuses

- Tasks and plans: `Not Started`, `In Progress`, `Hold`, `Done`, `Canceled`.
- Contracts: `Draft`, `Approved`, `Amended Pending Approval`.
- Interviews: `In Progress`, `Done` (plan created), `Canceled`.

The main agent owns all status changes and may set `Hold` or `Canceled` itself (e.g. verification failed, blocked, obsolete), always recording the reason in the tracking History.

## License

[MIT](../../LICENSE.md)
