// Team use: session markers stop a second session from silently running a task of a
// plan already running elsewhere; next-number sees other branches; two branches that
// both create P-05 merge with an INDEX conflict, then renumber fixes the collision.
const { spawnSync } = require('child_process');
const { wb, wbOk, check, assertClean, indexRow, trk } = require('../lib');

const MARKER = 'workbench/.baseline/P-02/TASK-02.session';

// A new feature NN-<slug> on the current branch, cloned from the fixture's P-03.
function cloneFeature(p, nn, slug, title) {
  const rename = (text) => text.split('note-stats').join(slug).split('Note stats').join(title)
    .replace(/\b(P|CONT|TRK|DOC)-03\b/g, `$1-${nn}`);
  for (const f of p.files('workbench').filter((x) => x.includes('03-note-stats'))) p.write(rename(f), rename(p.read(f)));
  const row = p.read('workbench/INDEX.md').split('\n').find((l) => l.startsWith('| 03 |'));
  p.write('workbench/INDEX.md', `${p.read('workbench/INDEX.md').replace(/\s*$/, '')}\n${rename(row).replace('| 03 |', `| ${nn} |`)}\n`);
}

module.exports = {
  name: 'team: concurrent sessions, numbers on other branches, merge conflict, renumber',
  fixture: 'notes-api',
  covers: ['command:run', 'command:doctor', 'command:new', 'wb:running', 'wb:renumber', 'wb:next-number', 'wb:status', 'wb:refresh', 'wb:check'],
  run(p, assert) {
    const other = process.ppid; // a live process that is not this session's
    const ended = spawnSync(process.execPath, ['-e', '']).pid; // a process that has ended

    p.step('run in session A: In Progress writes a session marker');
    assert.strictEqual(wbOk(p, 'running', 'P-02'), 'none');
    wbOk(p, 'status', 'P-02', 'TASK-02', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-02 TASK-02', '--note', 'worker running');
    assert.match(p.read(MARKER), /^- Session: e2e-session\n- Process: \d+\n- Started: \d{4}-\d{2}-\d{2} \d{2}:\d{2}\n$/);
    assert.match(wbOk(p, 'running', 'P-02'), /^P-02 TASK-02 Filter GET \/notes by q \| this session, since /);
    assertClean(p);

    p.step('session B: sees the task running elsewhere; status refuses without --confirmed');
    p.session('session-b', other, () => {
      assert.match(wbOk(p, 'running'), /^P-02 TASK-02 .* \| elsewhere: another Claude Code session \(process \d+\) is running, since /);
      const r = wb(p, 'status', 'P-02', 'TASK-03', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-02 TASK-03');
      assert.strictEqual(r.code, 1);
      assert.match(r.out, /^ERROR: P-02 has a task In Progress outside this session: TASK-02 \(another Claude Code session/);
      assert.strictEqual(trk(p, '02').tasks.find((t) => t.id === 'TASK-03').status, 'Not Started', 'nothing written');
      wbOk(p, 'status', 'P-02', 'TASK-03', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-02 TASK-03 (user confirmed)', '--confirmed');
      assert.ok(p.exists('workbench/.baseline/P-02/TASK-03.session'));
    });

    p.step('session A: leaving In Progress removes its marker; the other one stays');
    wbOk(p, 'status', 'P-02', 'TASK-02', 'Done', '--by', 'Main agent', '--reason', 'verified; 0 fix rounds');
    assert.ok(!p.exists(MARKER));
    assert.match(wbOk(p, 'running', 'P-02'), /TASK-03 .* \| elsewhere: another Claude Code session/);

    p.step('ended process, no process id');
    const m3 = 'workbench/.baseline/P-02/TASK-03.session';
    p.edit(m3, /- Process: \d+/, `- Process: ${ended}`);
    assert.match(wbOk(p, 'running', 'P-02'), /elsewhere: interrupted - its Claude Code session has ended, since /);
    p.edit(m3, /- Process: \d+/, '- Process: —');
    assert.match(wbOk(p, 'running', 'P-02'), /elsewhere: another session, running or ended \(no process id recorded\)/);
    p.step('same Claude Code window after /clear (same process, new session id): this window\'s task, no --confirmed (#95)');
    p.edit(m3, '- Process: —', `- Process: ${process.pid}`);
    assert.match(wbOk(p, 'running', 'P-02'), /^P-02 TASK-03 .* \| this Claude Code window \(an earlier session, e\.g\. before \/clear\), since /m);
    assert.match(wbOk(p, 'continue', 'P-02', 'TASK-03', '--by', 'User', '--reason', 'run continued: after /clear'), /continued/);
    assert.match(p.read(m3), /^- Session: e2e-session$/m, 'marker now names this session');
    p.step('no marker');
    p.remove(m3);
    assert.match(wbOk(p, 'running', 'P-02'), /elsewhere: no session marker - started on another machine/);

    p.step('Hold removes the marker folder once empty; a stale marker is a finding, refresh removes it');
    wbOk(p, 'status', 'P-02', 'TASK-03', 'Hold', '--by', 'Main agent', '--reason', 'interrupted run');
    assert.ok(!p.exists('workbench/.baseline/P-02'), 'empty P-02 folder removed');
    p.write('workbench/.baseline/P-02/TASK-01.session', '- Session: x\n- Process: 1\n- Started: 2026-10-01 10:00\n');
    assert.ok(check(p).findings.some((f) => /TASK-01\.session: leftover session marker .*wb\.js refresh P-02/.test(f)));
    assert.match(wbOk(p, 'refresh', 'P-02'), /^TASK-01 session marker removed \(not In Progress\)$/m);
    assertClean(p);
    p.commit('state');

    p.step('next-number sees numbers on other branches');
    assert.strictEqual(wbOk(p, 'next-number'), '05');
    p.git('checkout', '-q', '-b', 'bob');
    cloneFeature(p, '05', 'tags', 'Tags');
    assertClean(p);
    p.commit('bob: P-05 tags');
    p.git('checkout', '-q', 'main');
    p.git('checkout', '-q', '-b', 'alice');
    const next = wbOk(p, 'next-number').split('\n');
    assert.deepStrictEqual(next, ['06', 'note: numbers used on other branches: 05-tags on bob']);

    p.step('alice did not see bob\'s branch (not fetched yet): both create P-05');
    cloneFeature(p, '05', 'export', 'Export');
    p.commit('alice: P-05 export');

    p.step('merge: INDEX conflict is a finding');
    const merge = p.run('git', ['merge', '-q', 'bob']);
    assert.notStrictEqual(merge.code, 0, 'both branches appended an INDEX row');
    const c = check(p);
    assert.ok(c.findings.some((f) => /^INDEX\.md: unresolved merge conflict/.test(f)), c.out);

    p.step('resolve: keep both rows; duplicate number found, renumber suggested');
    p.write('workbench/INDEX.md', p.read('workbench/INDEX.md').split('\n').filter((l) => !/^(<{7}|={7}|>{7})/.test(l)).join('\n'));
    const dup = check(p).findings;
    assert.ok(dup.some((f) => /duplicate feature number 05 \(fix: wb\.js renumber P-05 <slug>/.test(f)), dup.join('\n'));

    p.step('check P-NN reports a conflict only under its own feature (#85)');
    const taskRel = 'workbench/subtasks/P-05-tags/TASK-01-stats-route.md';
    const taskText = p.read(taskRel);
    p.write(taskRel, `${taskText}\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> bob\n`);
    const conflict = /^subtasks\/P-05-tags\/TASK-01-stats-route\.md: unresolved merge conflict/;
    assert.ok(!check(p, 'P-01').findings.some((f) => conflict.test(f)), 'TASK-01 of P-05 is not a P-01 file');
    assert.ok(check(p, 'P-05').findings.some((f) => conflict.test(f)));
    p.write(taskRel, taskText);

    p.step('renumber refuses a used number and an unknown feature');
    assert.match(wb(p, 'renumber', 'P-05', 'tags', '03').out, /^ERROR: number 03 is already used/);
    assert.match(wb(p, 'renumber', 'P-05', 'nope').out, /^ERROR: no files of feature 05 "nope"/);

    p.step('renumber P-05 tags: files, links, IDs, INDEX row, Activity');
    const out = wbOk(p, 'renumber', 'P-05', 'tags');
    assert.match(out, /^INDEX row 05 -> 06$/m);
    assert.match(out, /^plans\/P-05-tags\.md -> P-06-tags\.md$/m);
    assert.match(out, /^subtasks\/P-05-tags\/ -> P-06-tags\/$/m);
    assert.ok(p.exists('workbench/tracking/TRK-06-tags.md') && !p.exists('workbench/tracking/TRK-05-tags.md'));
    assert.match(p.read('workbench/plans/P-06-tags.md'), /^# P-06: Tags\n[\s\S]*\[CONT-06-tags\]\(\.\.\/contracts\/CONT-06-tags\.md\)/);
    assert.match(p.read('workbench/subtasks/P-06-tags/TASK-01-stats-route.md'), /\[P-06-tags\]\(\.\.\/\.\.\/plans\/P-06-tags\.md\)/);
    const t6 = trk(p, '06');
    assert.ok(t6.history.every((h) => h.target !== 'P-05'), 'History targets renumbered');
    assert.ok(t6.activity.some((a) => a.target === 'P-06' && /renumbered from P-05/.test(a.details)));
    assert.deepStrictEqual(indexRow(p, '06'), { contract: 'Draft', progress: '0/1 Done' });
    assert.match(p.read('workbench/plans/P-05-export.md'), /^# P-05: Export/m, 'the other feature is untouched');
    const rows = p.read('workbench/INDEX.md').split('\n').filter((l) => /^\| \d+ \|/.test(l)).map((l) => l.slice(2, 4));
    assert.deepStrictEqual(rows, ['01', '02', '03', '05', '06'], 'INDEX rows in number order');
    assertClean(p);

    p.step('renumber refuses a feature with a task In Progress');
    wbOk(p, 'status', 'P-06', 'TASK-01', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-06 TASK-01');
    assert.match(wb(p, 'renumber', 'P-06', 'tags').out, /^ERROR: P-06 has tasks In Progress \(TASK-01\)/);

    p.step('renumber matches the exact slug: "notes" never touches "notes-v2" (#83)');
    cloneFeature(p, '07', 'notes-v2', 'Notes v2');
    cloneFeature(p, '07', 'notes', 'Notes');
    const v2 = p.files('workbench').filter((f) => f.includes('notes-v2')).map((f) => `${f}\n${p.read(f)}`).join('\n');
    assert.match(wbOk(p, 'renumber', 'P-07', 'notes', '08'), /^INDEX row 07 -> 08$/m);
    const index = p.read('workbench/INDEX.md');
    assert.match(index, /^\| 07 \| Notes v2 \| \[P-07\]\(plans\/P-07-notes-v2\.md\)/m, 'notes-v2 row unchanged');
    assert.match(index, /^\| 08 \| Notes \| \[P-08\]\(plans\/P-08-notes\.md\)/m, 'notes row renumbered');
    assert.strictEqual(p.files('workbench').filter((f) => f.includes('notes-v2')).map((f) => `${f}\n${p.read(f)}`).join('\n'), v2, 'notes-v2 files unchanged');
    assert.match(p.read('workbench/plans/P-08-notes.md'), /^# P-08: Notes$/m);
    assertClean(p);
  },
};
