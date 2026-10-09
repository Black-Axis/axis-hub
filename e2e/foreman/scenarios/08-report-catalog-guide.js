// report: the sections the reporter reads exist in real feature files, the report is
// saved by the main agent only. catalog: built from frontmatter. ask / guide: the
// guide works only in a project with workbench/INDEX.md and knows every command.
const fs = require('fs');
const path = require('path');
const { feature, trk, wbOk, guard, fromTemplate, today } = require('../lib');
const { field, tableRows } = require('../../../plugins/foreman/scripts/lib.js');

module.exports = {
  name: 'report sections and save, catalog from frontmatter, guide gating',
  fixture: 'notes-api',
  covers: ['command:report', 'command:catalog', 'command:ask', 'skill:foreman-guide'],
  run(p, assert) {
    const root = p.pluginRoot;
    const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

    p.step('report: every section in the reporter\'s read table exists in P-02\'s files');
    const reporter = read('agents/foreman-reporter.md');
    const table = reporter.slice(reporter.indexOf('| File | Read only |'));
    const want = { Plan: 'plan', Contract: 'contract', Tracking: 'trk', Doc: 'doc' };
    const f = feature(p, '02');
    for (const [label, key] of Object.entries(want)) {
      const row = table.split('\n').find((l) => l.startsWith(`| ${label} |`));
      assert.ok(row, `reporter table has no ${label} row`);
      const text = p.read(f[key]);
      for (const m of row.matchAll(/`## ([^`]+)`/g)) assert.ok(text.includes(`\n## ${m[1]}`), `${f[key]} has no ## ${m[1]}`);
      for (const m of row.matchAll(/`- ([^`:]+):`/g)) assert.ok(field(text, m[1]), `${f[key]} has no - ${m[1]}:`);
    }

    p.step('report: composed from the template with P-02 facts; saved by the main agent, never the reporter');
    const t = trk(p, '02');
    const done = t.tasks.filter((x) => x.status === 'Done').length;
    const total = t.tasks.filter((x) => x.status !== 'Canceled').length;
    const report = fromTemplate(p, 'report.md', { nn: '02', slug: 'search-notes', title: 'Search notes',
      fields: { 'Plan Status': t.planStatus, 'Contract Status': 'Approved', Progress: `${done}/${total} tasks Done`, Generated: today() } });
    assert.match(report, /- Progress: 1\/3 tasks Done/);
    const out = 'workbench/reports/REP-02-search-notes.md';
    assert.strictEqual(guard(p, 'Write', { file_path: p.path(out) }, 'reporter'), 'deny');
    assert.strictEqual(guard(p, 'Write', { file_path: p.path(out) }), 'allow');
    p.write(out, report);
    assert.ok(p.exists(out));
    assert.ok(read('commands/report.md').includes('Write(workbench/reports/**)'));

    p.step('catalog: every command, agent, and skill has the frontmatter the catalog reads');
    const front = (file) => {
      const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(file, 'utf8'));
      assert.ok(m, `${file}: no frontmatter`);
      return Object.fromEntries(m[1].split(/\r?\n/).map((l) => /^([\w-]+):\s*(.*)$/.exec(l)).filter(Boolean).map((x) => [x[1], x[2]]));
    };
    const commands = fs.readdirSync(path.join(root, 'commands')).filter((x) => x.endsWith('.md'));
    for (const c of commands) assert.ok(front(path.join(root, 'commands', c)).description, `${c}: no description`);
    // Every session carries the command descriptions in context (#102): one short line each.
    const descriptions = commands.map((c) => front(path.join(root, 'commands', c)).description);
    for (const [i, d] of descriptions.entries()) assert.ok(d.length <= 70, `${commands[i]}: description has ${d.length} characters (max 70)`);
    assert.ok(descriptions.join('').length <= 1100, 'all command descriptions together stay short');
    for (const a of fs.readdirSync(path.join(root, 'agents'))) {
      const fm = front(path.join(root, 'agents', a));
      assert.ok(fm.name && fm.description && fm.model, `${a}: name, description, model`);
    }
    for (const s of fs.readdirSync(path.join(root, 'skills'))) assert.ok(front(path.join(root, 'skills', s, 'SKILL.md')).description);
    const order = /sorted by the natural workflow for commands \(([^)]*)\)/.exec(read('commands/catalog.md'))[1];
    for (const c of commands) assert.ok(order.includes(`\`${c.slice(0, -3)}\``), `catalog order misses ${c}`);
    const hooks = JSON.parse(read('hooks/hooks.json')).hooks;
    assert.deepStrictEqual(Object.keys(hooks).sort(), ['PreToolUse', 'SessionStart']);

    p.step('ask / guide: active only with workbench/INDEX.md; every command can be suggested');
    const skill = read('skills/foreman-guide/SKILL.md');
    assert.match(skill, /`workbench\/INDEX\.md` exists in the project/);
    for (const c of commands) assert.match(skill, new RegExp(`\`/foreman:${c.slice(0, -3)}\``), `guide misses ${c}`);
    assert.ok(p.exists('workbench/INDEX.md'), 'this project uses foreman: the guide may suggest');
    assert.match(read('commands/ask.md'), /through the Skill tool/);
    assert.match(wbOk(p, 'ready'), /^P-02 TASK-02 Filter GET \/notes by q$/m, 'the guide fills real arguments from ready tasks');
    p.remove('workbench');
    assert.ok(!p.exists('workbench/INDEX.md'), 'without INDEX.md the guide stays silent');

    p.step('rules split (#103): what each command loads before its first question holds every section it cites');
    const refDir = path.join(root, 'reference');
    const hasSection = (text, name) => text.split(/\r?\n/).some((l) => l === `## ${name}` || l.startsWith(`## ${name} `) || l.startsWith(`**${name}**`));
    for (const file of fs.readdirSync(path.join(root, 'commands')).filter((f) => f.endsWith('.md'))) {
      const text = read(`commands/${file}`);
      const first = text.split(/\r?\n/).find((l) => l.startsWith('First read ')) || '';
      const loaded = [...first.matchAll(/`\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/([a-z-]+\.md)`/g)].map((m) => m[1]);
      if (['status.md', 'map.md', 'catalog.md'].includes(file)) {
        assert.deepStrictEqual(loaded, [], `${file} loads no rules file`);
        continue;
      }
      assert.strictEqual(loaded[0], 'rules.md', `${file} starts with rules.md`);
      // Files read on demand are named with their path where the command needs them (run-all, detection).
      const onDemand = [...text.matchAll(/`\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/([a-z-]+\.md)`/g)].map((m) => m[1]);
      for (const m of text.matchAll(/"([A-Z][^"]{2,40})" in `?(version-control|tasks|sessions|project-block|detection|snapshot)\.md`?/g)) {
        assert.ok(loaded.includes(`${m[2]}.md`) || onDemand.includes(`${m[2]}.md`), `${file} cites "${m[1]}" in ${m[2]}.md without loading it`);
        assert.ok(hasSection(fs.readFileSync(path.join(refDir, `${m[2]}.md`), 'utf8'), m[1]), `${m[2]}.md has no "${m[1]}"`);
      }
    }
    const loadedChars = (file) => {
      const first = read(`commands/${file}`).split(/\r?\n/).find((l) => l.startsWith('First read ')) || '';
      return [...first.matchAll(/`\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/([a-z-]+\.md)`/g)].reduce((n, m) => n + fs.statSync(path.join(refDir, m[1])).size, 0);
    };
    assert.ok(loadedChars('approve.md') < 20000, 'approve loads only the core');
    assert.strictEqual(loadedChars('status.md'), 0, 'status loads no rules');
    assert.ok(!read('commands/run.md').includes('## Run all'), 'a single run does not load the run-all text');
    for (const f of ['new.md', 'interview.md', 'import.md']) assert.ok(!/project-block\.md/.test(read(`commands/${f}`)), `${f}: the CLAUDE.md block rules come with setup.md only`);
  },
};
