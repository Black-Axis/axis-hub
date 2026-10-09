// `wb.js check [P-NN]`: the mechanical /foreman:doctor checks. Returns findings
// (`<path>: <problem>`) and notes (report-only items). No dependencies.

const fs = require('fs');
const path = require('path');
const { readText, listDir, tableAt, tableRows, cells, field, taskIds } = require('./lib');

const STATUSES = ['Not Started', 'In Progress', 'Hold', 'Done', 'Canceled'];
const CONTRACT = ['Draft', 'Approved', 'Amended Pending Approval'];
const INTERVIEW = ['In Progress', 'Done', 'Canceled'];
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const NUM = '(\\d{2}|[1-9]\\d{2,})';
const TASK_SECTIONS = ['Problem', 'Evidence', 'Required Outcome', 'Files Expected to Change', 'Out of Scope', 'Implementation', 'Report Requirements'];
const FOLDERS = { plans: 'P', contracts: 'CONT', tracking: 'TRK', docs: 'DOC' };

// Text under `## <heading>` up to the next `## ` heading (null if missing).
function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (i === -1) return null;
  const out = [];
  for (let j = i + 1; j < lines.length && !lines[j].startsWith('## '); j++) out.push(lines[j]);
  return out.join('\n').trim();
}

// Every .md file under workbench/ (relative, '/' separated), without .baseline/.
function markdownFiles(wb, dir = '') {
  const out = [];
  for (const name of listDir(path.join(wb, dir))) {
    const rel = dir ? `${dir}/${name}` : name;
    if (rel === '.baseline') continue;
    if (name.endsWith('.md')) out.push(rel);
    else if (!name.includes('.')) out.push(...markdownFiles(wb, rel));
  }
  return out;
}

function progress(tasks) {
  const done = tasks.filter((t) => t.status === 'Done').length;
  const total = tasks.filter((t) => t.status !== 'Canceled').length;
  return `${done}/${total} Done${tasks.filter((t) => t.status === 'In Progress').map((t) => `, ${t.id} In Progress`).join('')}`;
}

