# Changelog - foreman

All notable changes to this plugin. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.6.0] - 2026-10-09

### Added

- `/foreman:map [P-NN]` (#100): draws a Mermaid diagram of all features (or one) to `workbench/maps/MAP.md` (`MAP-NN.md` for one feature), overwritten each run. Each feature is a box with the files that exist - interview (with its status), plan, contract (status), tracking (progress), every task colored by status with dotted arrows for its dependencies, doc, and report - and a linked file list below the diagram. An interview without a plan gets its own box. Built by the new state script call `wb.js map [P-NN]`, so no feature file enters the main agent's context; without Node.js the command says the map needs it.

### Changed

- Smaller context per command (#103): `reference/rules.md` (28 KB, about 7,000 tokens, read by 18 commands) is split into a core of about 19 KB and topic files read only by the commands that use them - `reference/version-control.md` (INDEX lines, task baseline, snapshot cleanup), `tasks.md` (task size, test runs), `sessions.md`, and `project-block.md` (the CLAUDE.md block) - or only at the point that needs them: `detection.md` (when the INDEX `Version control` line is missing, setup, doctor), `snapshot.md` (tfvc and none, git only with untracked listed files), `run-all.md` (`/foreman:run ... all`), and the CLAUDE.md block rules through `setup.md` for `new`, `interview`, and `import`. Commands like `approve`, `resume`, `report`, and `ask` load about 2,400 tokens less, a single `/foreman:run` on git and `/foreman:new` about 700-900 less. `/foreman:status` and `/foreman:map` read no rules file (about 7,000 tokens less per call) and carry the few rules they need. The rules themselves are unchanged, only moved.

## [1.5.0] - 2026-10-09

### Added

- Faster test runs (#35): an optional task header row `Tests` holds the task's targeted test command (filled by `new`, `interview`, and `change` when the project has an obvious one). `/foreman:run` uses it for the baseline, verification, and fix rounds (the failing tests first after a fix round); the contract's full Tests run at `/foreman:close`, or also once after each task with the new Working Rule `Full tests: each task` (default `close`; in the INDEX defaults, `/foreman:settings`, and `doctor` / `wb.js check`). In git projects the baseline run is reused when nothing changed since the last recorded run of the same commands ("Test runs" in `reference/rules.md`).
- `/foreman:run P-NN all` (#28): runs every remaining task of a plan one after another after one confirmation - in dependency order, including tasks that become ready as earlier ones finish (`wb.js chain P-NN`). Each task goes through the full single-task flow and tracking; one progress line per task, one report at the end. Routine questions (commit, auto-close) are still asked; the run stops after a task that ends on `Hold`, a big pre-check problem, the user's own uncommitted changes, tests that already fail, a denied permission, or any answer other than continuing.
- `/foreman:round [P-NN] [TASK-TT] [what is wrong]`: send a task back to the worker when its result is wrong or incomplete, also after it was marked `Done` (#21). The main agent sorts your findings into Revert / Not done / Wrong, re-checks the task from scratch and adds what it finds, lets you confirm the lists, reopens the task (`By: User`), and runs the fix round with the normal verification and automatic fix rounds (limit counted again). It works when the original worker is gone (a new worker gets `Fix round: <n>`); closed plans are refused with a pointer to `/foreman:change`. Listed in the README, catalog, and guide skill.
- `wb.js check [P-NN]` (#32): the mechanical `/foreman:doctor` checks in code - feature files and naming, numbering, task files vs tracking vs plan (titles too), valid statuses, History matching the tables, only task and plan rows in History, plan status derivation, `Done` only after close or import, contract fields, INDEX settings, Progress and Contract Status, leftover snapshots, task sections, interviews. `doctor` runs it and judges only version control detection, the ignore file, and the CLAUDE.md block; every command that changed a feature runs it at the end and points to `doctor` on findings.
- State script `scripts/wb.js` (Node, no dependencies), part of #32: `status` makes a task or plan status change in one write (tracking row, History, derived Plan Status, INDEX Progress), `refresh` recomputes INDEX Progress and Contract Status, and `ready`, `overview`, and `next-number` answer from the files. `run`, `round`, `hold`, `resume`, `cancel`, `close`, `approve`, `change`, `new`, `interview`, `import`, and `status` use it instead of editing status cells and counting by hand. Pre-approved in those commands and allowed by the `workbench-guard` hook for the main agent (also after the worker ran). Without Node.js, commands update the files by hand as before. The SessionStart hook shares its table reader (`scripts/lib.js`).
- Stricter verification in `/foreman:run`: every Required Outcome and Implementation point is marked `Pass` / `Fail` with evidence (file:line, test, command output) and logged in Activity; `/foreman:round` re-checks against it (#21).
- `foreman-reporter` subagent: `/foreman:report` now delegates the report to it (#22). It reads only the sections the report needs (never task files) and returns the finished report, which the main agent saves without a permission prompt; the feature files stay out of the main session's context.
- foreman logo: shown at the top of the README and set as the `icon` in `plugin.json` (#48).
- Worker model setting (#27): INDEX `Worker model` (`sonnet` default, `opus`, `haiku`) chooses the model of the `foreman-worker` subagent; a single task can override it with its header row `Worker model` (`—` = the project setting). `/foreman:run` passes it as the Agent tool's `model` (also for a new worker in a fix round). Set by `/foreman:init` and the first setup from the new user default `default_worker_model`, changed in the `/foreman:settings` Behavior group (`/foreman:settings worker-model opus`), validated by `wb.js check` / `/foreman:doctor`. A missing setting or row keeps today's behavior (`sonnet`).
- Task status in each task file (#20): the task file header table starts with a `Status` row, a mirror of the task's status in the tracking file (which stays the source of truth). `wb.js status` writes it in the same call as the tracking row, History, and INDEX, so every command that changes a status (`run`, `round`, `hold`, `resume`, `cancel`, `change`) keeps it in step; `wb.js refresh P-NN` rewrites all of a plan's task file rows and adds the row to older task files. `wb.js check` / `/foreman:doctor` reports a mismatch (fix: `refresh`) and notes older task files without the row, adding it on confirmation. The worker never changes it.
- Team support (#37): a "Working in a team" README section (tracked or ignored, one feature per branch, numbering, merge conflicts, several sessions). With git, `wb.js next-number` also skips feature numbers used on other local and fetched branches (read-only, no fetch). New `wb.js renumber P-NN <slug> [NN]` moves one feature to a new number - files, subtasks folder, IDs, links, INDEX row - and `/foreman:doctor` offers it for a duplicate number after you pick which feature keeps it. `wb.js check` / `doctor` report leftover merge conflict markers in `workbench/`. Session markers: a task going `In Progress` records the Claude Code session running it (`workbench/.baseline/P-NN/TASK-TT.session`, local only); `wb.js running [P-NN]` shows who runs each task (this session, another running session, an interrupted one, or unknown), and `wb.js status` refuses to start a task while another task of the same plan runs outside this session unless `--confirmed` (`/foreman:run` asks you first). `wb.js refresh` removes stale markers.

### Changed

- Smaller main agent context in `/foreman:run` (#26). The per-version-control rules moved out of `reference/rules.md` into `reference/vcs-git.md`, `vcs-tfvc.md`, and `vcs-none.md`; each command reads only the file for the project's version control, so a git project loads no TFVC or no-VCS text (same rules, new place; commands that need none of them, like `status` or `approve`, load 16% less). `run.md` is shorter (19.1 KB to 15.2 KB) with the same steps. Test output is kept to the failing tests and their exact errors, in replies and in the Activity log; a passing run is one line, and new task `Tests` rows prefer a quiet runner output (e.g. `node --test --test-reporter=dot`). Every run report ends with a `/clear` suggestion before the next run (`workbench/` holds all state).
- Task size rule in `reference/rules.md` (one checkable outcome, about 5 files or fewer, split by outcome), used by `new`, `interview`, and `change` (#24).
- README: version and Node.js requirement at the top; correct statement about the hook without Node.js; how to remove the CLAUDE.md block before uninstalling; `workbench/.baseline/` in the folder structure; license link (#48).

### Fixed

- `/foreman:hold` and `/foreman:cancel` of an `In Progress` task left its snapshot folder `workbench/.baseline/P-NN/TASK-TT/` (#84). `wb.js status` now deletes the folder, with the session marker, whenever a task leaves `In Progress`, from any command; `wb.js refresh P-NN` removes leftovers, which `/foreman:doctor` uses as the fix instead of a shell delete. Without Node, commands delete the folder as before.
- `wb.js check P-NN` reported merge conflicts in other features' task files whose name contained `-NN-` (e.g. `subtasks/P-02-x/TASK-01-y.md` under `P-01`) (#85). It now scans only INDEX and the feature's own files.
- The `workbench-guard` hook did not allow the state script when the plugin path had backslashes, as for a plugin installed on Windows (#93): `wb.js` calls after the worker ran asked for permission. The script path may now use either form; it must still be this plugin's `scripts/wb.js`.
- `/foreman:run` asked "run anyway?" after `/clear` for a task the same Claude Code window had started (#95): `/clear` starts a new session id but keeps the process. A session marker with this process id now counts as this session.
- `wb.js renumber P-NN <slug>` matched the slug as a prefix: with two features `tags` and `tags-v2` on the same number, it could renumber the INDEX row of `tags-v2` while moving the files of `tags` (#83). Rows and links now match the exact name.
- `wb.js status`, `continue`, and `refresh` wrote the tracking file, the task file `Status` row, and the session marker before failing with `ERROR: INDEX.md has no Features row` (#82); a retry then failed with `already In Progress`. They now check everything, INDEX included, before the first write, so an `ERROR:` changes no file.
- Instruction gaps (#41): no instruction asks `AskUserQuestion` outside its limits any more - `reference/rules.md` states them for every command (at most 4 questions per call, 2-4 options per question; long lists name the rest for "Other", a single candidate gets a real second choice); the setup asks its settings in two calls (4 + 2), `/foreman:settings` offers at most 4 Fix rounds values and never a single option for text settings, and an interview round asks 2-4 questions. A feature name in a non-Latin script (e.g. Arabic) gets a short English slug confirmed with the user, and keeps its original name as the title. `/foreman:new` and `/foreman:import` read a PDF over 10 pages in full, range by range, and say how many pages were read.
- `/foreman:run` on a task already `In Progress` - restored by `/foreman:resume`, or left by an interrupted run - failed with `TASK-TT is already In Progress` (#78). The run now continues it with the new `wb.js continue P-NN TASK-TT` (History `In Progress -> In Progress`, tracking Updated and Note, the session marker for this session; asks first when the task or another task of the plan runs outside this session). `/foreman:round` on an `In Progress` task uses it too.
- Without Node.js, every session start showed a SessionStart hook error (#25). Both hooks now run as `node "<script>"; exit 0`, which exits cleanly in Git Bash and in PowerShell (Windows without Git Bash) when `node` is missing; the summary and prompt-free `workbench/` changes are then skipped, with no error. README corrected.
- `/foreman:run` records `In Progress` completely (tracking row, History, plan status, INDEX) before the worker starts, and `Done` / `Hold` right after verification; before, the History rows were written after the worker finished, sometimes only in the next run (#50). INDEX Progress now shows running tasks, e.g. `1/3 Done, TASK-02 In Progress`; `/foreman:doctor` checks it.
- `workbench/` changes no longer ask for permission (#51). A new PreToolUse hook (`hooks/workbench-guard.js`) allows the main agent's edits in `workbench/` in every turn - also after the worker or reporter ran, where commands' pre-approvals no longer apply - and foreman's own fixed shell forms there (setup folders, snapshots). Subagents are blocked from changing `workbench/` without a prompt; the worker reports needed task-file corrections ("Task File Updates") and the main agent applies them. No decision in plan mode, for a `workbench/` folder that is not foreman's, or when settings deny edits there. Needs Node.js; skipped silently without it.
- Permission prompts after the user answered a question (#42). A command's pre-approved tools last only for the turn it runs in, so a plain-text answer started a new turn in which reading plugin templates was refused and `workbench/` edits asked for permission. Commands now read every template and reference file they need before the first question, and ask with the question dialog (`AskUserQuestion`, free text through "Other"), which keeps the turn. New rule "Questions and follow-up turns" in `reference/rules.md`; applied in `new`, `interview`, `import`, `change`, `doctor`, `run` (auto-close question), and workbench setup. `report` can now ask for a missing plan ID with the dialog.
- After the worker ran, `/foreman:run`'s TFVC read-only commands (`tf status`, `tf diff` during verification) asked for permission in manual mode, because a command's pre-approvals end with the main agent's first `Agent` call; `git stash create` asked outside the command's turn (#63). (Claude Code already runs `git status` / `diff` / `log` / `ls-files` without asking.) The `workbench-guard` hook now allows the main agent's single read-only commands - `git status`, `git diff`, `git ls-files`, `git log`, `git stash create`, `tf status`, `tf diff`, `tf history` - in foreman projects: never chained, piped, or redirected, never with `--output`, never for subagents, and not when the user's settings deny or ask for that command.
- In git projects, a task's diff mixed in earlier uncommitted changes (an earlier task's or the user's) in the same files, so the worker could be blamed for them and the user saw old changes (#38). `/foreman:run` now records a start hash with `git stash create` before the worker starts (it changes no file, index, branch, or stash list; pre-approved) and verifies with `git diff <start hash>`, also in fix rounds. Listed files that are untracked at the start (e.g. new files of an earlier task) are snapshotted, since `git stash create` skips untracked files. `/foreman:close` uses each task's start hash for its Out of Scope check. New "Start hash" rule in `reference/rules.md`.
- The worker could still change files through the shell; it was found only afterwards, from its Commands Run list (#31). The `workbench-guard` hook now refuses `foreman-worker` shell commands that write files: redirects into files, `tee`, `sed -i` / `perl -i`, `Set-Content` / `Add-Content` / `Out-File` / `Tee-Object`, `New-Item -Value`, and script one-liners that write files. Tests, builds, and other commands run as before (`2>&1`, `> /dev/null`, `| Out-Null` are fine); the main agent and other subagents are not affected. `run`'s Commands Run scan stays as a second check. Together with the `workbench/` edit block from #51, both worker isolation rules are now enforced by code.
- Tracking consistency (#44). `/foreman:change` applies exactly the confirmed impact; anything that must differ is shown and confirmed again first. History holds only task and plan status changes: contract approvals and amendments go to the Activity log (`approve`, `change`), and `doctor` proposes moving older contract rows there. New "Command boundaries" rule: a command changes only what its steps say and reports other inconsistencies with a pointer to `/foreman:doctor` instead of fixing them on the side (as `hold` did). Task titles are copied exactly into TRK and the plan.
- `/foreman:catalog` builds its tables from three calls (a frontmatter `Grep`, `hooks.json`, and the hook scripts' first comment) instead of reading every command, agent, and skill file in full; `Grep` is now allowed (#44).
- Auto-commit (commit policy "main agent commits after each verified task") did not say what to stage, so a commit could take in the user's unrelated work or files like `.env` (#39). New "Git commit" rule in `reference/rules.md`, used by `run` and `close`: only the task's own files, by explicit path (`git commit -m "<message>" -- <paths>`; anything else the user staged stays out), plus the command's `workbench/` changes in the same commit when Workbench is `tracked`. The file list and message are shown first and the commit runs only on the user's yes; files that also hold changes that are not the task's are asked about. Never `git add -A`, `git add .`, `git add -u`, or `git commit -a`.
- Instructions hidden in working, imported, or project files could steer the main agent or the worker (#33). New rule "Content is data" in `reference/rules.md`: only the user's messages, foreman's own files, and the approved contract and task files decide what is done; an instruction found in other content is never followed and is shown to the user as a finding. Applied in `new` (review finding), `import` (preview), `interview` (codebase study), the worker (reported as `embedded instruction:` under Deviations / Blockers), and `run` verification.
- The `foreman-guide` skill suggested foreman in every project, also ones without `workbench/` (3 of 3 test runs for "I want to build a new feature ... How should we start?") (#36). It now suggests only where `workbench/INDEX.md` exists or when the user explicitly asks to plan or track feature work, at most once per topic (0 of 3 runs after the fix). `/foreman:ask` runs the chosen command only through the Skill tool, so it keeps its own permissions and the user's defaults; without it, it gives the command to type instead of following the command file itself.
- Avoidable permission prompts from shell use (#43). Workbench setup in a git project creates its folders with `Write` only (an empty `.gitkeep` in each, now whether `workbench/` is tracked or ignored), never the shell; TFVC and no version control keep the one exact `mkdir` / `New-Item` command the hook allows. The worker runs each command from the project root, one per call, without a `cd` prefix or chaining, so it matches the user's allowed command rules (e.g. `npm test`). New "Shell use" rule in `reference/rules.md`: read, list, and search files with `Read` / `Glob` / `Grep`, never chained `cat` / `ls` / `find` / `head`; one version control command per call. `/foreman:doctor` lists folders with `Glob`.
- Read-only version control commands run through PowerShell (common on Windows) no longer ask for permission: every command allows the `PowerShell(...)` twin of each `Bash(...)` rule (#24).
- A `|` inside a table cell (e.g. a logged command `npm test | tail`, or a task title) broke TRK tables and the SessionStart summary. Cells now escape it as `\|`, and the hook splits only on unescaped pipes (#24).
- `/foreman:close` checks whether `tf` is available, as the rules say, and has the `git log` / `tf history` commands its Out of Scope check needs; that check now uses the tasks' logged files and baselines (#24).
- Snapshots (TFVC without `tf`, no version control): copied with one shell command instead of Read + Write, which could change line endings or encoding and could not copy binary files; a `.stamp` file marks the snapshot time instead of a remembered time; date baselines come from a command, never from memory. Snapshot folders are deleted with one shell command, and `/foreman:doctor` can delete leftover ones on confirmation (#24).
- `/foreman:doctor` reads no feature files to check them when Node is available (`wb.js check` does those checks), and only the files it fixes when applying fixes (#23).
- Docs (#34): the catalog's example hint for `/foreman:run` is `[P-NN] [TASK-TT]` (was `<P-NN> <TASK-TT>`); the README example session asks whether `workbench/` is tracked or ignored, as the default `ask` does. New tests fail when a command is missing from the README command tables, the catalog order, or the guide skill, or does not start by reading `reference/rules.md`.

## [1.4.0] - 2026-10-02

### Added

- `/foreman:settings` menu: without arguments it shows every setting with its current value and default (the user's `/config` default, or the built-in one), marks values that differ, then lets the user pick groups (Project, Behavior, Working rules) and choose each value from a list with `(current)` and `(default)` labels. Changes and their side effects are summarized and applied only after confirmation.
- `/foreman:settings reset`: every setting back to its default (Version control re-detected), with the same summary and confirmation.

## [1.3.0] - 2026-10-02

### Added

- Smarter `/foreman:run` pre-check, to cut fix rounds:
  - Task `Baseline` (git commit, TFVC changeset, or date) recorded when a task is written or changed; the pre-check looks at exactly what changed in the task's files since then.
  - Earlier foreman tasks that changed the same files are checked against this task's evidence and implementation.
  - The user's own uncommitted changes in the task's files are found before the worker starts; the user chooses to commit, stash / shelve, or include them.
  - Baseline tests (contract Working Rule `Baseline tests: yes | no`, default `yes`): tests run before the worker starts, and only new failures count against the worker.
- Version control support beyond git: INDEX setting `Version control: git | tfvc | none`, detected from the project (`.git`, TFVC `$tf` / `.tfignore`) and asked when nothing is found.
- TFVC (Azure DevOps Server / TFS): `.tfignore` instead of `.gitignore`; never checks in (the user checks in); `/foreman:run` pre-check finds read-only files of server workspaces and runs `tf checkout` (on approval) or asks the user to check out in Visual Studio; deletes, renames, and new files go through `tf delete` / `tf rename` / `tf add` on the user's yes, or are listed for the user. Works without `tf.exe`.
- Snapshots (`workbench/.baseline/`, temporary) for TFVC and projects without version control, so `/foreman:run` can still show the diff of every file a task changes.

### Changed

- INDEX `Git: committed | ignored` is now `Workbench: tracked | ignored`. Old `Git:` lines keep working; `/foreman:doctor` and `/foreman:settings` offer to rename them. The `default_git` plugin option accepts `tracked` (`committed` still works).
- The worker prompt has a `Version control` line; the worker never runs state-changing version control commands and, in TFVC projects, never deletes or renames files itself.
- Commit policy applies to git only; TFVC and none are always `never auto-commit (user checks in)`.

## [1.2.1] - 2026-10-02

### Fixed

- The worker sometimes edited files through PowerShell or shell commands, which the user could not review as a diff. It now changes file content only with `Edit` / `Write`; Bash and PowerShell are for running commands only. Formatters and linters run in check mode with fixes applied through `Edit`. Shell deletes and renames are allowed only for files the task lists for that; generators and installs only when the task or Working Rules name them.
- `/foreman:run` verification flags shell file writes as deviations and shows the user the full diff of every code or docs file changed outside `Edit` / `Write` (stat only for lockfiles and build output) before passing the task.

### Changed

- Worker tools include `PowerShell` for running PowerShell commands on Windows.
- Task template: each `Files Expected to Change` line states `edit`, `new`, `delete`, or `rename to <path>`.

## [1.2.0] - 2026-09-27

### Added

- `/foreman:init`: sets up `workbench/` and asks every setting (Git, Output, Fix rounds, CLAUDE.md block) with the user's defaults as recommended answers, plus project-wide working rules defaults proposed from the project. On an existing `workbench/` it only adds what is missing.
- INDEX `Working Rules Defaults` section: proposed for every new contract by `new`, `interview`, and `import`; changed with `/foreman:settings rules`; checked by `/foreman:doctor`.
- `.gitkeep` in each subfolder when `workbench/` is committed.

### Changed

- Setup steps moved to one shared file, `reference/setup.md` (Ask all / Auto modes), used by `init`, `new`, `interview`, and `import`.

## [1.1.0] - 2026-09-27

### Added

- `/foreman:interview [idea | INT-NN]`: a deep, tech-lead-style interview for a feature idea. Studies the codebase first, questions the user topic by topic, challenges vague or contradictory answers and scope creep, agrees the files expected to change, and runs a coverage check before creating the plan, contract, tracking, and tasks.
- `workbench/interviews/INT-NN-<slug>.md`: interview progress saved after every round; resumable in a later session. An interview reserves its feature number.
- SessionStart hook and `/foreman:status` list interviews in progress; `/foreman:doctor` checks interview files (check 13).

### Changed

- `/foreman:new` with no input no longer runs its own short interview; it points to `/foreman:interview`.
- Next feature number also counts `workbench/interviews/`.

## [1.0.0] - 2026-09-26

First release.

### Added

- Commands: `new`, `import`, `approve`, `run`, `status`, `change`, `hold`, `resume`, `cancel`, `close`, `doctor`, `report`, `settings`, `ask`, `catalog`.
- `foreman-worker` subagent (Sonnet) with path-only prompts and automatic fix rounds (Revert / Not done / Wrong).
- `foreman-guide` skill that suggests the right command.
- SessionStart hook summarizing active plans, ready tasks, and missing settings.
- `workbench/` structure: INDEX, plans, contracts, tracking (History with `By`, Activity log), subtasks, docs, reports.
- Settings: user defaults via plugin config, per-project values via `/foreman:settings` (Git, Output, Fix rounds, CLAUDE.md).
- Optional CLAUDE.md block: a short, marker-delimited section in `CLAUDE.md` (or `CLAUDE.local.md` when `workbench/` is git-ignored) that tells Claude about `workbench/` in every session.
- Concise output mode for token-efficient replies, reports, and files.
