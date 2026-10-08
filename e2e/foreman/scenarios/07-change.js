// /foreman:change on P-02: a small change is approved inline; a big one sets the
// contract to Amended Pending Approval and blocks runs until it is approved again.
const { feature, wb, wbOk, assertClean, trk, indexRow, appendRow, activity, today } = require('../lib');

module.exports = {
  name: 'small and big change requests, approval gate, new task in the chain',
  fixture: 'notes-api',
  covers: ['command:change'],
  run(p, assert) {
    const f = feature(p, '02');
    const tasksDir = 'workbench/subtasks/P-02-search-notes';

    p.step('small change: task detail edited, contract stays Approved, logged');
    p.edit(`${tasksDir}/TASK-03-readme-search.md`, 'One line under the routes list.', 'One line under the routes list, with an example `?q=milk|mom`.');
    activity(p, '02', 'TASK-03', 'Main agent', 'Action', 'change (small): example added to Implementation');
    assert.match(wbOk(p, 'chain', 'P-02'), /TASK-02/);
    assertClean(p, 'P-02');

    p.step('big change: FEAT-1 adds an acceptance criterion and a task; contract Amended Pending Approval');
    p.edit(f.contract, '- Status: Approved', '- Status: Amended Pending Approval');
    p.edit(f.contract, '3. `npm test` passes.', '3. `GET /notes?q=` with only spaces returns every note.\n4. `npm test` passes.');
    appendRow(p, f.contract, 'Change Requests', ['FEAT-1', today(), 'Blank q returns every note', 'new TASK-04; AC 3 added', '—']);
    p.edit(f.plan, '| TASK-03 | Document search in README | TASK-02 |', '| TASK-03 | Document search in README | TASK-02 |\n| TASK-04 | Blank q returns all notes | TASK-02 |');
    p.write(`${tasksDir}/TASK-04-blank-q.md`, p.read(`${tasksDir}/TASK-02-filter-notes.md`)
      .replace('# TASK-02: Filter GET /notes by q', '# TASK-04: Blank q returns all notes')
      .replace('| Source | Requirement 2 |', '| Source | FEAT-1 |'));
    appendRow(p, f.trk, 'Tasks', ['[TASK-04](../subtasks/P-02-search-notes/TASK-04-blank-q.md)', 'Blank q returns all notes', 'Not Started', today(), '']);
    activity(p, '02', 'P-02', 'User', 'Decision', 'FEAT-1 big change → yes, re-approval needed');
    assert.match(wbOk(p, 'refresh', 'P-02'), /Contract Status: Amended Pending Approval/);
    assert.strictEqual(indexRow(p, '02').contract, 'Amended Pending Approval');
    assert.strictEqual(indexRow(p, '02').progress, '1/4 Done');
    assertClean(p, 'P-02');

    p.step('runs are blocked until approved again');
    assert.strictEqual(wbOk(p, 'ready', 'P-02'), 'none');
    assert.match(wb(p, 'chain', 'P-02').out, /^ERROR: P-02 contract is "Amended Pending Approval", not Approved/);
    assert.match(wbOk(p, 'overview'), /P-02 search-notes .*needs \/foreman:approve P-02/);

    p.step('approve again: FEAT-1 gets its date; TASK-04 joins the chain after TASK-02');
    p.edit(f.contract, '- Status: Amended Pending Approval', '- Status: Approved');
    p.edit(f.contract, /(\| FEAT-1 \|[^\n]*\| )—( \|)/, `$1${today()}$2`);
    wbOk(p, 'refresh', 'P-02');
    assert.strictEqual(wbOk(p, 'chain', 'P-02'),
      '1. P-02 TASK-02 Filter GET /notes by q\n2. P-02 TASK-03 Document search in README\n3. P-02 TASK-04 Blank q returns all notes');
    assert.strictEqual(trk(p, '02').tasks.length, 4);
    assertClean(p);

    p.step('a change request approved while the contract is Draft is a finding');
    p.edit(f.contract, '- Status: Approved', '- Status: Draft');
    assert.match(wb(p, 'check', 'P-02').out, /change request FEAT-1 approved while the contract is Draft/);
  },
};
