#!/usr/bin/env node
// foreman state script: the mechanical workbench/ updates and answers, so the main
// agent does not edit status cells or compute counts by hand. No dependencies.
// Run from the project root (or set CLAUDE_PROJECT_DIR):
//   node wb.js status P-NN [TASK-TT] <status> --by <User|Main agent> --reason "<text>" [--note "<text>"]  (no --note: note cleared)
//   node wb.js refresh P-NN        recompute derived Plan Status, INDEX Progress and Contract Status
//   node wb.js ready [P-NN]        tasks that can run now
//   node wb.js overview            one line per feature and open interview
//   node wb.js next-number         next free feature number NN
//   node wb.js check [P-NN]        mechanical consistency checks (/foreman:doctor); exit 2 with findings
// Exit 0 on success; 1 with "ERROR: <reason>" (nothing written) on bad input or state.

const fs = require('fs');
const path = require('path');
const { readText, listDir, cells, tableAt, tableRows, field, taskIds, findFile } = require('./lib');
const { check } = require('./check');

const STATUSES = ['Not Started', 'In Progress', 'Hold', 'Done', 'Canceled'];
const BY = ['User', 'Main agent'];

class WbError extends Error {}
const fail = (msg) => { throw new WbError(msg); };

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function canonStatus(text) {
  const s = STATUSES.find((v) => v.toLowerCase() === String(text).trim().toLowerCase());
  return s || null;
}

const esc = (cell) => String(cell).replace(/(?<!\\)\|/g, '\\|');
const row = (cs) => `| ${cs.map(esc).join(' | ')} |`;

// A Markdown file kept as lines, written back with its own line endings.
class Doc {
  constructor(file) {
    this.file = file;
    const text = readText(file);
    if (text === null) fail(`cannot read ${path.relative(process.cwd(), file)}`);
    this.eol = text.includes('\r\n') ? '\r\n' : '\n';
    this.lines = text.split(/\r?\n/);
    this.changed = false;
  }
  get text() { return this.lines.join('\n'); }
  setLine(i, line) {
    if (this.lines[i] !== line) { this.lines[i] = line; this.changed = true; }
  }
  insertAfter(i, line) { this.lines.splice(i + 1, 0, line); this.changed = true; }
  save() { if (this.changed) fs.writeFileSync(this.file, this.lines.join(this.eol)); }
}

function root() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function workbench() {
  const wb = path.join(root(), 'workbench');
  if (!fs.existsSync(path.join(wb, 'INDEX.md'))) fail('workbench/INDEX.md not found - run /foreman:init or /foreman:new first');
  return wb;
}

function planId(arg) {
  const m = /^P-(\d+)$/i.exec(arg || '');
  if (!m) fail(`expected P-NN, got "${arg || ''}"`);
  return m[1];
}

function feature(wb, nn) {
  const trk = findFile(path.join(wb, 'tracking'), `TRK-${nn}-`);
  if (!trk) fail(`no tracking file workbench/tracking/TRK-${nn}-*.md`);
  const slug = path.basename(trk, '.md').slice(`TRK-${nn}-`.length);
  return {
    nn,
    slug,
    trk,
    plan: findFile(path.join(wb, 'plans'), `P-${nn}-`),
    contract: findFile(path.join(wb, 'contracts'), `CONT-${nn}-`),
  };
}

function features(wb) {
  return listDir(path.join(wb, 'tracking')).sort()
    .map((f) => /^TRK-(\d+)-.+\.md$/.exec(f))
    .filter(Boolean)
    .map((m) => feature(wb, m[1]));
}

function tasksOf(trkText) {
  return tableRows(trkText, 'Tasks')
    .map((c) => ({ id: taskIds(c[0])[0], title: c[1] || '', status: canonStatus(c[2]) || c[2] || '', note: c[4] || '' }))
    .filter((t) => t.id);
}

function depsOf(planText) {
  const deps = {};
  for (const c of tableRows(planText || '', 'Task Breakdown')) {
    const id = taskIds(c[0])[0];
    if (id) deps[id] = taskIds(c[2] || '');
  }
  return deps;
}

function progress(tasks) {
  const done = tasks.filter((t) => t.status === 'Done').length;
  const total = tasks.filter((t) => t.status !== 'Canceled').length;
  const running = tasks.filter((t) => t.status === 'In Progress').map((t) => `, ${t.id} In Progress`).join('');
  return `${done}/${total} Done${running}`;
}

function derivedPlan(tasks) {
  return tasks.some((t) => t.status === 'In Progress' || t.status === 'Done') ? 'In Progress' : 'Not Started';
}

function ready(f) {
  const trk = readText(f.trk) || '';
  const plan = canonStatus(field(trk, 'Plan Status')) || 'Not Started';
  const contract = field(readText(f.contract || '') || '', 'Status');
  if (['Hold', 'Canceled', 'Done'].includes(plan) || !/^approved$/i.test(contract)) return [];
  const tasks = tasksOf(trk);
  const deps = depsOf(readText(f.plan || ''));
  const statusOf = Object.fromEntries(tasks.map((t) => [t.id, t.status]));
  return tasks.filter((t) => t.status === 'Not Started' && (deps[t.id] || []).every((d) => statusOf[d] === 'Done'));
}

