# foreman

Plan, contract, track, delegate, and document feature work with Claude Code.

The main agent acts as the foreman: it reviews requirements, writes the plan, agrees a contract with you, and tracks every task. Implementation of each task is delegated - one task at a time, chosen by you - to the `foreman-worker` subagent running on Sonnet. The main agent then verifies the result, runs tests, and updates tracking and docs.

## Install

```
/plugin marketplace add https://github.com/Black-Axis/axis-hub.git
/plugin install foreman@axis-hub
```

Other sources (SSH, pinned versions, local clone), shell commands, team setup, and updates: see the [marketplace README](../../README.md#install).

## Quick start

Four commands cover the everyday flow:

```
/foreman:new add login with email and Google     # 1. describe the feature (or pass working file paths)
/foreman:approve P-01                            # 2. review the plan and contract, then approve
/foreman:run                                     # 3. run the next ready task (repeat)
/foreman:status                                  # any time: where things stand
```

Not sure which command you need? Type `/foreman:ask <what you want>`.

## Example session

```
> /foreman:new add a /health endpoint returning {status:"ok"} and the app version
  Add a foreman block to CLAUDE.local.md so Claude knows about workbench/?  > yes
  Applied settings: Git ignored, Output Concise, Fix rounds 4, CLAUDE.md yes (change with /foreman:settings)
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

1. **`/foreman:new [working file path(s)] [text]`** - Claude reads the feature description from one or more working files, from your text, or both (text then acts as extra notes over the files; conflicts are confirmed with you). Text alone is treated as the feature description. With no input it asks for files or text, or interviews you. It reviews the feature for missing / unclear / conflicting / non-applicable items, resolves each finding with you, explores the codebase, and creates the plan, contract (`Draft`), tracking, task files, and a doc skeleton. Readable working file formats: Markdown, text, PDF (not `.docx` - export it to PDF or paste the text).
2. **`/foreman:approve P-01`** - after you review the files.
3. **`/foreman:run [P-01] [TASK-01]`** - with no arguments, foreman proposes the next ready task; with only `TASK-01`, it uses the single active plan. The main agent first pre-checks the task against the current code (paths, evidence, dependencies, not already done, still matches the contract): small problems like stale line numbers are fixed and logged; big ones are shown to you. Then the worker implements the task; the main agent verifies it (diff vs. expected files, out of scope, required outcome, tests), marks it `Done` or `Hold`, updates the doc, and applies the contract's commit policy. If verification finds problems, the main agent automatically sends the same worker a fix round listing what to **Revert**, what is **Not done**, and what is **Wrong**, shows you `Fix round n/limit`, then verifies again - up to `Fix rounds` times (default 4). Issues still open after that put the task on `Hold` with the list.
4. **Repeat step 3** for each task. Use `/foreman:status` any time.
5. **Scope changed?** `/foreman:change P-01 <request>`. Small changes (Scope, Out of Scope, and Acceptance Criteria unchanged - e.g. splitting a task) are approved in the same step. Big changes set the contract to `Amended Pending Approval` and need `/foreman:approve` again.
6. **All tasks Done?** The feature is not Done yet: `/foreman:close P-01` verifies every Acceptance Criterion, runs the full tests, finalizes the doc, and marks the plan `Done`. The contract's **Auto-close** rule decides what happens when the last task finishes: `Ask` (default) - Claude asks whether to close now; `Yes` - Claude runs close automatically; `No` - you run it yourself.

## Commands

**Core**

| Command | Purpose |
|---------|---------|
| `/foreman:new [working file path(s)] [text]` | Start a feature: feature review, plan, contract, tracking, subtasks |
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
| `/foreman:report <P-NN>` | Write a stakeholder report to `workbench/reports/REP-NN-<slug>.md` |
| `/foreman:settings [git ...] [output ...] [fix-rounds N]` | View or change this project's settings |

**Help**

| Command | Purpose |
|---------|---------|
| `/foreman:ask [what you want]` | Describe your need; get the right command with arguments filled in, and optionally run it |
| `/foreman:catalog` | List all commands, subagents, skills, and hooks in the plugin |

## Settings

There are two levels. You normally only touch the second.

| Level | Where | What | Change with |
|-------|-------|------|-------------|
| Your defaults (all projects) | Claude Code plugin config, asked when you enable the plugin | Default output style, git choice, fix rounds, CLAUDE.md block | `/config` |
| This project | `workbench/INDEX.md` `Settings`, filled from your defaults on the first `/foreman:new` or `/foreman:import` | Git, Output, Fix rounds, CLAUDE.md | `/foreman:settings` |

| Setting | Values | Meaning |
|---------|--------|---------|
| Git | `committed`, `ignored` | Whether `workbench/` is tracked by git (default choice `ask` = asked once per project) |
| Output | `Concise` (default), `Normal` | `Concise` keeps all foreman replies, worker reports, and files short and token-efficient - no other plugin needed. Affects foreman only. |
| Fix rounds | `0`-`10` (default `4`) | Automatic fix rounds before a failing task goes on `Hold` |
| CLAUDE.md | `yes`, `no` (default choice `ask`) | Whether foreman adds a short block about `workbench/` to your project instructions (see below) |

If a project's settings are missing, the session start summary tells you to run `/foreman:settings`.

### CLAUDE.md block

With `CLAUDE.md: yes`, foreman adds a short block to your project instructions, so Claude knows about `workbench/` in every session, even when you don't run a foreman command: it changes `workbench/` only through foreman commands, checks the active plan before feature work, stays within the contract's scope, and suggests the matching `/foreman:*` command.

- **Where**: `CLAUDE.md` when `workbench/` is committed (shared with your team), `CLAUDE.local.md` when it is git-ignored (only you; foreman adds it to `.gitignore`). Changing Git with `/foreman:settings` moves the block.
- **Yours to control**: the block sits between `<!-- foreman:start -->` and `<!-- foreman:end -->` markers (Claude Code hides these comments from Claude). Foreman never touches anything outside them. `/foreman:settings claude-md no` removes it; `/foreman:doctor` refreshes it after a foreman update.
- **Projects with `AGENTS.md` only**: creating a CLAUDE file would make Claude Code stop reading `AGENTS.md`, so foreman asks first and, if you agree, starts the file with `@AGENTS.md` to keep it loaded.
- The block starts with "If the foreman plugin is installed", so it does nothing after you remove the plugin.

## Permissions

Foreman respects your permission mode. Commands pre-approve only edits inside `workbench/` and read-only git (`status`, `diff`, `ls-files`). Every other edit or command - by the main agent or the worker - asks you as usual in manual mode. In `acceptEdits`, auto, or bypass mode, Claude Code runs the worker in that same mode.

## Switching from another workflow

`/foreman:import <folder or files>` reads your old plans, tasks, and trackers (any text format), maps them to features, tasks, and statuses, and shows a preview. Unknown status words get a proposed mapping for you to confirm. Nothing is written until you confirm. Unfinished features get a `Draft` contract (approve before running); fully finished features are imported as `Done` with a doc. Anything not found in the sources is marked `Missing - from import`, never invented. Your old files are never changed. Run `/foreman:doctor` afterwards.

## Subagent, skill, hook

- **`foreman-worker`** (subagent, Sonnet) - implements one task per `/foreman:run`; never edits `workbench/`, never commits.
- **`foreman-guide`** (skill) - when you ask for foreman-type work without a command (e.g. "let's build X", "what's left?"), Claude suggests the matching `/foreman:*` command. It never runs it.
- **SessionStart hook** - at session start, if the project has `workbench/`, shows each active plan with its contract status, progress, tasks In Progress, next ready tasks, and plans waiting for `/foreman:close`. Requires Node.js on `PATH`; without it the hook does nothing.

## Folder structure (in your project)

```
workbench/
├─ INDEX.md                                   # settings + all features
├─ plans/P-01-user-login.md
├─ contracts/CONT-01-user-login.md
├─ tracking/TRK-01-user-login.md
├─ subtasks/P-01-user-login/TASK-01-create-api.md
├─ docs/DOC-01-user-login.md
└─ reports/REP-01-user-login.md               # only after /foreman:report
```

- One feature = one plan, contract, tracking file, doc, and subtasks folder, all sharing the same 2-digit number and slug.
- Task numbers restart at `TASK-01` for each plan.

## Files

- **Plan** - Overview, Source, Feature Review Findings, Requirements, Technical Approach, Task Breakdown, Risks, Open Questions.
- **Contract** - Status, Scope, Out of Scope, Acceptance Criteria, Working Rules (commit policy, auto-close, tests, standards, when to ask), Change Requests (`FEAT-n`).
- **Tracking** - task table (status, updated, note); status History with who made each change (`User` / `Main agent` / `Worker`); Activity log of every user decision, worker action (files changed, commands run), and main agent action (task fixes, test runs, commits).
- **Task** - header table (Plan, Contract, Tracking, Depends On, Source, Created), then Problem, Evidence, Required Outcome, Files Expected to Change, Out of Scope, Implementation, Report Requirements.
- **Doc** - updated after each completed task: Summary, Implemented Tasks, Architecture / Key Files, How to Extend, Acceptance, Known Limitations.
- **Report** - Summary, Scope, Progress, Change Requests, Acceptance, Risks and Blockers, Next Steps.

## Statuses

- Tasks and plans: `Not Started`, `In Progress`, `Hold`, `Done`, `Canceled`.
- Contracts: `Draft`, `Approved`, `Amended Pending Approval`.

The main agent owns all status changes and may set `Hold` or `Canceled` itself (e.g. verification failed, blocked, obsolete), always recording the reason in the tracking History.

## License

MIT
