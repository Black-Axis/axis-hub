// approve -> run (worker edits, verify) -> Done -> close, on the Draft feature P-03.
const { feature, wb, wbOk, assertClean, trk, task, indexRow, activity, guard, today } = require('../lib');

module.exports = {
  name: 'approval gate, run one task, verify, close',
  fixture: 'notes-api',
  covers: ['command:approve', 'command:run', 'command:close', 'command:status', 'agent:foreman-worker',
    'wb:status', 'wb:refresh', 'wb:ready', 'wb:overview'],
  run(p, assert) {
    const f = feature(p, '03');

    p.step('fixture is consistent');
    assertClean(p);

    p.step('run is refused while the contract is Draft');
    assert.doesNotMatch(wbOk(p, 'ready'), /P-03/);
    assert.match(wbOk(p, 'overview'), /P-03 note-stats \| .*\| needs \/foreman:approve P-03/);

    p.step('approve: contract Approved with a date, Activity logged, INDEX refreshed');
    p.edit(f.contract, '- Status: Draft\n', `- Status: Approved\n- Approved: ${today()}\n`);
    activity(p, '03', 'P-03', 'User', 'Decision', 'Approve CONT-03? → yes');
    assert.match(wbOk(p, 'refresh', 'P-03'), /Contract Status: Approved/);
    assert.strictEqual(indexRow(p, '03').contract, 'Approved');
    assert.match(wbOk(p, 'ready', 'P-03'), /^P-03 TASK-01 GET \/notes\/stats route$/);
    assertClean(p, 'P-03');

    p.step('run: In Progress saved before the worker (TRK row, History, Plan Status, INDEX)');
    const start = p.git('stash', 'create') || p.git('log', '-1', '--format=%H');
    wbOk(p, 'status', 'P-03', 'TASK-01', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-03 TASK-01', '--note', 'worker running');
    let t = trk(p, '03');
    assert.strictEqual(t.planStatus, 'In Progress');
    assert.strictEqual(task(p, '03', 'TASK-01').status, 'In Progress');
    assert.ok(t.history.some((h) => h.target === 'TASK-01' && h.change === 'Not Started -> In Progress' && h.by === 'User'));
    assert.ok(t.history.some((h) => h.target === 'P-03' && h.change === 'Not Started -> In Progress'));
    assert.strictEqual(indexRow(p, '03').progress, '0/1 Done, TASK-01 In Progress');

    p.step('worker: edits code with Edit / Write (no decision), workbench/ edits denied');
    assert.strictEqual(guard(p, 'Edit', { file_path: p.path('src/app.js') }, 'worker'), null);
    assert.strictEqual(guard(p, 'Edit', { file_path: p.path(f.trk) }, 'worker'), 'deny');
    p.edit('src/notes.js', 'module.exports = { list, create, reset, parseTerms };',
      'function stats(req, res) {\n  sendJson(res, 200, { notes: store.length });\n}\n\nmodule.exports = { list, create, reset, parseTerms, stats };');
    p.edit('src/app.js', "  ['POST /notes', notes.create],\n", "  ['POST /notes', notes.create],\n  ['GET /notes/stats', notes.stats],\n");
    p.edit('spec/notes.spec.js', /$/, `
test('GET /notes/stats counts notes', async () => {
  await withServer(async (base) => {
    await fetch(\`\${base}/notes\`, { method: 'POST', body: JSON.stringify({ text: 'a' }) });
    await fetch(\`\${base}/notes\`, { method: 'POST', body: JSON.stringify({ text: 'b' }) });
    assert.deepStrictEqual(await (await fetch(\`\${base}/notes/stats\`)).json(), { notes: 2 });
  });
});
`);

    p.step('verify: only the task\'s files changed since the start hash, tests pass');
    const changed = p.git('diff', '--name-only', start, '--', '.', ':!workbench').split('\n').filter(Boolean).sort();
    assert.deepStrictEqual(changed, ['spec/notes.spec.js', 'src/app.js', 'src/notes.js']);
    const tests = p.test('spec/*.spec.js');
    assert.strictEqual(tests.code, 0, tests.out);

    p.step('Done: task Done, plan stays In Progress until close');
    wbOk(p, 'status', 'P-03', 'TASK-01', 'Done', '--by', 'Main agent', '--reason', 'verified; 0 fix rounds', '--note', 'verified; 0 fix rounds');
    assert.strictEqual(trk(p, '03').planStatus, 'In Progress');
    assert.strictEqual(indexRow(p, '03').progress, '1/1 Done');
    assert.match(wbOk(p, 'overview'), /P-03 note-stats \| .*\| all tasks Done - \/foreman:close P-03/);
    assertClean(p, 'P-03');

    p.step('close: plan Done only through a Closed History entry');
    wbOk(p, 'status', 'P-03', 'Done', '--by', 'Main agent', '--reason', 'Closed: 1/1 acceptance criteria pass');
    assert.strictEqual(trk(p, '03').planStatus, 'Done');
    assert.match(wbOk(p, 'overview'), /P-03 note-stats \| Plan: Done .*\| closed/);
    assertClean(p);

    p.step('status: Done plan without a Closed entry is a finding');
    p.edit(f.trk, '| Closed: 1/1 acceptance criteria pass |', '| finished |');
    assert.match(wb(p, 'check', 'P-03').out, /plan is Done without a "Closed" or "Imported" History entry/);
  },
};
