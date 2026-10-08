// Tests for plugins/foreman/scripts/wb.js (state script, #32).
// Fixture: examples/foreman/workbench (copied to a temp dir per test).
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..');
const script = path.join(repo, 'plugins', 'foreman', 'scripts', 'wb.js');
const fixture = path.join(repo, 'examples', 'foreman', 'workbench');
const TRK = path.join('workbench', 'tracking', 'TRK-01-health-endpoint.md');

function project(withWorkbench = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-wb-'));
  if (withWorkbench) fs.cpSync(fixture, path.join(dir, 'workbench'), { recursive: true });
  return dir;
}

function wb(dir, ...args) {
  const res = spawnSync(process.execPath, [script, ...args], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8' });
  return { code: res.status, out: res.stdout.trim() };
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function edit(dir, rel, from, to) {
  const file = path.join(dir, rel);
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(from.test(text), `${rel} does not match ${from}`);
  fs.writeFileSync(file, text.replace(from, to));
}

test('overview, ready, and next-number on the example', () => {
  const dir = project();
  assert.deepStrictEqual(wb(dir, 'overview'), { code: 0, out: 'P-01 health-endpoint | Plan: In Progress | Contract: Approved | 1/2 Done | ready: TASK-02 (Add health route tests)' });
  assert.deepStrictEqual(wb(dir, 'ready'), { code: 0, out: 'P-01 TASK-02 Add health route tests' });
  assert.deepStrictEqual(wb(dir, 'ready', 'P-01'), { code: 0, out: 'P-01 TASK-02 Add health route tests' });
  assert.deepStrictEqual(wb(dir, 'next-number'), { code: 0, out: '02' });
  fs.mkdirSync(path.join(dir, 'workbench', 'interviews'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'workbench', 'interviews', 'INT-07-dark-mode.md'), '# x\n');
  assert.strictEqual(wb(dir, 'next-number').out, '08', 'interviews reserve numbers');
});

test('status: one call writes the task row, History, and INDEX Progress', () => {
  const dir = project();
  const r = wb(dir, 'status', 'P-01', 'TASK-02', 'In', 'Progress', '--by', 'Main agent', '--reason', '/foreman:run', '--note', 'worker running');
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(r.out, 'TASK-02: Not Started -> In Progress\nINDEX P-01 Progress: 1/2 Done, TASK-02 In Progress');
  const trk = read(dir, TRK);
  assert.match(trk, new RegExp(`\\| Add health route tests \\| In Progress \\| ${today()} \\| worker running \\|`));
  assert.match(trk, new RegExp(`\\| ${today()} \\| TASK-02 \\| Not Started -> In Progress \\| Main agent \\| /foreman:run \\|\\r?\\n\\r?\\n## Activity`), 'History row appended at the end of History');
  assert.match(read(dir, 'workbench/INDEX.md'), /\| Approved \| 1\/2 Done, TASK-02 In Progress \|/);

  const done = wb(dir, 'status', 'P-01', 'TASK-02', 'done', '--by', 'Main agent', '--reason', 'verified; ran npm test | tail', '--note', 'verified; 0 fix rounds');
  assert.strictEqual(done.code, 0, done.out);
  assert.match(read(dir, TRK), /\| Main agent \| verified; ran npm test \\\| tail \|/, 'pipes in cells are escaped');
  assert.match(read(dir, 'workbench/INDEX.md'), /\| Approved \| 2\/2 Done \|/);
  assert.match(wb(dir, 'overview').out, /all tasks Done - \/foreman:close P-01/);
  wb(dir, 'status', 'P-01', 'TASK-02', 'Hold', '--by', 'User', '--reason', 'r');
  assert.match(read(dir, TRK), /\| Add health route tests \| Hold \| \d{4}-\d\d-\d\d \|  \|/, 'no --note clears the old note');
});

test('status: derived Plan Status follows the tasks and is logged', () => {
  const dir = project();
  edit(dir, TRK, /\| Add health route \| Done \|/, '| Add health route | Not Started |');
  edit(dir, TRK, /- Plan Status: In Progress/, '- Plan Status: Not Started');
  const r = wb(dir, 'status', 'P-01', 'TASK-01', 'In Progress', '--by', 'User', '--reason', 'started');
  assert.match(r.out, /P-01: Not Started -> In Progress \(derived\)/);
  assert.match(read(dir, TRK), /- Plan Status: In Progress/);
  assert.match(read(dir, TRK), /\| P-01 \| Not Started -> In Progress \| Main agent \| first task started \|/);
});

test('status: plan target, Hold stays explicit', () => {
  const dir = project();
  assert.strictEqual(wb(dir, 'status', 'P-01', 'Hold', '--by', 'User', '--reason', 'waiting for API keys').out, 'P-01: In Progress -> Hold');
  assert.match(read(dir, TRK), /- Plan Status: Hold/);
  assert.match(wb(dir, 'overview').out, /on Hold - \/foreman:resume P-01/);
  assert.strictEqual(wb(dir, 'ready').out, 'none', 'no ready tasks while the plan is on Hold');
  wb(dir, 'status', 'P-01', 'TASK-02', 'Canceled', '--by', 'User', '--reason', 'obsolete');
  assert.match(read(dir, TRK), /- Plan Status: Hold/, 'a task change does not override Hold');
  assert.match(read(dir, 'workbench/INDEX.md'), /\| 1\/1 Done \|/, 'Canceled tasks are not counted');
});

test('status: bad input writes nothing', () => {
  const dir = project();
  const before = read(dir, TRK);
  for (const args of [
    ['P-01', 'TASK-02', 'Started', '--by', 'User', '--reason', 'x'],
    ['P-01', 'TASK-02', 'Done', '--by', 'Worker', '--reason', 'x'],
    ['P-01', 'TASK-02', 'Done', '--by', 'User'],
    ['P-01', 'TASK-09', 'Done', '--by', 'User', '--reason', 'x'],
    ['P-01', 'TASK-01', 'Done', '--by', 'User', '--reason', 'x'],
    ['P-07', 'TASK-01', 'Done', '--by', 'User', '--reason', 'x'],
    ['01', 'Done', '--by', 'User', '--reason', 'x'],
  ]) {
    const r = wb(dir, 'status', ...args);
    assert.strictEqual(r.code, 1, args.join(' '));
    assert.match(r.out, /^ERROR: /, args.join(' '));
  }
  assert.strictEqual(read(dir, TRK), before);
  assert.match(wb(dir, 'nope').out, /^ERROR: unknown command/);
});

test('refresh: fixes INDEX Progress and Contract Status from the files', () => {
  const dir = project();
  edit(dir, 'workbench/INDEX.md', /\| Approved \| 1\/2 Done \|/, '| Draft | 0/2 Done |');
  const r = wb(dir, 'refresh', 'P-01');
  assert.strictEqual(r.out, 'INDEX P-01 Progress: 1/2 Done\nINDEX P-01 Contract Status: Approved');
  assert.match(read(dir, 'workbench/INDEX.md'), /\| Approved \| 1\/2 Done \|/);
  assert.strictEqual(wb(dir, 'refresh', 'P-01').out, 'P-01: up to date');
});

test('keeps CRLF line endings', () => {
  const dir = project();
  const file = path.join(dir, TRK);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));
  wb(dir, 'status', 'P-01', 'TASK-02', 'In Progress', '--by', 'User', '--reason', 'x');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(!/[^\r]\n/.test(text), 'every line ends with CRLF');
});

test('without workbench/: a clear error', () => {
  const r = wb(project(false), 'overview');
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /^ERROR: workbench\/INDEX\.md not found/);
});
