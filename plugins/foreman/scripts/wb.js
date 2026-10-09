#!/usr/bin/env node
// foreman state script: the mechanical workbench/ updates and answers, so the main
// agent does not edit status cells or compute counts by hand. No dependencies.
// Run from the project root (or set CLAUDE_PROJECT_DIR):
//   node wb.js status P-NN [TASK-TT] <status> --by <User|Main agent> --reason "<text>" [--note "<text>"]  (no --note: note cleared)
//   node wb.js continue P-NN TASK-TT --by ... --reason ... [--note ...] [--confirmed]  new run of an In Progress task
//   node wb.js refresh P-NN        recompute derived Plan Status, task file Status rows, INDEX Progress and Contract Status
//   node wb.js ready [P-NN]        tasks that can run now
//   node wb.js chain P-NN          Not Started tasks in run order (/foreman:run P-NN all), then blocked ones
//   node wb.js overview            one line per feature and open interview
//   node wb.js next-number         next free feature number NN (git: also numbers on other branches)
//   node wb.js running [P-NN]      In Progress tasks and the session running each
//   node wb.js renumber P-NN <slug> [NN]  move one feature to a new number (after a collision)
//   node wb.js check [P-NN]        mechanical consistency checks (/foreman:doctor); exit 2 with findings
// Exit 0 on success; 1 with "ERROR: <reason>" (nothing written) on bad input or state.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readText, listDir, cells, tableAt, tableRows, field, taskIds, findFile } = require('./lib');
const { check } = require('./check');

