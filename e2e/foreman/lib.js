// foreman helpers for e2e scenarios: the state script, the workbench-guard hook as
// Claude Code calls it, and readers for the workbench/ files.
'use strict';

const path = require('path');
const assert = require('node:assert');
const { tableRows, field, taskIds } = require('../../plugins/foreman/scripts/lib.js');

// The feature files of number NN (relative paths), found by prefix.
function feature(p, nn) {
  const find = (dir, prefix) => {
    const f = p.files(`workbench/${dir}`).find((x) => path.basename(x).startsWith(prefix));
    return f || null;
  };
  return {
    plan: find('plans', `P-${nn}-`),
    contract: find('contracts', `CONT-${nn}-`),
    trk: find('tracking', `TRK-${nn}-`),
    doc: find('docs', `DOC-${nn}-`),
  };
}

// node wb.js ...args -> { code, out }.
function wb(p, ...args) {
  return p.script('scripts/wb.js', ...args);
}

// wb.js call that must succeed; returns its output.
function wbOk(p, ...args) {
  const r = wb(p, ...args);
  assert.strictEqual(r.code, 0, `wb.js ${args.join(' ')} failed: ${r.out}`);
  return r.out;
}

// wb.js check [P-NN] -> { code, findings, notes }.
function check(p, plan) {
  const r = wb(p, 'check', ...(plan ? [plan] : []));
  const lines = r.out.split(/\r?\n/);
  return {
    code: r.code,
    findings: lines.filter((l) => l.startsWith('finding: ')).map((l) => l.slice(9)),
    notes: lines.filter((l) => l.startsWith('note: ')).map((l) => l.slice(6)),
    out: r.out,
  };
}

function assertClean(p, plan) {
  const c = check(p, plan);
  assert.deepStrictEqual(c.findings, [], `wb.js check found problems:\n${c.out}`);
}

// TRK file of NN, parsed.
function trk(p, nn) {
  const text = p.read(feature(p, nn).trk);
  return {
    planStatus: field(text, 'Plan Status'),
    tasks: tableRows(text, 'Tasks').map((c) => ({ id: taskIds(c[0])[0], title: c[1], status: c[2], updated: c[3], note: c[4] || '' })),
    history: tableRows(text, 'History').map((c) => ({ date: c[0], target: c[1], change: c[2], by: c[3], reason: c[4] })),
    activity: tableRows(text, 'Activity').map((c) => ({ date: c[0], target: c[1], by: c[2], type: c[3], details: c[4] })),
  };
}

function task(p, nn, id) {
  const t = trk(p, nn).tasks.find((x) => x.id === id);
  assert.ok(t, `TRK-${nn} has no ${id}`);
  return t;
}

// INDEX Features row of NN -> { contract, progress }.
function indexRow(p, nn) {
  const text = p.read('workbench/INDEX.md');
  const row = tableRows(text, 'Features').find((c) => c[0] === nn);
  assert.ok(row, `INDEX has no row ${nn}`);
  return { contract: row[6], progress: row[7] };
}

// Appends a row to a table under `## heading` of a workbench file.
function appendRow(p, file, heading, cellsList) {
  const lines = p.read(file).split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  assert.ok(start !== -1, `${file} has no ## ${heading}`);
  let last = -1;
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) if (lines[i].startsWith('|')) last = i;
  assert.ok(last !== -1, `${file}: ## ${heading} has no table`);
  lines.splice(last + 1, 0, `| ${cellsList.join(' | ')} |`);
  p.write(file, lines.join('\n'));
}

function activity(p, nn, target, by, type, details) {
  appendRow(p, feature(p, nn).trk, 'Activity', [today(), target, by, type, details]);
}

function today() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

// The workbench-guard decision for one tool call, as Claude Code sends it.
// who: 'main' | 'worker' | 'reporter'. Returns 'allow' | 'deny' | null.
function guard(p, tool, toolInput, who = 'main', extra = {}) {
  const agent = who === 'main' ? {} : { agent_id: `e2e-${who}`, agent_type: `foreman:foreman-${who}` };
  const r = p.hook('workbench-guard.js', {
    hook_event_name: 'PreToolUse', tool_name: tool, tool_input: toolInput, permission_mode: 'default', ...agent, ...extra,
  });
  assert.strictEqual(r.code, 0, 'workbench-guard must exit 0');
  return r.json ? r.json.hookSpecificOutput.permissionDecision : null;
}

module.exports = { feature, wb, wbOk, check, assertClean, trk, task, indexRow, appendRow, activity, today, guard };


// Fills a plugin template the way a command does: known tokens from `v`, list fields
// `- Name: {{a | b}}` from `v.fields[Name]` or the first option, header table rows
// `| Name | ... |` from `v.header[Name]`, any other placeholder with sample text.
// Fails when a placeholder is left (a template changed shape).
function fromTemplate(p, name, v) {
  let text = require('fs').readFileSync(require('path').join(p.pluginRoot, 'templates', name), 'utf8').replace(/\r\n/g, '\n');
  const tokens = {
    NN: v.nn, slug: v.slug, TT: v.tt || '01', 'task-slug': v.taskSlug || 'first-task', 'Feature Title': v.title,
    'Task Title': v.taskTitle || 'First task', title: v.taskTitle || 'First task', 'YYYY-MM-DD': today(),
  };
  text = text.replace(/\{\{([^{}]+)\}\}/g, (m, key) => (key in tokens ? tokens[key] : m));
  text = text.replace(/^(- ([^:\n]+): )\{\{([^{}]+)\}\}/gm, (m, lead, fieldName, opts) =>
    lead + ((v.fields || {})[fieldName] || opts.split(' | ')[0].replace(/^(.*?)(,| e\.g\.).*$/, '$1').trim()));
  const lines = text.split('\n').map((line) => {
    const m = /^\| ([^|]+) \| .* \|$/.exec(line);
    return m && v.header && m[1] in v.header ? `| ${m[1]} | ${v.header[m[1]]} |` : line;
  });
  text = lines.join('\n').replace(/\{\{([^{}]+)\}\}/g, (m, key) => `e2e sample: ${key.slice(0, 40).replace(/\|/g, '/')}`);
  if (text.includes('{{')) throw new Error(`${name}: placeholder left`);
  return text;
}

module.exports.fromTemplate = fromTemplate;
