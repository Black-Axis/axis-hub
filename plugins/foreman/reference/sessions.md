# Foreman Sessions

Part of the foreman shared rules (`${CLAUDE_PLUGIN_ROOT}/reference/rules.md`, "Topic files"). Read by `run` and `round`.

## Sessions

Two Claude Code sessions in one project must not silently run tasks of the same plan. When a task goes `In Progress`, `wb.js status` writes a session marker `workbench/.baseline/P-NN/TASK-TT.session` (session id, Claude Code process id, start time; local, never in version control) and removes it, with the task's snapshot folder, when the task leaves `In Progress`. `wb.js running P-NN` shows who runs each `In Progress` task: this session (also an earlier session of the same Claude Code window, e.g. before `/clear`: same process id), another running session, an ended (interrupted) session, or unknown (no marker: another machine, by hand, an older foreman). `wb.js status P-NN TASK-TT In Progress` refuses with `ERROR:` while another task of the plan is `In Progress` outside this session; `/foreman:run` asks the user first and passes `--confirmed` only on yes. Without Node, there are no markers: ask before running a task of a plan that already has a task `In Progress`.