const STATUSES = ['Not Started', 'In Progress', 'Hold', 'Done', 'Canceled'];
const BY = ['User', 'Main agent'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREFIXES = ['P', 'CONT', 'TRK', 'DOC', 'INT', 'REP'];

class WbError extends Error {}
const fail = (msg) => { throw new WbError(msg); };

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${today()} ${p(d.getHours())}:${p(d.getMinutes())}`;
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

// Not Started tasks of an active, approved plan in dependency order (ties by task
// number), assuming each runs to Done; tasks that wait on a task outside that
// order (Hold, In Progress, Canceled, unknown, or a cycle) are returned as blocked.
function chain(f) {
  const trk = readText(f.trk) || '';
  const plan = canonStatus(field(trk, 'Plan Status')) || 'Not Started';
  const contract = field(readText(f.contract || '') || '', 'Status');
  if (!/^approved$/i.test(contract)) fail(`P-${f.nn} contract is "${contract || 'missing'}", not Approved - run /foreman:approve P-${f.nn}`);
  if (['Hold', 'Canceled', 'Done'].includes(plan)) fail(`P-${f.nn} is ${plan}`);
  const tasks = tasksOf(trk);
  const deps = depsOf(readText(f.plan || ''));
  const statusOf = Object.fromEntries(tasks.map((t) => [t.id, t.status]));
  const num = (id) => Number(id.slice(5));
  const done = new Set(tasks.filter((t) => t.status === 'Done').map((t) => t.id));
  let left = tasks.filter((t) => t.status === 'Not Started').sort((a, b) => num(a.id) - num(b.id));
  const order = [];
  for (;;) {
    const next = left.find((t) => (deps[t.id] || []).every((d) => done.has(d)));
    if (!next) break;
    order.push(next);
    done.add(next.id);
    left = left.filter((t) => t !== next);
  }
  const blocked = left.map((t) => {
    const waits = (deps[t.id] || []).filter((d) => !done.has(d))
      .map((d) => `${d} ${statusOf[d] && statusOf[d] !== 'Not Started' ? statusOf[d] : statusOf[d] ? 'blocked' : 'unknown'}`);
    return { ...t, waits };
  });
  return { order, blocked };
}

// Session markers: workbench/.baseline/P-NN/TASK-TT.session, written when a task goes
// In Progress and removed when it leaves, so another Claude Code session can see that
// the task runs elsewhere. Local only: .baseline/ is never in version control. The
// session id and process id come from the environment Claude Code gives shell commands.
function currentSession() {
  return { id: process.env.CLAUDE_CODE_SESSION_ID || '', pid: Number(process.env.CLAUDE_PID) || 0 };
}

const markerFile = (wb, nn, task) => path.join(wb, '.baseline', `P-${nn}`, `${task}.session`);

function writeMarker(wb, nn, task) {
  const s = currentSession();
  const file = markerFile(wb, nn, task);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `- Session: ${s.id || '—'}\n- Process: ${s.pid || '—'}\n- Started: ${now()}\n`);
}

// Removes a marker, and its P-NN folder when that is left empty.
function removeMarker(wb, nn, task) {
  const file = markerFile(wb, nn, task);
  const had = fs.existsSync(file);
  if (had) fs.rmSync(file, { force: true });
  try { fs.rmdirSync(path.dirname(file)); } catch { /* missing or not empty */ }
  return had;
}

function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// Who runs an In Progress task: { mine, text }. mine = started by this session.
function owner(wb, nn, task) {
  const text = readText(markerFile(wb, nn, task));
  if (text === null) return { mine: false, text: 'no session marker - started on another machine, by hand, or by an older foreman' };
  const cur = currentSession();
  const id = field(text, 'Session').replace(/^—$/, '');
  const pid = Number(field(text, 'Process')) || 0;
  const since = `since ${field(text, 'Started') || '?'}`;
  if (id && id === cur.id) return { mine: true, text: `this session, ${since}` };
  if (pid && pid === cur.pid) return { mine: false, text: `an earlier session of this Claude Code process, not running now, ${since}` };
  if (!pid) return { mine: false, text: `another session, running or ended (no process id recorded), ${since}` };
  if (alive(pid)) return { mine: false, text: `another Claude Code session (process ${pid}) is running, ${since}` };
  return { mine: false, text: `interrupted - its Claude Code session has ended, ${since}` };
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

// Mirrors a task's TRK status into the `| Status |` row of its task file header
// table, adding the row (first, under the separator) to older task files. The TRK
// `Tasks` table stays the source of truth. No task file: nothing to mirror.
// Returns the changed Doc (not saved yet), or null.
function syncTaskFile(wb, f, task, status, out) {
  const file = findFile(path.join(wb, 'subtasks', `P-${f.nn}-${f.slug}`), `${task}-`);
  if (!file) return null;
  const doc = new Doc(file);
  const head = doc.lines.findIndex((l) => /^\|\s*Field\s*\|\s*Value\s*\|/i.test(l));
  if (head === -1) return null;
  let end = head + 2;
  while (end < doc.lines.length && /^\|/.test(doc.lines[end])) end++;
  const i = doc.lines.slice(head + 2, end).findIndex((l) => /^\|\s*Status\s*\|/i.test(l));
  if (i !== -1) doc.setLine(head + 2 + i, row(['Status', status]));
  else doc.insertAfter(head + 1, row(['Status', status]));
  if (!doc.changed) return null;
  out.push(`${task} task file Status: ${status}`);
  return doc;
}

// Updates the INDEX features row of P-NN (Progress from `tasks`, Contract Status).
// Returns the Doc, not saved yet: callers check everything before the first write.
function syncIndex(wb, f, tasks, out) {
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
  const prog = progress(tasks);
  const cont = field(readText(f.contract || '') || '', 'Status');
  if (iProg !== -1 && cs[iProg] !== prog) { out.push(`INDEX P-${f.nn} Progress: ${prog}`); cs[iProg] = prog; }
  if (iCont !== -1 && cont && cs[iCont] !== cont) { out.push(`INDEX P-${f.nn} Contract Status: ${cont}`); cs[iCont] = cont; }
  doc.setLine(r, row(cs));
  return doc;
}

// Saves every prepared Doc (nulls skipped). Called only after all checks passed.
function saveAll(...docs) {
  for (const d of docs) if (d) d.save();
}

function parseOpts(args) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const m = /^--(by|reason|note)$/.exec(args[i]);
    if (args[i] === '--confirmed') opts.confirmed = true;
    else if (m) {
      if (i + 1 >= args.length) fail(`--${m[1]} needs a value`);
      opts[m[1]] = args[++i];
    } else pos.push(args[i]);
  }
  return { pos, opts };
}

// Fails when a task of the plan (other than `skip`) is In Progress outside this session.
function refuseElsewhere(wb, nn, doc, skip) {
  const elsewhere = tasksOf(doc.text).filter((x) => x.id !== skip && x.status === 'In Progress')
    .map((x) => ({ id: x.id, o: owner(wb, nn, x.id) })).filter((x) => !x.o.mine);
  if (elsewhere.length) {
    fail(`P-${nn} has a task In Progress outside this session: ${elsewhere.map((x) => `${x.id} (${x.o.text})`).join('; ')}. Ask the user; only on yes run this again with --confirmed`);
  }
}

// A new run of a task that is already In Progress (restored by /foreman:resume, or
// left by an interrupted run): History row `In Progress -> In Progress`, the TRK row's
// Updated date and Note, and the session marker now names this session. No status change.
function cmdContinue(args) {
  const { pos, opts } = parseOpts(args);
  const wb = workbench();
  const nn = planId(pos.shift());
  const task = /^TASK-\d+$/i.test(pos[0] || '') ? pos.shift().toUpperCase() : fail('usage: continue P-NN TASK-TT --by <User|Main agent> --reason "<text>" [--note "<text>"] [--confirmed]');
  const by = BY.find((b) => b.toLowerCase() === String(opts.by || '').toLowerCase());
  if (!by) fail('--by must be "User" or "Main agent"');
  if (!opts.reason || !opts.reason.trim()) fail('--reason is required');

  const f = feature(wb, nn);
  const doc = new Doc(f.trk);
  const t = tableAt(doc.lines, 'Tasks');
  const r = t && t.rows.find((i) => taskIds(cells(doc.lines[i])[0] || '')[0] === task);
  if (r === undefined) fail(`${task} is not in the Tasks table of TRK-${nn}`);
  const cs = cells(doc.lines[r]);
  while (cs.length < 5) cs.push('');
  const status = canonStatus(cs[2]) || cs[2];
  if (status !== 'In Progress') fail(`${task} is ${status}, not In Progress - use: status P-${nn} ${task} In Progress`);
  if (!opts.confirmed) refuseElsewhere(wb, nn, doc, null);
  cs[3] = today();
  cs[4] = opts.note || '';
  doc.setLine(r, row(cs));
  appendHistory(doc, [today(), task, 'In Progress -> In Progress', by, opts.reason]);
  const out = [`${task}: In Progress (continued)`];
  const taskDoc = syncTaskFile(wb, f, task, status, out);
  const indexDoc = syncIndex(wb, f, tasksOf(doc.text), out);
  saveAll(doc, taskDoc, indexDoc);
  writeMarker(wb, nn, task);
  return out;
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
    if (old === next) fail(`${task} is already ${next}${next === 'In Progress' ? ` - to run it again, use: continue P-${nn} ${task}` : ''}`);
    if (next === 'In Progress' && !opts.confirmed) refuseElsewhere(wb, nn, doc, task);
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
  const taskDoc = task ? syncTaskFile(wb, f, task, next, out) : null;
  const indexDoc = syncIndex(wb, f, tasksOf(doc.text), out);
  saveAll(doc, taskDoc, indexDoc);
  if (task && next === 'In Progress') writeMarker(wb, nn, task);
  else if (task) removeMarker(wb, nn, task);
  return out;
}

function cmdRefresh(args) {
  const wb = workbench();
  const f = feature(wb, planId(args[0]));
  const doc = new Doc(f.trk);
  const out = [];
  syncPlan(doc, out, f.nn);
  const tasks = tasksOf(doc.text);
  const taskDocs = tasks.map((t) => syncTaskFile(wb, f, t.id, t.status, out));
  const indexDoc = syncIndex(wb, f, tasks, out);
  saveAll(doc, ...taskDocs, indexDoc);
  for (const name of listDir(path.join(wb, '.baseline', `P-${f.nn}`))) {
    const m = /^(TASK-\d+)\.session$/.exec(name);
    const t = m && tasks.find((x) => x.id === m[1]);
    if (m && (!t || t.status !== 'In Progress') && removeMarker(wb, f.nn, m[1])) out.push(`${m[1]} session marker removed (not In Progress)`);
  }
  return out.length ? out : [`P-${f.nn}: up to date`];
}

function cmdReady(args) {
  const wb = workbench();
  const list = args[0] ? [feature(wb, planId(args[0]))] : features(wb);
  const out = [];
  for (const f of list) for (const t of ready(f)) out.push(`P-${f.nn} ${t.id} ${t.title}`);
  return out.length ? out : ['none'];
}

function cmdChain(args) {
  const f = feature(workbench(), planId(args[0]));
  const { order, blocked } = chain(f);
  const out = order.map((t, i) => `${i + 1}. P-${f.nn} ${t.id} ${t.title}`);
  for (const t of blocked) out.push(`blocked: P-${f.nn} ${t.id} ${t.title} (waits for ${t.waits.join(', ')})`);
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

const FEATURE_NAME = /^(?:P|CONT|TRK|DOC|INT)-(\d+)-([a-z0-9-]+?)(?:\.md)?$/;

// Highest feature number in the working tree (files and INDEX rows).
function localMax(wb) {
  let max = 0;
  for (const dir of ['plans', 'contracts', 'tracking', 'docs', 'interviews', 'subtasks']) {
    for (const name of listDir(path.join(wb, dir))) {
      const m = FEATURE_NAME.exec(name);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  for (const c of tableRows(readText(path.join(wb, 'INDEX.md')) || '', 'Features')) {
    if (/^\d+$/.test(c[0])) max = Math.max(max, Number(c[0]));
  }
  return max;
}

// Git only: feature numbers in workbench/ on the other local branches and the fetched
// remote branches (read-only; no fetch). [{ n, ref, name }]; [] when git fails.
function branchFeatures(wb) {
  if (field(readText(path.join(wb, 'INDEX.md')) || '', 'Version control') !== 'git') return [];
  const git = (...a) => spawnSync('git', a, { cwd: root(), encoding: 'utf8', windowsHide: true });
  const refs = git('for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes');
  if (refs.status !== 0) return [];
  const head = (git('symbolic-ref', '-q', 'HEAD').stdout || '').trim();
  const out = [];
  for (const ref of refs.stdout.split(/\r?\n/).filter((r) => r && r !== head && !/\/HEAD$/.test(r))) {
    const r = git('ls-tree', '-r', '--name-only', ref, '--', 'workbench');
    if (r.status !== 0) continue;
    const seen = new Set();
    for (const file of r.stdout.split(/\r?\n/)) {
      for (const part of file.split('/')) {
        const m = FEATURE_NAME.exec(part);
        if (!m || seen.has(m[1])) continue;
        seen.add(m[1]);
        out.push({ n: Number(m[1]), ref: ref.replace(/^refs\/(heads|remotes)\//, ''), name: `${m[1]}-${m[2]}` });
      }
    }
  }
  return out;
}

function nextNumber(wb) {
  const local = localMax(wb);
  const above = branchFeatures(wb).filter((b) => b.n > local);
  const max = Math.max(local, ...above.map((b) => b.n));
  const notes = [...new Set(above.map((b) => `${b.name} on ${b.ref}`))].sort();
  return { nn: String(max + 1).padStart(2, '0'), notes };
}

function cmdNextNumber() {
  const { nn, notes } = nextNumber(workbench());
  return [nn, ...(notes.length ? [`note: numbers used on other branches: ${notes.join(', ')}`] : [])];
}

function cmdRunning(args) {
  const wb = workbench();
  const list = args[0] ? [feature(wb, planId(args[0]))] : features(wb);
  const out = [];
  for (const f of list) {
    for (const t of tasksOf(readText(f.trk) || '').filter((x) => x.status === 'In Progress')) {
      const o = owner(wb, f.nn, t.id);
      out.push(`P-${f.nn} ${t.id} ${t.title} | ${o.mine ? o.text : `elsewhere: ${o.text}`}`);
    }
  }
  return out.length ? out : ['none'];
}

// Moves feature NN-<slug> to a new number: renames its files and subtasks folder,
// rewrites its IDs and links (P-, CONT-, TRK-, DOC-, INT-, REP-NN) inside them, and its
// INDEX row (moved to its sorted place). Other features' files are not touched.
function cmdRenumber(args) {
  const wb = workbench();
  const nn = planId(args[0]);
  const slug = args[1] || '';
  if (!SLUG.test(slug)) fail('usage: renumber P-NN <slug> [new number]');
  const to = args[2] ? (/^\d+$/.test(args[2]) ? String(Number(args[2])).padStart(2, '0') : fail(`new number must be digits, got "${args[2]}"`)) : nextNumber(wb).nn;
  if (to === nn) fail(`P-${nn} already has number ${to}`);

  const dirs = { P: 'plans', CONT: 'contracts', TRK: 'tracking', DOC: 'docs', INT: 'interviews', REP: 'reports' };
  const moves = Object.entries(dirs)
    .map(([prefix, dir]) => [path.join(wb, dir, `${prefix}-${nn}-${slug}.md`), path.join(wb, dir, `${prefix}-${to}-${slug}.md`)])
    .filter(([from]) => fs.existsSync(from));
  const sub = [path.join(wb, 'subtasks', `P-${nn}-${slug}`), path.join(wb, 'subtasks', `P-${to}-${slug}`)];
  const hasSub = fs.existsSync(sub[0]);
  if (!moves.length && !hasSub) fail(`no files of feature ${nn} "${slug}"`);

  const used = [...Object.entries(dirs), ['P', 'subtasks']].some(([prefix, dir]) => listDir(path.join(wb, dir)).some((n) => n.startsWith(`${prefix}-${to}-`)));
  const indexDoc = new Doc(path.join(wb, 'INDEX.md'));
  const t = tableAt(indexDoc.lines, 'Features');
  const rows = t && t.header !== -1 ? t.rows : [];
  if (used || rows.some((i) => cells(indexDoc.lines[i])[0] === to)) fail(`number ${to} is already used`);

  const trk = moves.find(([from]) => path.basename(from).startsWith('TRK-'));
  if (trk) {
    const running = tasksOf(readText(trk[0]) || '').filter((x) => x.status === 'In Progress').map((x) => x.id);
    if (running.length) fail(`P-${nn} has tasks In Progress (${running.join(', ')}) - finish them or put them on Hold first`);
  }

  // The exact name: not followed by more slug text, so `tags` never matches `tags-v2`.
  const links = new RegExp(`\\b(${PREFIXES.join('|')})-${nn}-${slug}(?![a-z0-9-])`, 'g');
  const ids = new RegExp(`\\b(${PREFIXES.join('|')})-${nn}\\b(?!-[a-z0-9])`, 'g');
  const rewrite = (text) => text.replace(links, `$1-${to}-${slug}`).replace(ids, `$1-${to}`);
  const out = [];

  // Contents first, then names: an error before the renames leaves the names as they were.
  const taskFiles = hasSub ? listDir(sub[0]).filter((n) => n.endsWith('.md')).map((n) => path.join(sub[0], n)) : [];
  for (const file of [...moves.map(([from]) => from), ...taskFiles]) {
    const text = readText(file);
    if (text !== null && rewrite(text) !== text) fs.writeFileSync(file, rewrite(text));
  }

  const r = rows.find((i) => cells(indexDoc.lines[i])[0] === nn && new RegExp(links.source).test(indexDoc.lines[i]));
  if (r !== undefined) {
    const cs = cells(indexDoc.lines[r]).map(rewrite);
    cs[0] = to;
    indexDoc.lines.splice(r, 1);
    const later = rows.filter((i) => i !== r).map((i) => (i > r ? i - 1 : i))
      .find((i) => /^\d+$/.test(cells(indexDoc.lines[i])[0]) && Number(cells(indexDoc.lines[i])[0]) > Number(to));
    const at = later !== undefined ? later : (t.last > r ? t.last - 1 : t.last) + 1;
    indexDoc.lines.splice(at, 0, row(cs));
    indexDoc.changed = true;
    out.push(`INDEX row ${nn} -> ${to}`);
  }

  for (const [from, dest] of moves) {
    fs.renameSync(from, dest);
    out.push(`${path.relative(wb, from).split(path.sep).join('/')} -> ${path.basename(dest)}`);
  }
  if (hasSub) {
    fs.renameSync(sub[0], sub[1]);
    out.push(`subtasks/P-${nn}-${slug}/ -> P-${to}-${slug}/`);
  }
  indexDoc.save();

  if (trk) {
    const doc = new Doc(trk[1]);
    const a = tableAt(doc.lines, 'Activity');
    if (a && a.header !== -1) {
      doc.insertAfter(a.last, row([today(), `P-${to}`, 'Main agent', 'Action', `renumbered from P-${nn} (feature number collision)`]));
      doc.save();
    }
  }
  return out;
}

function cmdCheck(args) {
  const wb = workbench();
  const only = args[0] ? planId(args[0]) : null;
  const { findings, notes } = check(wb, only);
  const out = [...findings.map((x) => `finding: ${x}`), ...notes.map((x) => `note: ${x}`)];
  out.push(findings.length ? `${findings.length} finding(s)` : `OK${only ? ` (P-${only})` : ''} - no findings`);
  return { out, code: findings.length ? 2 : 0 };
}

const COMMANDS = { status: cmdStatus, continue: cmdContinue, refresh: cmdRefresh, ready: cmdReady, chain: cmdChain, overview: cmdOverview, 'next-number': cmdNextNumber, running: cmdRunning, renumber: cmdRenumber, check: cmdCheck };

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
