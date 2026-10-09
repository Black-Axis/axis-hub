// /foreman:run P-02 all: chain order, per-task flow; Test runs: targeted Tests row,
// state recording, and the git checks that allow or block a baseline reuse.
const { feature, wbOk, assertClean, task, activity, guard } = require('../lib');
const { field } = require('../../../plugins/foreman/scripts/lib.js');

// The task header row `| Tests | ... |` (backticks removed), or null for `—`.
function taskTests(p, file) {
  const m = /^\| Tests \| (.+) \|$/m.exec(p.read(file));
  const v = m ? m[1].replace(/`/g, '').trim() : '—';
  return v === '—' ? null : v;
}

// The reuse checks of "Test runs" in tasks.md: true when both print nothing.
function canReuse(p, hash) {
  const diff = p.git('diff', '--stat', hash, '--', '.', ':!workbench');
  const untracked = p.git('status', '--porcelain', '--untracked-files=all', '--', '.', ':!workbench');
  return diff === '' && untracked === '';
}

module.exports = {
  name: 'run all in chain order; targeted tests and baseline reuse',
  fixture: 'notes-api',
  covers: ['command:run', 'wb:chain'],
  run(p, assert) {
    const tasksDir = 'workbench/subtasks/P-02-search-notes';
    const fileOf = (id) => `${tasksDir}/${p.files(tasksDir).map((x) => x.split('/').pop()).find((x) => x.startsWith(`${id}-`))}`;

    p.step('chain: Not Started tasks in dependency order');
    assert.strictEqual(wbOk(p, 'chain', 'P-02'), '1. P-02 TASK-02 Filter GET /notes by q\n2. P-02 TASK-03 Document search in README');

    p.step('Full tests rule from the contract (default close)');
    assert.strictEqual(field(p.read(feature(p, '02').contract), 'Full tests').split(' ')[0], 'close');

    p.step('the reuse check commands need no prompt for the main agent');
    for (const command of ['git diff --stat abc123 -- . ":!workbench"', 'git status --porcelain --untracked-files=all -- . ":!workbench"', 'git stash create']) {
      assert.strictEqual(guard(p, 'Bash', { command }), 'allow', command);
    }

    activity(p, '02', 'P-02', 'User', 'Decision', 'run all: TASK-02, TASK-03 → yes');
    let recorded = null;
    const order = wbOk(p, 'chain', 'P-02').split('\n').map((l) => /TASK-\d+/.exec(l)[0]);
    for (const [k, id] of order.entries()) {
      p.step(`[${k + 1}/${order.length}] ${id}: still Not Started, dependencies Done`);
      assert.strictEqual(task(p, '02', id).status, 'Not Started');
      wbOk(p, 'status', 'P-02', id, 'In Progress', '--by', 'Main agent', '--reason', 'run all', '--note', 'worker running');

      p.step(`${id}: baseline - targeted tests, reuse only when provably unchanged`);
      const cmd = taskTests(p, fileOf(id));
      const patterns = cmd ? [cmd.replace(/^node --test /, '')] : ['spec/*.spec.js'];
      if (recorded && recorded.cmd === (cmd || 'npm test') && recorded.untracked === 'none' && canReuse(p, recorded.state)) {
        activity(p, '02', id, 'Main agent', 'Action', `baseline reused from ${recorded.id}: ${recorded.cmd} -> pass`);
      } else {
        const base = p.test(...patterns);
        assert.strictEqual(base.code, 0, base.out);
        activity(p, '02', id, 'Main agent', 'Action', `baseline tests: ${cmd || 'npm test'} -> pass${recorded ? ' (not reused)' : ''}`);
      }

      p.step(`${id}: worker change, verification with the same tests`);
      if (id === 'TASK-02') {
        p.edit('src/notes.js', '  sendJson(res, 200, store.slice().reverse());',
          '  const terms = parseTerms(req.url);\n  const all = store.slice().reverse();\n  sendJson(res, 200, terms.length ? all.filter((n) => terms.some((t) => n.text.toLowerCase().includes(t))) : all);');
      } else {
        p.edit('README.md', '- `POST /notes`', '- `GET /notes?q=a|b` - notes containing `a` or `b`, any case\n- `POST /notes`');
      }
      const verify = p.test(...patterns);
      assert.strictEqual(verify.code, 0, verify.out);
      const state = p.git('stash', 'create') || p.git('log', '-1', '--format=%H');
      const untracked = p.git('status', '--porcelain', '--untracked-files=all', '--', '.', ':!workbench') ? 'yes' : 'none';
      activity(p, '02', id, 'Main agent', 'Action', `tests: ${cmd || 'npm test'} -> pass; state: ${state}, untracked: ${untracked}`);
      wbOk(p, 'status', 'P-02', id, 'Done', '--by', 'Main agent', '--reason', 'verified; 0 fix rounds');
      recorded = { id, cmd: cmd || 'npm test', state, untracked };
    }

    p.step('all tasks Done; the plan waits for close');
    assert.strictEqual(wbOk(p, 'chain', 'P-02'), 'none');
    assertClean(p, 'P-02');

    p.step('reuse: allowed after a commit with no change, blocked by a code change or an untracked file');
    const head = p.commit('P-02 TASK-02, TASK-03');
    assert.ok(canReuse(p, head));
    p.edit('src/app.js', "'GET /health'", "'GET /healthz'");
    assert.ok(!canReuse(p, head), 'a tracked change blocks reuse');
    p.git('checkout', '--', 'src/app.js');
    assert.ok(canReuse(p, head));
    p.write('src/new-file.js', '// untracked\n');
    assert.ok(!canReuse(p, head), 'an untracked file blocks reuse');
    p.remove('src/new-file.js');
    p.write('workbench/tracking/scratch.md', 'x');
    assert.ok(canReuse(p, head), 'workbench/ is excluded');
  },
};
