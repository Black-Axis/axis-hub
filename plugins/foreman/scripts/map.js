// foreman feature map (wb.js map, /foreman:map): a Mermaid diagram of the features in
// workbench/ and their files - interview, plan, contract, tracking, tasks with their
// dependencies, doc, reports - each shown only if it exists. Written to
// workbench/maps/MAP.md (all features) or MAP-NN.md (one), overwritten each run.

const fs = require('fs');
const path = require('path');
const { readText, listDir, tableRows, field, taskIds } = require('./lib');

const STATUSES = ['Not Started', 'In Progress', 'Hold', 'Done', 'Canceled'];
const DIRS = { INT: 'interviews', P: 'plans', CONT: 'contracts', TRK: 'tracking', DOC: 'docs', REP: 'reports' };
const CLASS = { 'Not Started': 'todo', 'In Progress': 'prog', Hold: 'hold', Done: 'done', Canceled: 'canceled' };

const canon = (s) => STATUSES.find((v) => v.toLowerCase() === String(s || '').trim().toLowerCase()) || '';

// Mermaid label text: no quotes or markup that would end the label.
function label(text, max = 48) {
  let t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length > max) t = `${t.slice(0, max - 1)}…`;
  return t.replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;').replace(/\|/g, '#124;');
}

// Every feature number in workbench/ with its files: { nn, slug, files: { P, CONT, ... }, tasksDir }.
function collect(wb) {
  const byNN = new Map();
  const get = (nn) => byNN.get(nn) || byNN.set(nn, { nn, slug: '', files: {}, tasksDir: null }).get(nn);
  for (const [prefix, dir] of Object.entries(DIRS)) {
    for (const name of listDir(path.join(wb, dir)).sort()) {
      const m = new RegExp(`^${prefix}-(\\d+)-([a-z0-9-]+)\\.md$`).exec(name);
      if (!m) continue;
      const f = get(m[1]);
      if (!f.files[prefix]) f.files[prefix] = `${dir}/${name}`;
      if (!f.slug || prefix === 'P') f.slug = m[2];
    }
  }
  for (const name of listDir(path.join(wb, 'subtasks')).sort()) {
    const m = /^P-(\d+)-([a-z0-9-]+)$/.exec(name);
    if (m && byNN.has(m[1])) byNN.get(m[1]).tasksDir = `subtasks/${name}`;
  }
  return [...byNN.values()].sort((a, b) => Number(a.nn) - Number(b.nn));
}

const title = (text, prefix) => {
  const m = new RegExp(`^# ${prefix}-\\d+:\\s*(.+)$`, 'm').exec(text || '');
  return m ? m[1].trim() : '';
};

// Facts the diagram shows for one feature.
function describe(wb, f) {
  const read = (k) => (f.files[k] ? readText(path.join(wb, f.files[k])) || '' : null);
  const plan = read('P');
  const trk = read('TRK');
  const contract = read('CONT');
  const interview = read('INT');
  const deps = {};
  for (const c of tableRows(plan || '', 'Task Breakdown')) {
    const id = taskIds(c[0])[0];
    if (id) deps[id] = taskIds(c[2] || '');
  }
  const tasks = tableRows(trk || '', 'Tasks')
    .map((c) => ({ id: taskIds(c[0])[0], title: c[1] || '', status: canon(c[2]) || c[2] || '' }))
    .filter((t) => t.id);
  return {
    ...f,
    title: title(plan, 'P') || title(interview, 'INT') || f.slug,
    planStatus: trk !== null ? canon(field(trk, 'Plan Status')) || 'Not Started' : '',
    contractStatus: contract !== null ? field(contract, 'Status') || 'Unknown' : '',
    interviewStatus: interview !== null ? field(interview, 'Status') || 'Unknown' : '',
    tasks,
    deps,
  };
}