function check(wb, only) {
  const findings = [];
  const notes = [];
  const add = (file, problem) => findings.push(`${file}: ${problem}`);
  const indexText = readText(path.join(wb, 'INDEX.md')) || '';

  // Unresolved merge conflicts (parallel branches editing INDEX or the same TRK file).
  for (const rel of markdownFiles(wb)) {
    if (only && rel !== 'INDEX.md' && !rel.includes(`-${only}-`)) continue;
    if (/^(<{7}|>{7})( |$)/m.test(readText(path.join(wb, rel)) || '')) add(rel, 'unresolved merge conflict (<<<<<<< / >>>>>>> lines) - resolve it, then run /foreman:doctor');
  }

  // INDEX settings.
  const settings = [
    ['Version control', /^(git|tfvc|none)$/, false],
    ['Workbench', /^(tracked|ignored)$/, true],
    ['Output', /^(Concise|Normal)$/, true],
    ['Fix rounds', /^(\d|10)$/, true],
    ['Worker model', /^(sonnet|opus|haiku)$/, false],
    ['CLAUDE.md', /^(yes|no)$/, true],
  ];
  if (!only) {
    for (const [name, valid, required] of settings) {
      let value = field(indexText, name);
      if (!value && name === 'Workbench') {
        const git = field(indexText, 'Git');
        if (git) {
          if (/^(committed|ignored)$/.test(git)) notes.push(`INDEX.md: old "Git: ${git}" line - can be renamed to "Workbench: ${git === 'committed' ? 'tracked' : 'ignored'}"`);
          else add('INDEX.md', `invalid Git value "${git}"`);
          continue;
        }
      }
      if (!value) { if (required) add('INDEX.md', `missing setting "${name}"`); continue; }
      if (!valid.test(value)) add('INDEX.md', `invalid ${name} value "${value}"`);
    }
    // Working Rules Defaults (optional section; lines optional).
    const base = field(indexText, 'Baseline tests');
    if (base && !/^(yes|no)$/.test(base)) add('INDEX.md', `invalid Baseline tests default "${base}"`);
    const full = field(indexText, 'Full tests');
    if (full && !/^(close|each task)$/.test(full)) add('INDEX.md', `invalid Full tests default "${full}"`);
  }

  // Index rows: NN -> { row cells }.
  const t = tableAt(indexText.split(/\r?\n/), 'Features');
  const idx = {};
  let head = [];
  if (t && t.header !== -1) {
    const lines = indexText.split(/\r?\n/);
    head = cells(lines[t.header]).map((h) => h.toLowerCase());
    for (const i of t.rows) {
      const cs = cells(lines[i]);
      const nn = (cs[0] || '').trim();
      if (idx[nn]) add('INDEX.md', `duplicate feature number ${nn} (fix: wb.js renumber P-${nn} <slug> for one of the features)`);
      idx[nn] = cs;
    }
  } else if (!only) add('INDEX.md', 'no Features table');

  // Feature files per folder, with naming.
  const files = {}; // nn -> { P: slug, ... }
  for (const [dir, prefix] of Object.entries(FOLDERS)) {
    for (const name of listDir(path.join(wb, dir))) {
      if (name === '.gitkeep') continue;
      const m = new RegExp(`^${prefix}-${NUM}-(${SLUG})\\.md$`).exec(name);
      if (!m) {
        if (!only) add(`${dir}/${name}`, `name does not follow ${prefix}-NN-<slug>.md`);
        continue;
      }
      const [, nn, slug] = m;
      if (only && nn !== only) continue;
      files[nn] = files[nn] || {};
      if (files[nn][prefix] && files[nn][prefix] !== slug) add(`${dir}/${name}`, `second ${prefix} file for number ${nn} (fix: wb.js renumber P-${nn} ${slug})`);
      files[nn][prefix] = slug;
    }
  }
  for (const name of listDir(path.join(wb, 'subtasks'))) {
    if (name === '.gitkeep') continue;
    const m = new RegExp(`^P-${NUM}-(${SLUG})$`).exec(name);
    if (!m) { if (!only) add(`subtasks/${name}`, 'folder name does not follow P-NN-<slug>'); continue; }
    if (only && m[1] !== only) continue;
    files[m[1]] = files[m[1]] || {};
    files[m[1]].S = m[2];
  }

  const numbers = new Set([...Object.keys(files), ...Object.keys(idx).filter((n) => !only || n === only)]);
  for (const nn of [...numbers].sort()) {
    const f = files[nn] || {};
    const slug = f.TRK || f.P || f.CONT || f.DOC || f.S;
    if (!idx[nn]) add(`(feature ${nn})`, 'files without an INDEX row');
    for (const [label, key, rel] of [['plan', 'P', `plans/P-${nn}-${slug}.md`], ['contract', 'CONT', `contracts/CONT-${nn}-${slug}.md`], ['tracking', 'TRK', `tracking/TRK-${nn}-${slug}.md`], ['doc', 'DOC', `docs/DOC-${nn}-${slug}.md`], ['subtasks folder', 'S', `subtasks/P-${nn}-${slug}/`]]) {
      if (!f[key]) add(rel, `missing ${label} of feature ${nn}`);
      else if (f[key] !== slug) add(rel.replace(slug, f[key]), `slug "${f[key]}" differs from "${slug}"`);
    }
    if (!f.TRK) continue;
    checkFeature(wb, nn, slug, f, idx[nn], head, add, notes);
  }

  // Interviews.
  for (const name of listDir(path.join(wb, 'interviews'))) {
    if (name === '.gitkeep') continue;
    const m = new RegExp(`^INT-${NUM}-(${SLUG})\\.md$`).exec(name);
    if (!m) { if (!only) add(`interviews/${name}`, 'name does not follow INT-NN-<slug>.md'); continue; }
    if (only && m[1] !== only) continue;
    const text = readText(path.join(wb, 'interviews', name)) || '';
    const status = field(text, 'Status');
    if (!INTERVIEW.includes(status)) add(`interviews/${name}`, `invalid Status "${status}"`);
    if (status === 'Done') {
      const plan = `P-${m[1]}-${m[2]}`;
      if (!new RegExp(`\\b${plan}\\b`).test(field(text, 'Plan')) || !fs.existsSync(path.join(wb, 'plans', `${plan}.md`))) add(`interviews/${name}`, `Done but does not link the existing plan ${plan}`);
      else if (!/^interview$/i.test(field(readText(path.join(wb, 'plans', `${plan}.md`)) || '', 'Type'))) add(`plans/${plan}.md`, 'Source Type should be "interview"');
    }
    const other = files[m[1]] && (files[m[1]].P || files[m[1]].TRK);
    if (other && other !== m[2]) add(`interviews/${name}`, `number ${m[1]} is used by feature "${other}" (fix: wb.js renumber P-${m[1]} ${m[2]})`);
    if (status === 'In Progress') notes.push(`interviews/${name}: interview in progress - /foreman:interview INT-${m[1]}`);
  }
  return { findings, notes };
}

