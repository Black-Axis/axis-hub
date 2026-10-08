// Shared workbench/ readers for foreman's Node scripts (hooks/session-start.js,
// scripts/wb.js). No dependencies.

const fs = require('fs');
const path = require('path');

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

// Splits one Markdown table row into cells. Cells are split on unescaped `|` only;
// `\|` inside a cell is a literal pipe.
function cells(line) {
  return line.trim().slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

// Returns the line index range [header, end) of the table under `## <heading>`:
// `rows` holds the line index of every data row (header and separator excluded).
function tableAt(lines, heading) {
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) return null;
  const rows = [];
  let header = -1;
  let last = -1;
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) {
      if (header !== -1 && line) break;
      continue;
    }
    last = i;
    if (header === -1) header = i;
    else if (!/^\|[\s|:-]+\|$/.test(line)) rows.push(i);
  }
  return header === -1 ? { start, header: -1, rows, last: start } : { start, header, rows, last };
}

// Returns cells of every data row of the table under `## <heading>`.
function tableRows(text, heading) {
  const lines = text.split(/\r?\n/);
  const t = tableAt(lines, heading);
  return t ? t.rows.map((i) => cells(lines[i])) : [];
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

module.exports = { readText, listDir, cells, tableAt, tableRows, field, taskIds, findFile };
