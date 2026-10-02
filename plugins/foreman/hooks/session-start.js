#!/usr/bin/env node
// Foreman SessionStart hook: summarizes workbench/ state (active plans,
// contracts awaiting approval, next ready tasks, open interviews). Silent when the project
// has no workbench/ folder. Never fails the session: all errors exit 0.

const fs = require('fs');
const path = require('path');

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

// Returns cells of every Markdown table row under `## <heading>`. Cells are split
// on unescaped `|` only; `\|` inside a cell is a literal pipe.
function tableRows(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) return [];
  const rows = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || /^\|[\s|:-]+\|$/.test(line)) continue;
    rows.push(line.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')));
  }
  return rows.slice(1); // drop header row
}

function field(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text && text.match(new RegExp(`^- ${escaped}:\\s*(.+)$`, 'mi'));
  return m ? m[1].trim() : '';
}

function taskIds(cell) {
  return (cell.match(/TASK-\d+/g) || []);
}

function findFile(dir, prefix) {
  const name = listDir(dir).find((f) => f.startsWith(prefix) && f.endsWith('.md'));
  return name ? path.join(dir, name) : null;
}

function main() {
  const input = readStdin();
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const wb = path.join(root, 'workbench');
  if (!fs.existsSync(path.join(wb, 'INDEX.md'))) return;

  const lines = [];
  const index = readText(path.join(wb, 'INDEX.md')) || '';
  // `Workbench` was called `Git` before 1.3.0; either line counts. `Version control`
  // is not required: commands detect and add it when missing.
  const missing = [['Workbench', 'Git'], ['Output'], ['Fix rounds'], ['CLAUDE.md']]
    .filter((names) => !names.some((name) => field(index, name)))
    .map((names) => names[0]);
  if (missing.length) {
    lines.push(`Settings not set (${missing.join(', ')}) — run /foreman:settings`);
  }

  const trackingDir = path.join(wb, 'tracking');

  for (const file of listDir(trackingDir).sort()) {
    const m = file.match(/^TRK-(\d+)-(.+)\.md$/);
    if (!m) continue;
    const [, nn, slug] = m;
    const trk = readText(path.join(trackingDir, file)) || '';
    const planStatus = field(trk, 'Plan Status') || 'Not Started';
    if (/^(done|canceled)$/i.test(planStatus)) continue;

    const contract = readText(findFile(path.join(wb, 'contracts'), `CONT-${nn}-`) || '');
    const contractStatus = field(contract, 'Status') || 'Unknown';

    const tasks = tableRows(trk, 'Tasks').map((c) => ({
      id: taskIds(c[0])[0],
      title: c[1] || '',
      status: c[2] || '',
    })).filter((t) => t.id);

    const plan = readText(findFile(path.join(wb, 'plans'), `P-${nn}-`) || '') || '';
    const deps = {};
    for (const c of tableRows(plan, 'Task Breakdown')) {
      const id = taskIds(c[0])[0];
      if (id) deps[id] = taskIds(c[2] || '');
    }

    const statusOf = Object.fromEntries(tasks.map((t) => [t.id, t.status.toLowerCase()]));
    const active = tasks.filter((t) => /in progress/i.test(t.status));
    const ready = tasks.filter((t) => /not started/i.test(t.status)
      && (deps[t.id] || []).every((d) => statusOf[d] === 'done'));
    const done = tasks.filter((t) => /done/i.test(t.status)).length;
    const total = tasks.filter((t) => !/canceled/i.test(t.status)).length;

    let line = `P-${nn} ${slug} — Plan: ${planStatus}, Contract: ${contractStatus}, ${done}/${total} Done`;
    if (!/^approved$/i.test(contractStatus)) line += `. Needs /foreman:approve P-${nn}`;
    else if (/^hold$/i.test(planStatus)) line += `. On Hold — /foreman:resume P-${nn}`;
    else if (total > 0 && done === total) line += `. All tasks Done — /foreman:close P-${nn}`;
    else {
      if (active.length) line += `. In Progress: ${active.map((t) => t.id).join(', ')}`;
      if (ready.length) line += `. Ready: ${ready.map((t) => `${t.id} (${t.title})`).join(', ')}`;
    }
    lines.push(line);
  }

  const interviewDir = path.join(wb, 'interviews');
  for (const file of listDir(interviewDir).sort()) {
    const m = file.match(/^INT-(\d+)-(.+)\.md$/);
    if (!m) continue;
    const text = readText(path.join(interviewDir, file)) || '';
    if (!/^in progress$/i.test(field(text, 'Status'))) continue;
    const topics = tableRows(text, 'Coverage');
    const covered = topics.filter((c) => /^(covered|n\/a)$/i.test(c[1] || '')).length;
    lines.push(`INT-${m[1]} ${m[2]} — Interview in progress, ${covered}/${topics.length} topics. Continue: /foreman:interview INT-${m[1]}`);
  }

  if (!lines.length) return;
  const summary = `Foreman — active work in workbench/:\n- ${lines.join('\n- ')}`;
  process.stdout.write(JSON.stringify({
    systemMessage: summary,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `${summary}\nUse the /foreman:* commands to continue; run a task with /foreman:run P-NN TASK-TT.`,
    },
  }));
}

try {
  main();
} catch {
  // Never block the session.
}
process.exit(0);