function checkFeature(wb, nn, slug, f, indexRow, head, add, notes) {
  const trkRel = `tracking/TRK-${nn}-${slug}.md`;
  const trk = readText(path.join(wb, trkRel)) || '';
  const plan = f.P ? readText(path.join(wb, 'plans', `P-${nn}-${f.P}.md`)) || '' : '';
  const contractRel = `contracts/CONT-${nn}-${f.CONT}.md`;
  const contract = f.CONT ? readText(path.join(wb, contractRel)) || '' : '';

  // Tracking format.
  const history = tableAt(trk.split(/\r?\n/), 'History');
  if (!history || history.header === -1) add(trkRel, 'no History table');
  else if (!cells(trk.split(/\r?\n/)[history.header]).some((c) => /^by$/i.test(c))) add(trkRel, 'History table has no By column');
  if (!tableAt(trk.split(/\r?\n/), 'Activity') || tableAt(trk.split(/\r?\n/), 'Activity').header === -1) add(trkRel, 'no Activity table');

  const tasks = tableRows(trk, 'Tasks').map((c) => ({ id: taskIds(c[0])[0], title: c[1] || '', status: c[2] || '' })).filter((x) => x.id);
  const seen = new Set();
  for (const x of tasks) {
    if (seen.has(x.id)) add(trkRel, `${x.id} appears twice in Tasks`);
    seen.add(x.id);
    if (!STATUSES.includes(x.status)) add(trkRel, `${x.id} has invalid status "${x.status}"`);
  }
  const planStatus = field(trk, 'Plan Status');
  if (!STATUSES.includes(planStatus)) add(trkRel, `invalid Plan Status "${planStatus}"`);

  // History: targets and last entries.
  const rows = tableRows(trk, 'History');
  const last = {};
  for (const c of rows) {
    const target = c[1] || '';
    if (!/^(P-\d+|TASK-\d+)$/.test(target)) { add(trkRel, `History row for "${target}" - History holds task and plan status changes only (move it to Activity)`); continue; }
    const m = /->\s*(.+)$/.exec(c[2] || '');
    if (!m) continue;
    const status = m[1].trim();
    if (!STATUSES.includes(status)) {
      add(trkRel, `History row "${target} | ${c[2]}" is not a task or plan status change (e.g. a contract status) - move it to Activity`);
      continue;
    }
    last[target] = { status, reason: c[4] || '' };
  }
  for (const x of tasks) {
    if (!last[x.id] && STATUSES.includes(x.status) && x.status !== 'Not Started') add(trkRel, `${x.id} is "${x.status}" but has no History entry`);
    if (last[x.id] && last[x.id].status !== x.status) add(trkRel, `${x.id} is "${x.status}" but its last History entry says "${last[x.id].status}"`);
  }
  if (last[`P-${nn}`] && last[`P-${nn}`].status !== planStatus) add(trkRel, `Plan Status is "${planStatus}" but the last P-${nn} History entry says "${last[`P-${nn}`].status}"`);
  if (['Not Started', 'In Progress'].includes(planStatus)) {
    const derived = tasks.some((x) => x.status === 'In Progress' || x.status === 'Done') ? 'In Progress' : 'Not Started';
    if (derived !== planStatus) add(trkRel, `Plan Status should be "${derived}" (derived from the task statuses)`);
  }
  if (planStatus === 'Done' && !rows.some((c) => (c[1] || '') === `P-${nn}` && /-> *Done/.test(c[2] || '') && /^(Closed|Imported)/i.test(c[4] || ''))) {
    add(trkRel, 'plan is Done without a "Closed" or "Imported" History entry');
  }

  // Tasks vs task files vs plan.
  const dir = path.join(wb, 'subtasks', `P-${nn}-${f.S || slug}`);
  const fileTasks = {};
  for (const name of listDir(dir)) {
    if (name === '.gitkeep') continue;
    const m = new RegExp(`^TASK-${NUM}-(${SLUG})\\.md$`).exec(name);
    const rel = `subtasks/P-${nn}-${f.S || slug}/${name}`;
    if (!m) { add(rel, 'name does not follow TASK-TT-<slug>.md'); continue; }
    const id = `TASK-${m[1]}`;
    if (fileTasks[id]) add(rel, `duplicate task number ${id}`);
    const text = readText(path.join(dir, name)) || '';
    const h = /^# TASK-\d+:\s*(.+)$/m.exec(text);
    const st = /^\|\s*Status\s*\|\s*([^|]*?)\s*\|/m.exec(text);
    fileTasks[id] = { rel, title: h ? h[1].trim() : '', status: st ? st[1] : null };
    const wm = /^\|\s*Worker model\s*\|\s*([^|]*?)\s*\|/m.exec(text);
    if (wm && !/^(—|-|sonnet|opus|haiku)$/.test(wm[1])) add(rel, `invalid Worker model "${wm[1]}" (—, sonnet, opus, or haiku)`);
    if (!st) notes.push(`${rel}: no Status header row (task from before 1.5.0; doctor can add it)`);
    for (const s of TASK_SECTIONS) {
      const body = section(text, s);
      if (body === null) add(rel, `missing section "${s}"`);
      else if (!body || /\{\{[^}]*\}\}/.test(body)) add(rel, `section "${s}" is empty or still a {{...}} placeholder`);
    }
    if (!/^\| Baseline \|/m.test(text)) notes.push(`${rel}: no Baseline header row (task from before 1.3.0)`);
    const gaps = (text.match(/Missing - from import/g) || []).length;
    if (gaps) notes.push(`${rel}: ${gaps} "Missing - from import" field(s) to fill`);
  }
  const breakdown = {};
  for (const c of tableRows(plan, 'Task Breakdown')) {
    const id = taskIds(c[0] || '')[0];
    if (id) breakdown[id] = { title: c[1] || '', deps: taskIds(c[2] || '') };
  }
  const ids = new Set([...tasks.map((x) => x.id), ...Object.keys(fileTasks), ...Object.keys(breakdown)]);
  for (const id of [...ids].sort()) {
    const row = tasks.find((x) => x.id === id);
    if (!fileTasks[id]) add(trkRel, `${id} has no task file`);
    if (!row) add(trkRel, `${id} has no Tasks row`);
    if (f.P && !breakdown[id]) add(`plans/P-${nn}-${f.P}.md`, `${id} is missing from the Task Breakdown`);
    const titles = [fileTasks[id] && fileTasks[id].title, row && row.title, breakdown[id] && breakdown[id].title].filter((x) => x !== undefined);
    if (new Set(titles).size > 1) add(trkRel, `${id} title differs: ${titles.map((x) => `"${x}"`).join(' / ')} (task file / TRK / plan)`);
    if (row && fileTasks[id] && fileTasks[id].status !== null && fileTasks[id].status !== row.status) {
      add(fileTasks[id].rel, `Status "${fileTasks[id].status}" but TRK says "${row.status}" (fix: wb.js refresh P-${nn})`);
    }
    for (const d of (breakdown[id] && breakdown[id].deps) || []) {
      if (!ids.has(d)) add(`plans/P-${nn}-${f.P}.md`, `${id} depends on unknown ${d}`);
    }
  }

  // Contract.
  if (f.CONT) {
    const status = field(contract, 'Status');
    if (!CONTRACT.includes(status)) add(contractRel, `invalid Status "${status}"`);
    if (status === 'Approved' && !/^\d{4}-\d{2}-\d{2}/.test(field(contract, 'Approved'))) add(contractRel, 'Approved without a date');
    const auto = field(contract, 'Auto-close').split(/\s/)[0];
    if (auto && !/^(Ask|Yes|No)$/.test(auto)) add(contractRel, `invalid Auto-close "${auto}"`);
    const base = field(contract, 'Baseline tests').split(/\s/)[0];
    if (base && !/^(yes|no)$/.test(base)) add(contractRel, `invalid Baseline tests "${base}"`);
    const full = field(contract, 'Full tests').replace(/\s*\(.*$/, '');
    if (full && !/^(close|each task)$/.test(full)) add(contractRel, `invalid Full tests "${full}"`);
    if (status !== 'Approved') {
      for (const c of tableRows(contract, 'Change Requests')) {
        if (/\d{4}-\d{2}-\d{2}/.test(c[c.length - 1] || '') && status === 'Draft') add(contractRel, `change request ${c[0]} approved while the contract is ${status}`);
      }
    }
    if (indexRow) {
      const iCont = head.indexOf('contract status');
      if (iCont !== -1 && indexRow[iCont] !== status) add('INDEX.md', `P-${nn} Contract Status "${indexRow[iCont]}" but the contract says "${status}"`);
    }
  }
  if (indexRow) {
    const iProg = head.indexOf('progress');
    const want = progress(tasks);
    if (iProg !== -1 && indexRow[iProg] !== want) add('INDEX.md', `P-${nn} Progress "${indexRow[iProg]}" should be "${want}"`);
  }

  // Leftover snapshots.
  for (const name of listDir(path.join(wb, '.baseline', `P-${nn}`))) {
    const marker = /^(TASK-\d+)\.session$/.exec(name);
    const row = tasks.find((x) => x.id === (marker ? marker[1] : name));
    if (row && row.status === 'In Progress') continue;
    if (marker) add(`.baseline/P-${nn}/${name}`, `leftover session marker of a task that is not In Progress (fix: wb.js refresh P-${nn})`);
    else add(`.baseline/P-${nn}/${name}/`, `leftover snapshot of a task that is not In Progress (fix: wb.js refresh P-${nn})`);
  }
}

module.exports = { check };
