// Hooks on the real tool-call shapes: workbench-guard decisions for the main agent,
// the worker, and the reporter; the session start summary for each feature state.
const { feature, guard, wbOk } = require('../lib');

module.exports = {
  name: 'workbench-guard decisions and the session start summary',
  fixture: 'notes-api',
  covers: ['hook:workbench-guard', 'hook:session-start', 'agent:foreman-reporter'],
  run(p, assert) {
    const trk = p.path(feature(p, '02').trk);
    const wbJs = `node "${p.pluginRoot.split('\\').join('/')}/scripts/wb.js" ready`;
    const cases = [
      // [who, tool, input, expected]
      ['main', 'Edit', { file_path: trk }, 'allow'],
      ['main', 'Write', { file_path: p.path('workbench/reports/REP-02-search-notes.md') }, 'allow'],
      ['main', 'Edit', { file_path: p.path('src/app.js') }, null],
      ['main', 'Bash', { command: 'mkdir -p workbench/plans' }, 'allow'],
      ['main', 'Bash', { command: 'git status --porcelain' }, 'allow'],
      ['main', 'PowerShell', { command: 'git diff --stat HEAD' }, 'allow'],
      ['main', 'Bash', { command: 'git status && git push' }, null],
      ['main', 'Bash', { command: 'git diff > out.txt' }, null],
      ['main', 'Bash', { command: wbJs }, 'allow'],
      ['main', 'Bash', { command: 'git push origin main' }, null],
      ['worker', 'Edit', { file_path: p.path('src/notes.js') }, null],
      ['worker', 'Edit', { file_path: trk }, 'deny'],
      ['worker', 'Bash', { command: 'npm test' }, null],
      ['worker', 'Bash', { command: 'echo x > src/notes.js' }, 'deny'],
      ['worker', 'Bash', { command: "sed -i 's/a/b/' src/notes.js" }, 'deny'],
      ['worker', 'PowerShell', { command: "Set-Content src/notes.js 'x'" }, 'deny'],
      ['worker', 'Bash', { command: 'npm test 2>&1 > /dev/null' }, null],
      ['reporter', 'Write', { file_path: p.path('workbench/reports/REP-02-search-notes.md') }, 'deny'],
    ];
    for (const [who, tool, input, expected] of cases) {
      p.step(`guard: ${who} ${tool} ${input.command || input.file_path.slice(p.dir.length + 1)} -> ${expected}`);
      assert.strictEqual(guard(p, tool, input, who), expected);
    }

    p.step('guard: no decision in plan mode');
    assert.strictEqual(guard(p, 'Edit', { file_path: trk }, 'main', { permission_mode: 'plan' }), null);

    p.step('session start: one line per active feature and the open interview; closed P-01 left out');
    let r = p.hook('session-start.js');
    assert.strictEqual(r.code, 0);
    const msg = r.json.systemMessage;
    assert.match(msg, /P-02 search-notes — Plan: In Progress, Contract: Approved, 1\/3 Done\. Ready: TASK-02/);
    assert.match(msg, /P-03 note-stats — .*Needs \/foreman:approve P-03/);
    assert.match(msg, /INT-04 dark-mode — Interview in progress/);
    assert.doesNotMatch(msg, /P-01/);
    assert.strictEqual(r.json.hookSpecificOutput.hookEventName, 'SessionStart');

    p.step('session start follows status changes');
    wbOk(p, 'status', 'P-02', 'TASK-02', 'In Progress', '--by', 'User', '--reason', 'run');
    assert.match(p.hook('session-start.js').json.systemMessage, /P-02 search-notes — .*1\/3 Done\. In Progress: TASK-02/);

    p.step('without workbench/: guard and session start stay silent');
    p.remove('workbench');
    assert.strictEqual(p.hook('session-start.js').out, '');
    r = p.hook('workbench-guard.js', { tool_name: 'Bash', tool_input: { command: 'git status' } });
    assert.strictEqual(r.code, 0);
    assert.strictEqual(r.out, '');
  },
};
