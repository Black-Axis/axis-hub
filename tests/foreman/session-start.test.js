// Tests for plugins/foreman/hooks/session-start.js.
// Fixture: examples/foreman/workbench (copied to a temp dir per test).
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..');
const hook = path.join(repo, 'plugins', 'foreman', 'hooks', 'session-start.js');
const fixture = path.join(repo, 'examples', 'foreman', 'workbench');

function project(withWorkbench = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-'));
  if (withWorkbench) fs.cpSync(fixture, path.join(dir, 'workbench'), { recursive: true });
  return dir;
}

function run(dir) {
  const res = spawnSync(process.execPath, [hook], {
    input: '{}',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  });
  assert.strictEqual(res.status, 0, 'hook must always exit 0');
  return res.stdout ? JSON.parse(res.stdout) : null;
}

function edit(dir, rel, from, to) {
  const file = path.join(dir, 'workbench', rel);
  // Normalize line endings: on Windows, git may check the sample out with CRLF.
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const found = typeof from === 'string' ? text.includes(from) : from.test(text);
  assert.ok(found, `${rel} does not contain ${from}`);
  fs.writeFileSync(file, text.replace(from, to));
}

const TRK = 'tracking/TRK-01-health-endpoint.md';

test('silent without workbench', () => {
  assert.strictEqual(run(project(false)), null);
});

test('summarizes the example plan with the next ready task', () => {
  const out = run(project());
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.systemMessage, /P-01 health-endpoint/);
  assert.match(out.systemMessage, /Contract: Approved/);
  assert.match(out.systemMessage, /1\/2 Done/);
  assert.match(out.systemMessage, /Ready: TASK-02/);
  assert.doesNotMatch(out.systemMessage, /Settings not set/);
});

test('respects Depends On: dependent task is not ready', () => {
  const dir = project();
  edit(dir, TRK, /\| Add health route \| Done \|/, '| Add health route | Not Started |');
  const out = run(dir);
  assert.match(out.systemMessage, /Ready: TASK-01/);
  assert.doesNotMatch(out.systemMessage, /TASK-02 \(/);
});

test('asks for approval when the contract is not approved', () => {
  const dir = project();
  edit(dir, 'contracts/CONT-01-health-endpoint.md', '- Status: Approved', '- Status: Draft');
  assert.match(run(dir).systemMessage, /Needs \/foreman:approve P-01/);
});

test('points to close when all tasks are Done', () => {
  const dir = project();
  edit(dir, TRK, /\| Add health route tests \| Not Started \|/, '| Add health route tests | Done |');
  assert.match(run(dir).systemMessage, /All tasks Done — \/foreman:close P-01/);
});

test('points to resume when the plan is on Hold', () => {
  const dir = project();
  edit(dir, TRK, '- Plan Status: In Progress', '- Plan Status: Hold');
  assert.match(run(dir).systemMessage, /On Hold — \/foreman:resume P-01/);
});

test('hides Done and Canceled plans', () => {
  const dir = project();
  edit(dir, TRK, '- Plan Status: In Progress', '- Plan Status: Done');
  assert.strictEqual(run(dir), null);
});

test('reports missing settings', () => {
  const dir = project();
  edit(dir, 'INDEX.md', '- Fix rounds: 4\n', '');
  assert.match(run(dir).systemMessage, /Settings not set \(Fix rounds\)/);
});

test('reports missing CLAUDE.md setting', () => {
  const dir = project();
  edit(dir, 'INDEX.md', '- CLAUDE.md: no\n', '');
  assert.match(run(dir).systemMessage, /Settings not set \(CLAUDE\.md\)/);
});

function interview(dir, status) {
  const template = fs.readFileSync(path.join(repo, 'plugins', 'foreman', 'templates', 'interview.md'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace('- Status: {{In Progress | Done | Canceled}}', `- Status: ${status}`)
    .replace('| {{Open / Covered / N/A}} |', '| Covered |')
    .replace('| Main flows | Open |', '| Main flows | N/A |');
  fs.mkdirSync(path.join(dir, 'workbench', 'interviews'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'workbench', 'interviews', 'INT-02-dark-mode.md'), template);
}

test('shows an interview in progress with covered topics', () => {
  const dir = project();
  interview(dir, 'In Progress');
  assert.match(run(dir).systemMessage, /INT-02 dark-mode — Interview in progress, 2\/13 topics\. Continue: \/foreman:interview INT-02/);
});

test('hides finished and canceled interviews', () => {
  for (const status of ['Done', 'Canceled']) {
    const dir = project();
    interview(dir, status);
    assert.doesNotMatch(run(dir).systemMessage, /INT-02/, status);
  }
});

test('survives a broken tracking file', () => {
  const dir = project();
  fs.writeFileSync(path.join(dir, 'workbench', TRK), '| broken');
  run(dir); // must not throw or exit non-zero
});
