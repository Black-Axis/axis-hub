// /foreman:map: wb.js map writes the Mermaid feature map with every file that exists,
// task statuses and dependencies, an own box for an interview without a plan, and
// links that resolve; one feature with P-NN; the command never reads feature files.
const path = require('path');
const { wb, wbOk, assertClean, guard } = require('../lib');

// Node ids defined in the diagram, and every edge's endpoints.
function graph(text) {
  const block = /```mermaid\n([\s\S]*?)```/.exec(text)[1];
  const nodes = new Set([...block.matchAll(/^\s+(f\d+_\w+)\["/gm)].map((m) => m[1]));
  const edges = [...block.matchAll(/^\s+(f\d+_\w+) (-->|-\.->) (f\d+_\w+)$/gm)].map((m) => ({ from: m[1], kind: m[2], to: m[3] }));
  const classOf = Object.fromEntries([...block.matchAll(/^\s+(f\d+_\w+)\[".*"\]:::(\w+)$/gm)].map((m) => [m[1], m[2]]));
  return { block, nodes, edges, classOf };
}

module.exports = {
  name: 'map: Mermaid feature map of every existing file',
  fixture: 'notes-api',
  covers: ['command:map', 'wb:map'],
  run(p, assert) {
    p.step('command: state script only, no edits, never prints or builds the map by hand');
    const cmd = p.read(path.relative(p.dir, path.join(p.pluginRoot, 'commands', 'map.md')));
    assert.match(cmd, /^allowed-tools: Read, Bash\(node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/wb\.js":\*\), PowerShell\(node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/wb\.js":\*\)$/m);
    assert.match(cmd, /never build the map by hand/);
    assert.match(cmd, /Never print the diagram in chat/);
    const call = `node "${path.join(p.pluginRoot, 'scripts', 'wb.js')}" map`;
    assert.strictEqual(guard(p, 'Bash', { command: call }, 'main'), 'allow', 'guard allows the call');

    p.step('wb.js map: all features, closed ones too, and the interview without a plan');
    assert.deepStrictEqual(wbOk(p, 'map').split('\n'), ['workbench/maps/MAP.md', '3 plan(s), 6 task(s), 1 interview(s) without a plan']);
    let text = p.read('workbench/maps/MAP.md');
    let g = graph(text);
    assert.match(g.block, /^ {2}subgraph F01\["P-01 Health check - Done"\]$/m);
    assert.match(g.block, /^ {2}subgraph F02\["P-02 Search notes - In Progress"\]$/m);
    assert.match(g.block, /^ {2}subgraph F04\["INT-04 Dark mode"\]$/m, 'own box for the open interview');
    assert.match(g.block, /f03_CONT\["CONT-03 contract<br\/>Draft"\]/);
    assert.match(g.block, /f02_TRK\["TRK-02 tracking<br\/>1\/3 Done"\]/);
    assert.match(g.block, /f02_TASK01\["TASK-01 Parse q terms \(a#124;b = OR\)<br\/>Done"\]:::done/, 'pipe in a title escaped');
    assert.strictEqual(g.classOf.f02_TASK02, 'todo');
    assert.ok(!g.nodes.has('f02_REP') && !g.nodes.has('f02_INT'), 'no report or interview for P-02 yet');
    assert.ok(g.edges.some((e) => e.from === 'f02_TASK01' && e.kind === '-.->' && e.to === 'f02_TASK02'), 'dependency arrow');
    assert.ok(g.edges.some((e) => e.from === 'f02_TRK' && e.to === 'f02_TASK01'), 'task without dependencies hangs from tracking');
    for (const e of g.edges) assert.ok(g.nodes.has(e.from) && g.nodes.has(e.to), `edge ${e.from} -> ${e.to} uses defined nodes`);
    const links = [...text.matchAll(/\]\(\.\.\/([^)]+)\)/g)].map((m) => m[1]);
    assert.strictEqual(links.length, 16, 'plan, contract, tracking, tasks, doc for 3 features + 1 interview');
    for (const l of links) assert.ok(p.exists(`workbench/${l}`), `link resolves: ${l}`);
    assertClean(p);

    p.step('after changes: a running task, a report, and an interview that became P-02 show up');
    wbOk(p, 'status', 'P-02', 'TASK-02', 'In Progress', '--by', 'User', '--reason', '/foreman:run P-02 TASK-02');
    p.write('workbench/reports/REP-02-search-notes.md', '# REP-02: Search notes\n');
    p.write('workbench/interviews/INT-02-search-notes.md', p.read('workbench/interviews/INT-04-dark-mode.md')
      .replace(/^# INT-04: .*$/m, '# INT-02: Search notes')
      .replace(/^- Status: .*$/m, '- Status: Done')
      .replace(/^- Plan: .*$/m, '- Plan: [P-02-search-notes](../plans/P-02-search-notes.md)'));
    wbOk(p, 'map');
    g = graph(p.read('workbench/maps/MAP.md'));
    assert.strictEqual(g.classOf.f02_TASK02, 'prog');
    assert.match(g.block, /f02_INT\["INT-02 interview<br\/>Done"\]/);
    assert.ok(g.edges.some((e) => e.from === 'f02_INT' && e.to === 'f02_P'), 'interview leads to its plan');
    assert.ok(g.edges.some((e) => e.from === 'f02_P' && e.to === 'f02_REP'), 'report');

    p.step('Markdown characters in a feature title are escaped in the file list, backslash included');
    p.edit('workbench/plans/P-03-note-stats.md', /^# P-03: .*$/m, '# P-03: Stats \\*all* _x_ `y` <b> [z]\\');
    wbOk(p, 'map');
    assert.match(p.read('workbench/maps/MAP.md'), /^- \*\*P-03 Stats \\\\\\\*all\\\* \\_x\\_ \\`y\\` \\<b\\> \\\[z\\\]\\\\\*\* \(/m);

    p.step('map P-02: that feature only, in MAP-02.md; unknown number refused');
    assert.deepStrictEqual(wbOk(p, 'map', 'P-02').split('\n'), ['workbench/maps/MAP-02.md', '1 plan(s), 3 task(s)']);
    g = graph(p.read('workbench/maps/MAP-02.md'));
    assert.ok([...g.nodes].every((n) => n.startsWith('f02_')));
    assert.match(wb(p, 'map', 'P-09').out, /^ERROR: no files of feature 09 in workbench\//);
    assert.match(wb(p, 'map', 'TASK-01').out, /^ERROR: expected P-NN/);
  },
};
