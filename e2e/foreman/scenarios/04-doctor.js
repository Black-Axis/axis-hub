// /foreman:doctor: seeded inconsistencies are found by wb.js check, then fixed.
const { feature, check, assertClean, appendRow, today } = require('../lib');

module.exports = {
  name: 'doctor finds seeded problems; clean after the fixes',
  fixture: 'notes-api',
  covers: ['command:doctor', 'wb:check'],
  run(p, assert) {
    const f2 = feature(p, '02');
    const f3 = feature(p, '03');
    const task2 = 'workbench/subtasks/P-02-search-notes/TASK-02-filter-notes.md';
    const seeds = [
      ['TRK status differs from its last History entry', () => p.edit(f2.trk, /(\| \[TASK-01\][^\n]*\| )Done( \|)/, '$1Hold$2'), /TASK-01 is "Hold" but its last History entry says "Done"/],
      ['task file missing', () => p.remove(task2), /TASK-02 has no task file/],
      ['invalid Full tests in a contract', () => p.edit(f3.contract, /- Full tests: close/, '- Full tests: sometimes'), /invalid Full tests "sometimes"/],
      ['invalid Fix rounds setting', () => p.edit('workbench/INDEX.md', '- Fix rounds: 2', '- Fix rounds: 12'), /invalid Fix rounds value "12"/],
      ['INDEX progress out of date', () => p.edit('workbench/INDEX.md', '| Approved | 1/3 Done |', '| Approved | 2/3 Done |'), /P-02 Progress "2\/3 Done" should be/],
      ['leftover snapshot of a task not In Progress', () => p.write('workbench/.baseline/P-02/TASK-03/README.md', 'x'), /leftover snapshot of a task that is not In Progress/],
      ['contract status row in History', () => appendRow(p, f2.trk, 'History', [today(), 'P-02', 'Draft -> Approved (contract)', 'User', 'approved']), /not a task or plan status change/],
      ['unknown dependency', () => p.edit(f3.plan, '| TASK-01 | GET /notes/stats route | — |', '| TASK-01 | GET /notes/stats route | TASK-09 |'), /TASK-01 depends on unknown TASK-09/],
    ];

    p.step('fixture is clean');
    assertClean(p);

    for (const [what, seed, expect] of seeds) {
      p.step(`seed: ${what}`);
      seed();
    }

    p.step('check: exit 2, every seeded problem found');
    const c = check(p);
    assert.strictEqual(c.code, 2);
    for (const [what, , expect] of seeds) assert.ok(c.findings.some((x) => expect.test(x)), `not found: ${what}\n${c.out}`);
    assert.ok(c.notes.some((n) => /INT-04-dark-mode\.md: interview in progress/.test(n)), 'open interview is a note');

    p.step('fix (as doctor would after confirmation) and check again');
    p.git('checkout', '--', '.');
    p.remove('workbench/.baseline');
    assertClean(p);
  },
};