function appendHistory(doc, cs) {
  const t = tableAt(doc.lines, 'History');
  if (!t || t.header === -1) fail(`${path.basename(doc.file)} has no History table`);
  doc.insertAfter(t.last, row(cs));
}

// Recomputes the derived Plan Status (unless Hold / Canceled / Done) and logs it.
function syncPlan(doc, out, nn) {
  const tasks = tasksOf(doc.text);
  const i = doc.lines.findIndex((l) => /^- Plan Status:/i.test(l));
  if (i === -1) fail(`${path.basename(doc.file)} has no "- Plan Status:" line`);
  const old = canonStatus(doc.lines[i].replace(/^- Plan Status:/i, '')) || 'Not Started';
  if (['Hold', 'Canceled', 'Done'].includes(old)) return old;
  const next = derivedPlan(tasks);
  if (next !== old) {
    doc.setLine(i, `- Plan Status: ${next}`);
    const reason = next === 'In Progress' ? 'first task started' : 'no task started or done';
    appendHistory(doc, [today(), `P-${nn}`, `${old} -> ${next}`, 'Main agent', reason]);
    out.push(`P-${nn}: ${old} -> ${next} (derived)`);
  }
  return next;
}

// Updates the INDEX features row of P-NN: Progress and Contract Status.
function syncIndex(wb, f, out) {
  const doc = new Doc(path.join(wb, 'INDEX.md'));
  const t = tableAt(doc.lines, 'Features');
  if (!t || t.header === -1) fail('INDEX.md has no Features table');
  const head = cells(doc.lines[t.header]).map((h) => h.toLowerCase());
  const iPlan = head.indexOf('plan');
  const iProg = head.indexOf('progress');
  const iCont = head.indexOf('contract status');
  const r = t.rows.find((i) => new RegExp(`\\bP-${f.nn}\\b`).test(cells(doc.lines[i])[iPlan] || ''));
  if (r === undefined) fail(`INDEX.md has no Features row for P-${f.nn}`);
  const cs = cells(doc.lines[r]);
  const prog = progress(tasksOf(readText(f.trk) || ''));
  const cont = field(readText(f.contract || '') || '', 'Status');
  if (iProg !== -1 && cs[iProg] !== prog) { out.push(`INDEX P-${f.nn} Progress: ${prog}`); cs[iProg] = prog; }
  if (iCont !== -1 && cont && cs[iCont] !== cont) { out.push(`INDEX P-${f.nn} Contract Status: ${cont}`); cs[iCont] = cont; }
  doc.setLine(r, row(cs));
  doc.save();
}

function parseOpts(args) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const m = /^--(by|reason|note)$/.exec(args[i]);
    if (m) {
      if (i + 1 >= args.length) fail(`--${m[1]} needs a value`);
      opts[m[1]] = args[++i];
    } else pos.push(args[i]);
  }
  return { pos, opts };
}

function cmdStatus(args) {
  const { pos, opts } = parseOpts(args);
  const wb = workbench();
  const nn = planId(pos.shift());
  const task = /^TASK-\d+$/i.test(pos[0] || '') ? pos.shift().toUpperCase() : null;
  const next = canonStatus(pos.join(' '));
  if (!next) fail(`status must be one of: ${STATUSES.join(', ')}`);
  const by = BY.find((b) => b.toLowerCase() === String(opts.by || '').toLowerCase());
  if (!by) fail('--by must be "User" or "Main agent"');
  if (!opts.reason || !opts.reason.trim()) fail('--reason is required');

  const f = feature(wb, nn);
  const doc = new Doc(f.trk);
  const out = [];
  if (task) {
    const t = tableAt(doc.lines, 'Tasks');
    const r = t && t.rows.find((i) => taskIds(cells(doc.lines[i])[0] || '')[0] === task);
    if (r === undefined) fail(`${task} is not in the Tasks table of TRK-${nn}`);
    const cs = cells(doc.lines[r]);
    while (cs.length < 5) cs.push('');
    const old = canonStatus(cs[2]) || cs[2];
    if (old === next) fail(`${task} is already ${next}`);
    cs[2] = next;
    cs[3] = today();
    cs[4] = opts.note || ''; // a note belongs to one status; a new status without --note clears it
    doc.setLine(r, row(cs));
    appendHistory(doc, [today(), task, `${old} -> ${next}`, by, opts.reason]);
    out.push(`${task}: ${old} -> ${next}`);
    syncPlan(doc, out, nn);
  } else {
    const i = doc.lines.findIndex((l) => /^- Plan Status:/i.test(l));
    if (i === -1) fail(`TRK-${nn} has no "- Plan Status:" line`);
    const old = canonStatus(doc.lines[i].replace(/^- Plan Status:/i, '')) || 'Not Started';
    if (old === next) fail(`P-${nn} is already ${next}`);
    doc.setLine(i, `- Plan Status: ${next}`);
    appendHistory(doc, [today(), `P-${nn}`, `${old} -> ${next}`, by, opts.reason]);
    out.push(`P-${nn}: ${old} -> ${next}`);
  }
  doc.save();
  syncIndex(wb, f, out);
  return out;
}

