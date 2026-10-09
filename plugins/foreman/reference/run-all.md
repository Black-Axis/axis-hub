# Foreman Run All

Read by `/foreman:run` only when its input has `all`, together with `commands/run.md`, whose steps it uses.

## Run all (`P-NN all`)

`P-NN all`, or `all` alone when exactly one plan is active (otherwise list the active plans and ask):
1. Run order: `wb.js chain P-NN` - every `Not Started` task in dependency order (including tasks that become ready as earlier ones finish), then `blocked:` lines for tasks waiting on one outside that order. `ERROR:` is refused as in step 1.3 of `run.md`; `none`: nothing to run, stop. Without Node, build the order from the TRK `Tasks` table and the plan's `Task Breakdown`.
2. Confirm once: show the numbered order and the blocked tasks, ask with `AskUserQuestion` whether to run them all, and log the answer (`User`, `Decision`, `run all: TASK-a, TASK-b, ...`). Never start without a yes. This replaces the per-task confirmation of step 1.1 of `run.md`.
3. Run each task through sections 1 (from step 1.2) to 7 of `run.md`, exactly as a single run, with all tracking and logging. Before each task, check it is still `Not Started` and its `Depends On` tasks are `Done`; if not, stop before it.
4. After each task, one progress line: `[k/n] TASK-TT <title>: Done (<f> fix rounds)` (or the status it ended in). No per-task report.
5. Questions of a normal run (commit confirmation, `tf` commands, Auto-close `Ask`) are asked as usual; on the expected answer the run continues.
6. **Stop** after the current task, starting no further one, when:
   - verification fails and the task goes on `Hold` (or it is `Canceled`);
   - the pre-check finds big problems, the user's own uncommitted changes in the task's files, or baseline tests that already fail - ask that step's question as a single run does and apply the answer to this task;
   - a permission was denied to you or the worker;
   - the user answers any question with anything other than continuing;
   - the next task is no longer `Not Started` or one of its `Depends On` tasks is not `Done`.
7. At the end, the section 8 report of `run.md` for the whole run: one row per task (result, fix rounds, files changed, tests), where and why the run stopped, the tasks not run, and the next step. End with the `/clear` line of section 8.
