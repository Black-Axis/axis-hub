# Foreman Task Rules

Part of the foreman shared rules (`${CLAUDE_PLUGIN_ROOT}/reference/rules.md`, "Topic files"). Read by `new`, `interview`, `change`, `run`, `round`, and `close`.

## Task size

A task must fit one worker run and be verifiable on its own:
- One clear outcome that a test, a command, or a short check can confirm.
- About 5 files or fewer in `Files Expected to Change` (tests included). Split a bigger task by outcome (e.g. data, logic, UI, tests), with `Depends On` between the parts.
- No task that only prepares work for another one without a checkable result of its own.

## Test runs

Which tests `/foreman:run` and `/foreman:close` run, so a slow suite does not run up to six times per task.

- **Task tests**: the optional task header row `Tests` holds the targeted command(s) for that task (one test file, one package), e.g. `node --test test/words.test.js`. `new`, `interview`, and `change` fill it when the project has an obvious targeted command for the task's files; otherwise, and in older tasks without the row, it is `—` and the contract's Tests apply. A task's tests are its `Tests` row when set, else the contract's Tests.
- **Full tests** (contract Working Rule, missing = `close`): `close` - during `/foreman:run`, a task with a `Tests` row runs only those (baseline, verification, fix rounds); the contract's Tests run in full at `/foreman:close`. `each task` - also run the contract's Tests once after the task's own tests pass, before `Done`; a new failure there fails verification like any other. `/foreman:close` always runs the contract's Tests in full, never a task's `Tests` row.
- **Fix rounds**: after a fix round, run the tests that failed first (when the test runner can select them, e.g. one test file or a name filter); once they pass, run the task's tests in full. Verification counts only the full run.
- **Baseline reuse**: whether the baseline run can be skipped, and how a test run's state is recorded, is "Baseline reuse" in the vcs file (git only; tfvc and none always run the baseline).
- **Output**: keep only what verification needs, in context, replies, the Activity log, and worker feedback. A passing run is one line (`<command> -> pass` with the count when shown). A failing run: the failing test names and their exact errors, nothing else - never the full output. When writing a task `Tests` row or the contract's Tests, prefer the runner's quiet or failures-only output when it has one and failures still print their errors (e.g. `node --test --test-reporter=dot`, `pytest -q`, `go test` without `-v`).
