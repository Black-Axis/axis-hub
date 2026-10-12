// Checks the axis-docs-sync hook (.claude/hooks/docs-sync-guard.js): Edit only on
// the kept docs, Bash only for read-only git, one command.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const script = path.resolve(__dirname, '..', '.claude', 'hooks', 'docs-sync-guard.js');
const { decide } = require(script);
const root = path.resolve(__dirname, '..');

const edit = (file_path) => decide({ tool_name: 'Edit', tool_input: { file_path } }, root);
const bash = (command) => decide({ tool_name: 'Bash', tool_input: { command } }, root);

test('Edit: only the kept docs', () => {
  for (const f of ['CLAUDE.md', 'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'e2e/CLAUDE.md', 'e2e/README.md', '.claude/rules/foreman.md', 'plugins/foreman/README.md', path.join(root, 'plugins', 'foreman', 'README.md')]) {
    assert.strictEqual(edit(f), null, f);
  }
  for (const f of ['CHANGELOG.md', 'plugins/foreman/CHANGELOG.md', 'plugins/foreman/commands/run.md', 'plugins/foreman/templates/plan.md', 'scripts/check-all.js', 'e2e/foreman/CLAUDE.md', 'docs/CLAUDE.md', '../CLAUDE.md', path.join(root, '..', 'README.md')]) {
    assert.match(edit(f) || '', /edits only/, f);
  }
});

test('Bash: only read-only git, one command', () => {
  for (const c of ['git status --short', 'git diff main --stat', 'git diff main -- CLAUDE.md', 'git log --oneline main..HEAD']) {
    assert.strictEqual(bash(c), null, c);
  }
  for (const c of ['git commit -m x', 'git diff --no-index ../a ../b', 'git diff | head', 'node scripts/check-all.js', 5]) {
    assert.match(bash(c) || '', /runs only read-only/, String(c));
  }
});

test('other tools pass; the script prints a deny decision and survives bad input', () => {
  assert.strictEqual(decide({ tool_name: 'Read', tool_input: { file_path: 'x' } }, root), null);
  assert.strictEqual(decide(null, root), null);
  const env = { ...process.env, CLAUDE_PROJECT_DIR: root };
  const out = execFileSync('node', [script], { input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'CHANGELOG.md' } }), env, encoding: 'utf8' });
  assert.strictEqual(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny');
  for (const input of ['', 'not json', 'null']) {
    assert.strictEqual(execFileSync('node', [script], { input, env, encoding: 'utf8' }), '', input);
  }
});
