// Fix rounds up to the limit -> Hold -> resume; round on a Done task; cancel; plan hold.
const { feature, wb, wbOk, assertClean, trk, task, indexRow, appendRow, activity, today } = require('../lib');

module.exports = {
  name: 'fix rounds, Hold, resume, round on a Done task, cancel, plan hold',
  fixture: 'notes-api',
  covers: ['command:round', 'command:hold', 'command:resume', 'command:cancel'],
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
    wbOk(p, 'status', 'P-02', 'TASK-02', 'Done', '--by', 'Main agent', '--reason', 'verified; 2 fix rounds');
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