function cmdRefresh(args) {
  const wb = workbench();
  const f = feature(wb, planId(args[0]));
  const doc = new Doc(f.trk);
  const out = [];
  syncPlan(doc, out, f.nn);
  doc.save();
  syncIndex(wb, f, out);
  return out.length ? out : [`P-${f.nn}: up to date`];
}

function cmdReady(args) {
  const wb = workbench();
  const list = args[0] ? [feature(wb, planId(args[0]))] : features(wb);
  const out = [];
  for (const f of list) for (const t of ready(f)) out.push(`P-${f.nn} ${t.id} ${t.title}`);
  return out.length ? out : ['none'];
}

function cmdOverview() {
  const wb = workbench();
  const out = [];
  for (const f of features(wb)) {
    const trk = readText(f.trk) || '';
    const tasks = tasksOf(trk);
    const plan = canonStatus(field(trk, 'Plan Status')) || 'Not Started';
    const contract = field(readText(f.contract || '') || '', 'Status') || 'Unknown';
    let line = `P-${f.nn} ${f.slug} | Plan: ${plan} | Contract: ${contract} | ${progress(tasks)}`;
    const done = tasks.filter((t) => t.status === 'Done').length;
    const total = tasks.filter((t) => t.status !== 'Canceled').length;
    if (['Done', 'Canceled'].includes(plan)) line += ' | closed';
    else if (!/^approved$/i.test(contract)) line += ` | needs /foreman:approve P-${f.nn}`;
    else if (plan === 'Hold') line += ` | on Hold - /foreman:resume P-${f.nn}`;
    else if (total > 0 && done === total) line += ` | all tasks Done - /foreman:close P-${f.nn}`;
    else {
      const r = ready(f);
      if (r.length) line += ` | ready: ${r.map((t) => `${t.id} (${t.title})`).join(', ')}`;
    }
    out.push(line);
  }
  for (const file of listDir(path.join(wb, 'interviews')).sort()) {
    const m = /^INT-(\d+)-(.+)\.md$/.exec(file);
    if (!m) continue;
    const text = readText(path.join(wb, 'interviews', file)) || '';
    const status = field(text, 'Status');
    if (!/^in progress$/i.test(status)) continue;
    const topics = tableRows(text, 'Coverage');
    const covered = topics.filter((c) => /^(covered|n\/a)$/i.test(c[1] || '')).length;
    out.push(`INT-${m[1]} ${m[2]} | Interview in progress | ${covered}/${topics.length} topics | /foreman:interview INT-${m[1]}`);
  }
  return out.length ? out : ['no features yet'];
}

function cmdNextNumber() {
  const wb = workbench();
  let max = 0;
  const see = (n) => { if (Number.isFinite(n) && n > max) max = n; };
  for (const dir of ['plans', 'contracts', 'tracking', 'docs', 'interviews', 'subtasks']) {
    for (const name of listDir(path.join(wb, dir))) {
      const m = /^(?:P|CONT|TRK|DOC|INT)-(\d+)-/.exec(name);
      if (m) see(Number(m[1]));
    }
  }
  for (const c of tableRows(readText(path.join(wb, 'INDEX.md')) || '', 'Features')) see(Number(c[0]));
  return [String(max + 1).padStart(2, '0')];
}

function cmdCheck(args) {
  const wb = workbench();
  const only = args[0] ? planId(args[0]) : null;
  const { findings, notes } = check(wb, only);
  const out = [...findings.map((x) => `finding: ${x}`), ...notes.map((x) => `note: ${x}`)];
  out.push(findings.length ? `${findings.length} finding(s)` : `OK${only ? ` (P-${only})` : ''} - no findings`);
  return { out, code: findings.length ? 2 : 0 };
}

const COMMANDS = { status: cmdStatus, refresh: cmdRefresh, ready: cmdReady, overview: cmdOverview, 'next-number': cmdNextNumber, check: cmdCheck };

function main(argv) {
  const [name, ...args] = argv;
  const cmd = COMMANDS[name];
  if (!cmd) {
    process.stdout.write(`ERROR: unknown command "${name || ''}". Commands: ${Object.keys(COMMANDS).join(', ')}\n`);
    return 1;
  }
  try {
    const r = cmd(args);
    const { out, code } = Array.isArray(r) ? { out: r, code: 0 } : r;
    process.stdout.write(`${out.join('\n')}\n`);
    return code;
  } catch (e) {
    process.stdout.write(`ERROR: ${e instanceof WbError ? e.message : e.stack}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { main };
