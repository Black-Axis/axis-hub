// Fix rounds up to the limit -> Hold -> resume -> run continues the task; round on a Done task; cancel; plan hold.
const { feature, wb, wbOk, assertClean, trk, task, indexRow, appendRow, activity, today } = require('../lib');

module.exports = {
  name: 'fix rounds, Hold, resume, round on a Done task, cancel, plan hold',
  fixture: 'notes-api',
  covers: ['command:round', 'command:hold', 'command:resume', 'command:cancel', 'command:run', 'wb:continue'],
  run(p, assert) {
    const f = feature(p, '02');
    const limit = Number(/- Fix rounds: (\d+)/.exec(p.read('workbench/INDEX.md'))[1]);

    p.step('run P-02 TASK-02: In Progress');
    wbOk(p, 'status', 'P-02', 'TASK-02', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-02 TASK-02', '--note', 'worker running');

    p.step('wb.js refuses a no-op status change (fix rounds are written by hand)');
    const same = wb(p, 'status', 'P-02', 'TASK-02', 'In Progress', '--by', 'Main agent', '--reason', 'x');
    assert.strictEqual(same.code, 1);
    assert.match(same.out, /^ERROR: TASK-02 is already In Progress/);

    p.step(`fix rounds 1..${limit} (INDEX Fix rounds): History and Activity rows by hand`);
    for (let n = 1; n <= limit; n++) {
      appendRow(p, f.trk, 'History', [today(), 'TASK-02', 'In Progress -> In Progress', 'Main agent', `Fix round ${n}: 1 issues`]);
      activity(p, '02', 'TASK-02', 'Main agent', 'Action', `fix round ${n} feedback: Wrong - spec/notes.spec.js \\| filter keeps order`);
    }
    assertClean(p, 'P-02');
    assert.strictEqual(trk(p, '02').history.filter((h) => h.target === 'TASK-02' && /^Fix round \d/.test(h.reason)).length, limit);

    p.step('limit reached: Hold with the remaining issues');
    wbOk(p, 'status', 'P-02', 'TASK-02', 'Hold', '--by', 'Main agent', '--reason', `Verification failed after ${limit} fix rounds`, '--note', 'Wrong: order not kept');
    assert.strictEqual(task(p, '02', 'TASK-02').status, 'Hold');
    assert.strictEqual(indexRow(p, '02').progress, '1/3 Done');
    assert.strictEqual(wbOk(p, 'ready', 'P-02'), 'none');
    assert.match(wbOk(p, 'chain', 'P-02'), /^blocked: P-02 TASK-03 .*\(waits for TASK-02 Hold\)$/m);
    assertClean(p, 'P-02');

    p.step('resume: back to the status before Hold');
    const before = trk(p, '02').history.filter((h) => h.target === 'TASK-02' && / -> Hold$/.test(h.change)).pop();
    assert.strictEqual(before.change, 'In Progress -> Hold');
    wbOk(p, 'status', 'P-02', 'TASK-02', 'In Progress', '--by', 'User', '--reason', 'resumed: fixed by hand');

    p.step('run after resume: status refuses (already In Progress, points to continue); continue starts the new run');
    const again = wb(p, 'status', 'P-02', 'TASK-02', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-02 TASK-02');
    assert.match(again.out, /^ERROR: TASK-02 is already In Progress - to run it again, use: continue P-02 TASK-02/);
    assert.match(wb(p, 'continue', 'P-02', 'TASK-03', '--by', 'User', '--reason', 'x').out, /^ERROR: TASK-03 is Not Started, not In Progress/);
    const marker = 'workbench/.baseline/P-02/TASK-02.session';
    p.remove(marker); // as after an interrupted run on another machine: no marker
    const elsewhere = wb(p, 'continue', 'P-02', 'TASK-02', '--by', 'User', '--reason', 'run continued: after resume');
    assert.match(elsewhere.out, /^ERROR: P-02 has a task In Progress outside this session: TASK-02 \(no session marker/);
    const cont = wbOk(p, 'continue', 'P-02', 'TASK-02', '--by', 'User', '--reason', 'run continued: after resume', '--note', 'worker running', '--confirmed');
    assert.match(cont, /^TASK-02: In Progress \(continued\)$/m);
    assert.match(p.read(marker), /^- Session: e2e-session$/m, 'marker names this session');
    const h = trk(p, '02').history.pop();
    assert.deepStrictEqual([h.target, h.change, h.by, h.reason], ['TASK-02', 'In Progress -> In Progress', 'User', 'run continued: after resume']);
    assert.strictEqual(task(p, '02', 'TASK-02').note, 'worker running');
    assert.strictEqual(indexRow(p, '02').progress, '1/3 Done, TASK-02 In Progress');
    assert.match(wbOk(p, 'continue', 'P-02', 'TASK-02', '--by', 'Main agent', '--reason', 'run continued'), /continued/, 'own session: no --confirmed needed');
    assertClean(p, 'P-02');
    wbOk(p, 'status', 'P-02', 'TASK-02', 'Done', '--by', 'Main agent', '--reason', 'verified; 2 fix rounds');
    assert.ok(!p.exists(marker));
    assert.strictEqual(indexRow(p, '02').progress, '2/3 Done');

    p.step('round on a Done task: reopened by the user, verified again');
    wbOk(p, 'status', 'P-02', 'TASK-01', 'In Progress', '--by', 'User', '--reason', 'Round requested: empty q terms');
    appendRow(p, f.trk, 'History', [today(), 'TASK-01', 'In Progress -> In Progress', 'Main agent', 'Fix round 1: 1 issues (user round)']);
    wbOk(p, 'status', 'P-02', 'TASK-01', 'Done', '--by', 'Main agent', '--reason', 'verified; 0 fix rounds (user round 1)');
    assert.ok(trk(p, '02').history.some((h) => h.target === 'TASK-01' && h.change === 'Done -> In Progress' && h.by === 'User'));
    assertClean(p, 'P-02');

    p.step('cancel: a Canceled task leaves the progress count');
    wbOk(p, 'status', 'P-02', 'TASK-03', 'Canceled', '--by', 'User', '--reason', 'README is generated elsewhere');
    assert.strictEqual(indexRow(p, '02').progress, '2/2 Done');
    assert.match(wbOk(p, 'overview'), /P-02 search-notes .*all tasks Done - \/foreman:close P-02/);

    p.step('plan hold and resume');
    wbOk(p, 'status', 'P-02', 'Hold', '--by', 'User', '--reason', 'waiting for review');
    assert.strictEqual(trk(p, '02').planStatus, 'Hold');
    assert.match(wbOk(p, 'overview'), /P-02 search-notes .*on Hold - \/foreman:resume P-02/);
    assert.match(wb(p, 'chain', 'P-02').out, /^ERROR: P-02 is Hold/);
    wbOk(p, 'status', 'P-02', 'In Progress', '--by', 'User', '--reason', 'resumed');
    assertClean(p);
  },
};
