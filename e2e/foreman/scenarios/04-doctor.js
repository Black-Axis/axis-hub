// /foreman:doctor: seeded inconsistencies are found by wb.js check, then fixed.
const { feature, check, assertClean, appendRow, today, wb, wbOk } = require('../lib');

module.exports = {
  name: 'doctor finds seeded problems; clean after the fixes',
  fixture: 'notes-api',
  covers: ['command:doctor', 'wb:check', 'wb:refresh', 'wb:status', 'wb:continue'],
  run(p, assert) {
    const f2 = feature(p, '02');
    const f3 = feature(p, '03');
    const task2 = 'workbench/subtasks/P-02-search-notes/TASK-02-filter-notes.md';
    const task3 = 'workbench/subtasks/P-02-search-notes/TASK-03-readme-search.md';
    const seeds = [
      ['TRK status differs from its last History entry', () => p.edit(f2.trk, /(\| \[TASK-01\][^\n]*\| )Done( \|)/, '$1Hold$2'), /TASK-01 is "Hold" but its last History entry says "Done"/],
      ['task file missing', () => p.remove(task2), /TASK-02 has no task file/],
      ['task file Status differs from TRK', () => p.edit(task3, '| Status | Not Started |', '| Status | Done |'), /TASK-03-readme-search\.md: Status "Done" but TRK says "Not Started"/],
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

    p.step('older task file without a Status row: a note; refresh adds it from TRK');
    p.edit(task3, '| Status | Not Started |\n', '');
    const n = check(p);
    assert.strictEqual(n.code, 0, n.out);
    assert.ok(n.notes.some((x) => /TASK-03-readme-search\.md: no Status header row/.test(x)), n.out);
    assert.match(wbOk(p, 'refresh', 'P-02'), /^TASK-03 task file Status: Not Started$/m);
    assert.match(p.read(task3), /\| Field \| Value \|\n\|-------\|-------\|\n\| Status \| Not Started \|\n\| Plan \|/);
    assertClean(p);

    p.step('missing INDEX row: status, continue, and refresh fail before writing anything (#82)');
    p.edit('workbench/INDEX.md', /\| 02 \| Search notes \|[^\n]*\n/, '');
    const snapshot = () => p.files('workbench').map((f) => `${f}\n${p.read(f)}`).join('\n');
    const before = snapshot();
    for (const args of [
      ['status', 'P-02', 'TASK-02', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-02 TASK-02'],
      ['status', 'P-02', 'Hold', '--by', 'User', '--reason', 'x'],
      ['refresh', 'P-02'],
    ]) {
      const r = wb(p, ...args);
      assert.strictEqual(r.code, 1, args.join(' '));
      assert.match(r.out, /^ERROR: INDEX\.md has no Features row for P-02$/, args.join(' '));
      assert.strictEqual(snapshot(), before, `${args.join(' ')}: nothing written`);
    }
    p.git('checkout', '--', '.');
    wbOk(p, 'status', 'P-02', 'TASK-02', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-02 TASK-02');
    p.commit('TASK-02 In Progress');
    p.edit('workbench/INDEX.md', /\| 02 \| Search notes \|[^\n]*\n/, '');
    const running = snapshot();
    const cont = wb(p, 'continue', 'P-02', 'TASK-02', '--by', 'User', '--reason', 'run continued');
    assert.match(cont.out, /^ERROR: INDEX\.md has no Features row for P-02$/);
    assert.strictEqual(snapshot(), running, 'continue: nothing written');
    p.git('checkout', '--', '.');
    assertClean(p);
  },
};
