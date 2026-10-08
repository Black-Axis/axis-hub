# e2e - plugin flows without a model

End-to-end scenarios that play a plugin's flows on a real sample project, with no model and no tokens. The plugin's own scripts and hooks run for real; the steps a command or agent would take (file edits, status changes) are done by the scenario, and the resulting files, git state, and hook decisions are checked.

What this covers: state changes, tracking, consistency checks, hook decisions, git checks, and that the templates, scripts, and command files fit together. What it does not cover: whether the model follows the command instructions - that needs a real session.

## Run

```
node e2e/run.js                      # every plugin and scenario, plus the coverage check
node e2e/run.js foreman              # one plugin
node e2e/run.js foreman 03-run-all-test-runs   # one scenario
node --test                          # also runs every scenario (e2e/e2e.test.js); CI does this
```

Each scenario builds its sample project in `e2e/.work/<plugin>/<scenario>/` (gitignored, inside the repository), as a fresh git repository. The folder is wiped when the scenario starts and kept afterwards, so a failed run can be inspected. Run it before every commit and push.

## Layout

```
e2e/
├─ run.js                     # runner with readable output
├─ e2e.test.js                # the same scenarios under node --test
├─ lib/harness.js             # Project: builds the sample project, runs scripts / hooks / git
└─ <plugin>/
   ├─ fixtures/<name>/        # sample project(s) the scenarios start from
   ├─ scenarios/NN-<name>.js  # one flow each
   ├─ lib.js                  # plugin helpers (optional)
   └─ components.js           # extra components to cover (optional)
```

## Writing a scenario

```js
module.exports = {
  name: 'what the flow checks',
  fixture: 'notes-api',                  // folder in e2e/<plugin>/fixtures/
  covers: ['command:run', 'wb:chain'],   // components this scenario tests
  run(p, assert) {
    p.step('first step');                // shown when the scenario fails
    p.edit('src/app.js', 'old', 'new');  // also: read, write, remove, exists, files
    p.git('status', '--porcelain');      // also: commit(message), run(cmd, args)
    p.script('scripts/wb.js', 'ready');  // a plugin script, CLAUDE_PROJECT_DIR set
    p.hook('session-start.js', {});      // a hook script with a JSON input
    p.test('spec/*.spec.js');            // the sample project's node:test specs
  },
};
```

In fixtures, `E2E_BASELINE` is replaced with the fixture's first commit hash (for example, task baselines).

## Coverage rule

Everything a plugin provides must be covered by at least one scenario's `covers`: `command:<name>` for each `commands/*.md`, `agent:<name>`, `skill:<name>`, `hook:<script>` for each script in `hooks/hooks.json`, plus what `e2e/<plugin>/components.js` adds (foreman: `wb:<subcommand>` of `scripts/wb.js`). The coverage check fails otherwise, so a new command, agent, skill, hook, or script subcommand needs a scenario in the same pull request.

## foreman

Fixture `notes-api`: a small Node notes API (`src/`, `spec/`) with a `workbench/` holding a closed feature (P-01), a feature in progress with a dependency chain (P-02), a Draft feature (P-03), and an open interview (INT-04).

| Scenario | Flow |
|----------|------|
| `01-lifecycle` | approval gate, approve, run one task (In Progress before the worker, worker edits, diff vs. start hash, tests), Done, close |
| `02-fix-rounds-hold` | fix rounds up to the INDEX limit, Hold, resume, round on a Done task, cancel, plan hold |
| `03-run-all-test-runs` | `run P-02 all` in chain order; targeted `Tests` rows; recorded state; when a baseline can be reused |
| `04-doctor` | seeded inconsistencies found by `wb.js check`, clean after the fixes |
| `05-hooks` | `workbench-guard` decisions for the main agent, worker, and reporter; every git / tf command in the vcs files gets the right decision; session start summary |
| `06-setup-new` | init on a fresh project; new, interview, import from the plugin templates; settings |
| `07-change` | small change inline; big change blocks runs until approved again; new task in the chain |
| `08-report-catalog-guide` | report sections and save rules, catalog frontmatter, guide gating |
