# Foreman Fix Rounds

Read by `/foreman:run` only when verification fails (`run.md` section 6), and by `/foreman:round` when it sends a round. Steps and sections named here are those of `commands/run.md`.

## Fix rounds

Limit: `- Fix rounds:` in INDEX `Settings` (whole number; missing or invalid = `4`; `0` = none). Run rounds automatically, without asking, until verification passes or the limit is reached. Each round starts with one line: `Fix round <n>/<limit>: <count> issues sent to worker`. Then:
1. Feedback in three lists (omit empty ones); each item: file (and line), problem, expected result.
   - **Revert** - changes to undo (out-of-scope edits, unjustified files outside Files Expected to Change, unwanted changes).
   - **Not done** - missing parts of the Required Outcome, Implementation, or Report Requirements.
   - **Wrong** - done but incorrect: new test failures since the baseline (exact error), wrong behavior, broken rules or standards.
2. Send only the feedback lists to the **same** worker with SendMessage (agent ID from step 4). If that is not possible, launch a new `foreman-worker` with the step 4 lines plus `Fix round: <n>` and the lists.
3. Add a TRK History row by hand (no status change, no `wb.js`): `TASK-TT | In Progress -> In Progress | Main agent | Fix round <n>: <count> issues`, and an Activity row (`Main agent`, `Action`) with the items in short.
4. On the reply, verify again exactly as in step 5, not only the listed items: the failed tests first when the runner can select them, then the task's tests in full ("Test runs" in tasks.md).

Passes: section 7 (Pass). Limit reached with issues left: section 7 (Fail).
