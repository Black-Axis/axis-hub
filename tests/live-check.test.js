// Checks scripts/live-check.js without a paid run: arguments, the claude call,
// the summary, and the scratch project (outside the repository).
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseArgs, claudeArgs, summarize, buildProject, ROOT } = require('../scripts/live-check.js');

const repo = path.resolve(__dirname, '..');

test('parseArgs: defaults, options, and errors', () => {
  const o = parseArgs(['status-ok', '--prompt-file', 'p.md']);
  assert.deepStrictEqual([o.check, o.promptFile, o.plugin, o.fixture, o.model, o.budget, o.cont], ['status-ok', 'p.md', 'foreman', 'notes-api', 'haiku', '0.10', false]);
  const s = parseArgs(['run', '--prompt-file', 'p.md', '--model', 'sonnet', '--budget', '0.5', '--fixture', 'none', '--continue']);
  assert.deepStrictEqual([s.model, s.budget, s.fixture, s.cont], ['sonnet', '0.5', 'none', true]);
  assert.match(parseArgs(['--prompt-file', 'p.md']).error, /missing check name/);
  assert.match(parseArgs(['x']).error, /missing --prompt-file/);
  assert.match(parseArgs(['x', '--prompt-file', 'p', '--budget', 'lots']).error, /dollar amount/);
  assert.match(parseArgs(['x', '--prompt-file']).error, /needs a value/);
  assert.match(parseArgs(['x', 'y', '--prompt-file', 'p']).error, /unknown argument: y/);
  assert.match(parseArgs(['X Y', '--prompt-file', 'p']).error, /unknown argument/);
});

test('claudeArgs: JSON output, the repo plugin, model, budget cap', () => {
  const args = claudeArgs(parseArgs(['c', '--prompt-file', 'p', '--continue']), '/foreman:status');
  assert.deepStrictEqual(args.slice(0, 4), ['-p', '/foreman:status', '--output-format', 'json']);
  assert.strictEqual(args[args.indexOf('--plugin-dir') + 1], path.join(repo, 'plugins', 'foreman'));
  assert.strictEqual(args[args.indexOf('--model') + 1], 'haiku');
  assert.strictEqual(args[args.indexOf('--max-budget-usd') + 1], '0.10');
  assert.ok(args.includes('--continue'));
});

test('summarize: one head line, denials, short result', () => {
  const lines = summarize('c', {
    type: 'result', subtype: 'success', is_error: false, num_turns: 3, total_cost_usd: 0.01234,
    result: `line one\n\nline two ${'x'.repeat(500)}`,
    permission_denials: [{ tool_name: 'Bash', tool_input: { command: 'node wb.js check' } }],
  });
  assert.strictEqual(lines[0], 'c: success - turns 3 - $0.0123 - denials 1');
  assert.strictEqual(lines[1], 'denied: Bash {"command":"node wb.js check"}');
  assert.match(lines[2], /^result: line one line two x+\.\.\.$/);
  assert.ok(lines[2].length < 420);
  assert.strictEqual(summarize('e', { subtype: 'error_max_budget_usd', is_error: true })[0], 'e: error_max_budget_usd (error) - turns ? - $? - denials 0');
});

test('scratch project: outside the repository, fixture as a fresh git repo with baselines', () => {
  const rel = path.relative(repo, ROOT);
  assert.ok(rel.startsWith('..') || path.isAbsolute(rel), 'ROOT outside the repository'); // absolute: another drive
  assert.ok(ROOT.startsWith(os.tmpdir()));
  const dir = path.join(ROOT, 'unit-test');
  buildProject(dir, { plugin: 'foreman', fixture: 'notes-api' });
  try {
    assert.ok(fs.existsSync(path.join(dir, 'workbench', 'INDEX.md')));
    const log = execFileSync('git', ['log', '--format=%s'], { cwd: dir, encoding: 'utf8' });
    assert.match(log, /fixture/);
    assert.strictEqual(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }), '');
    const grep = (() => { try { return execFileSync('git', ['grep', '-l', 'E2E_BASELINE'], { cwd: dir, encoding: 'utf8' }); } catch { return ''; } })();
    assert.strictEqual(grep, '', 'no E2E_BASELINE left');
    buildProject(dir, { plugin: 'foreman', fixture: 'none' });
    assert.deepStrictEqual(fs.readdirSync(dir), ['.git'], 'rebuilt empty');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('settings never allow live-check.js: each paid run asks', () => {
  const allow = JSON.parse(fs.readFileSync(path.join(repo, '.claude', 'settings.json'), 'utf8')).permissions.allow;
  assert.ok(!allow.some((r) => r.includes('live-check')));
});