function diagram(features) {
  const out = ['```mermaid', 'flowchart LR'];
  const edges = [];
  for (const f of features) {
    const id = (k) => `f${f.nn}_${k}`;
    const has = (k) => Boolean(f.files[k]);
    const head = has('P') ? `P-${f.nn} ${f.title}` : `INT-${f.nn} ${f.title}`;
    out.push(`  subgraph F${f.nn}["${label(head)}${f.planStatus ? ` - ${f.planStatus}` : ''}"]`, '    direction TB');
    if (has('INT')) out.push(`    ${id('INT')}["INT-${f.nn} interview<br/>${label(f.interviewStatus)}"]:::doc`);
    if (has('P')) out.push(`    ${id('P')}["P-${f.nn} plan"]:::doc`);
    if (has('CONT')) out.push(`    ${id('CONT')}["CONT-${f.nn} contract<br/>${label(f.contractStatus)}"]:::doc`);
    if (has('TRK')) out.push(`    ${id('TRK')}["TRK-${f.nn} tracking<br/>${f.tasks.filter((t) => t.status === 'Done').length}/${f.tasks.filter((t) => t.status !== 'Canceled').length} Done"]:::doc`);
    for (const t of f.tasks) out.push(`    ${id(t.id.replace('-', ''))}["${t.id} ${label(t.title, 36)}<br/>${label(t.status)}"]:::${CLASS[t.status] || 'todo'}`);
    if (has('DOC')) out.push(`    ${id('DOC')}["DOC-${f.nn} doc"]:::doc`);
    if (has('REP')) out.push(`    ${id('REP')}["REP-${f.nn} report"]:::doc`);
    out.push('  end');
    const root = has('P') ? id('P') : null;
    if (has('INT') && root) edges.push(`  ${id('INT')} --> ${root}`);
    for (const k of ['CONT', 'TRK', 'DOC', 'REP']) if (has(k) && root) edges.push(`  ${root} --> ${id(k)}`);
    const parent = has('TRK') ? id('TRK') : root;
    const known = new Set(f.tasks.map((t) => t.id));
    for (const t of f.tasks) {
      const tid = id(t.id.replace('-', ''));
      const waits = (f.deps[t.id] || []).filter((d) => known.has(d));
      for (const d of waits) edges.push(`  ${id(d.replace('-', ''))} -.-> ${tid}`);
      if (!waits.length && parent) edges.push(`  ${parent} --> ${tid}`);
    }
  }
  out.push(...edges);
  out.push(
    '  classDef doc fill:#eaeef2,stroke:#57606a,color:#1f2328',
    '  classDef todo fill:#ffffff,stroke:#57606a,color:#1f2328',
    '  classDef prog fill:#fff8c5,stroke:#9a6700,color:#1f2328',
    '  classDef hold fill:#ffebe9,stroke:#cf222e,color:#1f2328',
    '  classDef done fill:#dafbe1,stroke:#1a7f37,color:#1f2328',
    '  classDef canceled fill:#f6f8fa,stroke:#8c959f,color:#8c959f,stroke-dasharray:4 3',
    '```',
  );
  return out;
}

function links(f) {
  const ln = (text, rel) => `[${text}](../${rel})`;
  const parts = [];
  if (f.files.INT) parts.push(ln('interview', f.files.INT));
  if (f.files.P) parts.push(ln('plan', f.files.P));
  if (f.files.CONT) parts.push(ln('contract', f.files.CONT));
  if (f.files.TRK) parts.push(ln('tracking', f.files.TRK));
  if (f.tasksDir) parts.push(ln('tasks', `${f.tasksDir}/`));
  if (f.files.DOC) parts.push(ln('doc', f.files.DOC));
  if (f.files.REP) parts.push(ln('report', f.files.REP));
  const facts = [
    f.planStatus && `plan ${f.planStatus}`,
    f.contractStatus && `contract ${f.contractStatus}`,
    f.files.TRK && `${f.tasks.filter((t) => t.status === 'Done').length}/${f.tasks.filter((t) => t.status !== 'Canceled').length} tasks Done`,
    !f.files.P && f.interviewStatus && `interview ${f.interviewStatus}`,
  ].filter(Boolean);
  const id = f.files.P ? `P-${f.nn}` : `INT-${f.nn}`;
  return `- **${id} ${f.title.replace(/([*_[\]])/g, '\\$1')}** (${facts.join(', ')}): ${parts.join(' · ')}`;
}

// Writes the map; returns { file, lines } (lines = the summary for the reply).
function writeMap(wb, only, stamp) {
  let list = collect(wb);
  if (only) {
    list = list.filter((f) => f.nn === only);
    if (!list.length) return { error: `no files of feature ${only} in workbench/` };
  }
  if (!list.length) return { error: 'no features or interviews yet - start with /foreman:new or /foreman:interview' };
  const features = list.map((f) => describe(wb, f));
  const rel = `maps/${only ? `MAP-${only}` : 'MAP'}.md`;
  const text = [
    `# ${only ? `Feature map - P-${only}` : 'Feature map'}`,
    '',
    `Generated by \`/foreman:map${only ? ` P-${only}` : ''}\` on ${stamp}. Run it again after changes; edits here are overwritten.`,
    '',
    ...diagram(features),
    '',
    'Task colors: white Not Started, yellow In Progress, red Hold, green Done, dashed grey Canceled. Dotted arrows: depends on.',
    '',
    '## Files',
    '',
    ...features.map(links),
    '',
  ].join('\n');
  const file = path.join(wb, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  const plans = features.filter((f) => f.files.P).length;
  const interviews = features.filter((f) => !f.files.P && f.files.INT).length;
  const tasks = features.reduce((n, f) => n + f.tasks.length, 0);
  return {
    file: `workbench/${rel}`,
    lines: [`workbench/${rel}`, `${plans} plan(s), ${tasks} task(s)${interviews ? `, ${interviews} interview(s) without a plan` : ''}`],
  };
}

module.exports = { writeMap, collect };
