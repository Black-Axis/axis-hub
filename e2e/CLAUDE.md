# CLAUDE.md - e2e

Guidance for working in `e2e/`. User-facing docs: [README.md](README.md).

## What it is

Scripted end-to-end scenarios that play a plugin's flows on a sample project with no model (no tokens). The plugin's real scripts and hooks run; the scenario does what a command or agent would do (file edits, `wb.js` calls, hook calls with real tool-call inputs) and asserts files, git state, and hook decisions. It does not test whether the model follows command instructions.

```
node e2e/run.js [plugin] [scenario]   # readable output, exit 1 on failure or missing coverage
node --test                           # e2e/e2e.test.js runs every scenario too (CI)
```

## Rules

- **Coverage**: every `commands/*.md`, `agents/*.md`, `skills/<name>/`, hook script in `hooks/hooks.json`, and (foreman) `wb.js` subcommand must appear in some scenario's `covers` (`command:<name>`, `agent:<name>`, `skill:<name>`, `hook:<script>`, `wb:<subcommand>`). The list comes from `components()` in `lib/harness.js` plus `<plugin>/components.js`. A `covers` entry must name a real component (the test rejects unknown names). Only list what the scenario actually exercises.
- **Work dir**: projects are built only in `e2e/.work/<plugin>/<scenario>/` (gitignored), never in the system temp folder. Wiped at scenario start, kept after it for inspection. `tests/links.test.js` skips it.
- **Fixtures** (`<plugin>/fixtures/<name>/`): a full sample project, copied and committed as a fresh git repo per scenario. Keep every fixture consistent: `wb.js check` must report no findings on it, its own specs must pass. `E2E_BASELINE` is replaced with the first commit hash (task `Baseline` rows). LF line endings (`.gitattributes`), so scenario patterns use `\n`. Specs live in `spec/*.spec.js`, never `test/` or `*.test.js`: the repo's `node --test` would pick those up.
- **Fixture changes ripple**: scenarios assert exact fixture facts (task titles, `1/3 Done`, the chain order). After changing a fixture, run all scenarios.
- **Scenarios are independent**: each starts from its fixture; never rely on another scenario's `.work` folder.
- When a plugin template, `check.js` rule, hook decision, or command flow changes, update or add the scenario step in the same PR. `fromTemplate` (foreman `lib.js`) fills the real templates and throws on a leftover `{{...}}`, so a template change that scenarios do not know fails loudly.
- No dependencies, Node only (CI uses Node 22); git must be on `PATH`.

## Layout

- `run.js` - runner; `e2e.test.js` - same scenarios under `node --test` plus the coverage test.
- `lib/harness.js` - `Project(plugin, id, fixture)`: `step`, `path`, `read`, `write`, `edit(file, from, to)` (throws when `from` does not match), `remove`, `exists`, `files(dir)`, `run(cmd, args)`, `git(...)` (throws on error), `commit(msg)`, `script(rel, ...args)`, `hook(script, input)` (`{ code, out, json }`), `test(...patterns)` (`node --test`). Env: `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, fixed git identity, fixed session (`CLAUDE_CODE_SESSION_ID=e2e-session`, `CLAUDE_PID` = the runner); `session(id, pid, fn)` runs `fn` as another Claude Code session.
- `<plugin>/scenarios/NN-<name>.js` - `{ name, fixture, covers, run(p, assert) }`; call `p.step(text)` before each part (the failure report names the last step).
- `foreman/lib.js` - `wb`, `wbOk` (asserts exit 0), `check` (findings / notes), `assertClean`, `trk` (parsed TRK), `task`, `indexRow`, `appendRow`, `activity`, `guard(p, tool, input, 'main' | 'worker' | 'reporter', extra)` (returns `allow` / `deny` / `null`), `fromTemplate(p, template, values)`, `feature(p, NN)`.

## foreman fixture `notes-api`

P-01 health-check (Done, closed), P-02 search-notes (In Progress: TASK-01 Done; TASK-02 depends on TASK-01, TASK-03 on TASK-02; TASK-01 title contains a `|`), P-03 note-stats (contract Draft), INT-04 dark-mode (interview In Progress). INDEX: git, Workbench tracked, Fix rounds 2, CLAUDE.md no, no `Worker model` line (an older project: it means `sonnet`).
