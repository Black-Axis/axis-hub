// init on a fresh project; new / interview / import write features from the plugin's
// own templates; settings changes. Every result must pass wb.js check, so template and
// check.js stay in step.
const { wbOk, check, assertClean, indexRow, fromTemplate, guard, today } = require('../lib');

// Writes one feature (plan, contract, tracking, one task, doc, INDEX row) from the templates.
function writeFeature(p, nn, slug, title, opts = {}) {
  const v = { nn, slug, title, taskTitle: 'First task', taskSlug: 'first-task', fields: { Type: opts.type || 'text', Tests: '`npm test`', 'Plan Status': 'Not Started', Status: opts.status || 'In Progress', ...(opts.fields || {}) },
    header: { 'Depends On': '—', Source: 'Requirement 1', Baseline: p.git('log', '-1', '--format=%H'), Tests: '—' } };
  p.write(`workbench/plans/P-${nn}-${slug}.md`, fromTemplate(p, 'plan.md', v)
    .replace(/\n### Interview\n[\s\S]*?(?=\n## )/, opts.interview ? `\n### Interview\n\n- [INT-${nn}-${slug}](../interviews/INT-${nn}-${slug}.md)\n` : '')
    .replace(/\| TASK-01 \| [^|\n]+ \| [^|\n]+ \|/, '| TASK-01 | First task | — |'));
  p.write(`workbench/contracts/CONT-${nn}-${slug}.md`, fromTemplate(p, 'contract.md', v));
  p.write(`workbench/tracking/TRK-${nn}-${slug}.md`, fromTemplate(p, 'tracking.md', v));
  p.write(`workbench/subtasks/P-${nn}-${slug}/TASK-01-first-task.md`, fromTemplate(p, 'task.md', v));
  p.write(`workbench/docs/DOC-${nn}-${slug}.md`, fromTemplate(p, 'doc.md', v));
  const row = `| ${nn} | ${title} | [P-${nn}](plans/P-${nn}-${slug}.md) | [CONT-${nn}](contracts/CONT-${nn}-${slug}.md) | [TRK-${nn}](tracking/TRK-${nn}-${slug}.md) | [DOC-${nn}](docs/DOC-${nn}-${slug}.md) | Draft | 0/1 Done |`;
  p.write('workbench/INDEX.md', `${p.read('workbench/INDEX.md').replace(/\s*$/, '')}\n${row}\n`);
  wbOk(p, 'refresh', `P-${nn}`);
}

module.exports = {
  name: 'init, new, interview, import, settings from the templates',
  fixture: 'notes-api',
  covers: ['command:init', 'command:new', 'command:interview', 'command:import', 'command:settings', 'wb:next-number'],
  run(p, assert) {
    p.step('init: fresh project without workbench/');
    p.remove('workbench');
    p.commit('no workbench');
    const r = p.script('scripts/wb.js', 'overview');
    assert.strictEqual(r.code, 1);
    assert.match(r.out, /^ERROR: workbench\/INDEX\.md not found/);

    p.step('init: the first setup write is allowed for the main agent (no workbench/ yet)');
    assert.strictEqual(guard(p, 'Write', { file_path: p.path('workbench/INDEX.md') }), 'allow');

    p.step('init: folders and INDEX from the template; check clean');
    for (const d of ['plans', 'contracts', 'tracking', 'subtasks', 'docs', 'interviews', 'reports']) p.write(`workbench/${d}/.gitkeep`, '');
    p.write('workbench/INDEX.md', fromTemplate(p, 'INDEX.md', { fields: {
      'Version control': 'git', Workbench: 'tracked', Output: 'Concise', 'Fix rounds': '4', 'CLAUDE.md': 'no', Created: today(),
      'Commit policy': 'never auto-commit', 'Auto-close': 'Ask', Tests: '`npm test`', 'Baseline tests': 'yes', 'Full tests': 'close',
      Standards: 'CommonJS', 'Ask the user when': 'a new dependency is needed' } }));
    assertClean(p);
    assert.strictEqual(wbOk(p, 'next-number'), '01');
    assert.strictEqual(wbOk(p, 'overview'), 'no features yet');

    p.step('new: P-01 from the templates, Draft, refreshed; needs approve');
    writeFeature(p, '01', 'tags', 'Tags');
    assertClean(p);
    assert.deepStrictEqual(indexRow(p, '01'), { contract: 'Draft', progress: '0/1 Done' });
    assert.match(wbOk(p, 'overview'), /P-01 tags \| Plan: Not Started \| Contract: Draft \| 0\/1 Done \| needs \/foreman:approve P-01/);
    assert.strictEqual(wbOk(p, 'next-number'), '02');

    p.step('interview: INT-02 reserves number 02 while in progress');
    p.write('workbench/interviews/INT-02-export.md', fromTemplate(p, 'interview.md', { nn: '02', slug: 'export', title: 'Export',
      fields: { Status: 'In Progress', Plan: '—' } }));
    assert.strictEqual(wbOk(p, 'next-number'), '03');
    assert.match(wbOk(p, 'overview'), /INT-02 export \| Interview in progress/);

    p.step('interview done: P-02 with Source Type interview, interview links the plan');
    writeFeature(p, '02', 'export', 'Export', { type: 'interview', interview: true });
    p.edit('workbench/interviews/INT-02-export.md', /- Status: In Progress\n/, '- Status: Done\n');
    p.edit('workbench/interviews/INT-02-export.md', /- Plan: .*\n/, '- Plan: [P-02-export](../plans/P-02-export.md)\n');
    assertClean(p);
    p.edit('workbench/plans/P-02-export.md', '- Type: interview', '- Type: text');
    assert.ok(check(p).findings.some((f) => /Source Type/.test(f)), 'a Done interview needs a plan with Source Type interview');
    p.edit('workbench/plans/P-02-export.md', '- Type: text', '- Type: interview');

    p.step('import: finished feature P-03, Imported History entry, Missing fields reported');
    writeFeature(p, '03', 'legacy-auth', 'Legacy auth', { type: 'import' });
    p.edit('workbench/subtasks/P-03-legacy-auth/TASK-01-first-task.md', /## Evidence\n\n[^\n]*/, '## Evidence\n\nMissing - from import');
    p.edit('workbench/contracts/CONT-03-legacy-auth.md', '- Status: Draft\n- Approved: —', `- Status: Approved\n- Approved: ${today()}`);
    wbOk(p, 'status', 'P-03', 'TASK-01', 'Done', '--by', 'Main agent', '--reason', 'Imported - completed before foreman');
    wbOk(p, 'status', 'P-03', 'Done', '--by', 'Main agent', '--reason', 'Imported - completed before foreman');
    const c = check(p);
    assert.deepStrictEqual(c.findings, [], c.out);
    assert.ok(c.notes.some((n) => /Missing - from import/.test(n)), c.out);
    assert.match(wbOk(p, 'overview'), /P-03 legacy-auth \| Plan: Done .*\| closed/);

    p.step('settings: valid changes pass, invalid values are findings');
    p.edit('workbench/INDEX.md', '- Output: Concise', '- Output: Normal');
    p.edit('workbench/INDEX.md', '- Fix rounds: 4', '- Fix rounds: 6');
    p.edit('workbench/INDEX.md', '- Full tests: close', '- Full tests: each task');
    assertClean(p);
    p.edit('workbench/INDEX.md', '- Output: Normal', '- Output: Verbose');
    assert.ok(check(p).findings.some((f) => /invalid Output value "Verbose"/.test(f)));
    p.edit('workbench/INDEX.md', '- Output: Verbose', '- Output: Normal');
    p.edit('workbench/INDEX.md', '- Workbench: tracked', '- Git: committed');
    const old = check(p);
    assert.deepStrictEqual(old.findings, []);
    assert.ok(old.notes.some((n) => /old "Git: committed" line/.test(n)), 'older Git line still read');
  },
};
