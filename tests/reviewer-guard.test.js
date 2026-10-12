// Checks the axis-reviewer hook (.claude/hooks/reviewer-guard.js): Bash only for
// read-only git, one command; other tools pass.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const script = path.resolve(__dirname, '..', '.claude', 'hooks', 'reviewer-guard.js');
const { decide } = require(script);
const bash = (command) => decide({ tool_name: 'Bash', tool_input: { command } });

test('Bash: only read-only git diff / log / show / status, one command', () => {
  for (const c of ['git status --short', 'git diff main --stat', 'git diff main -- CLAUDE.md', 'git log --oneline main..HEAD', 'git show HEAD:CLAUDE.md', 'git diff main --numstat']) {
    assert.strictEqual(bash(c), null, c);
  }
  for (const c of ['git commit -m x', 'git checkout main', 'git diff --output=x', 'git diff main | head', 'git diff && rm x', 'cd x && git diff', 'git log > out', 'node scripts/check-all.js', 'rm -rf e2e', 'git diff $(rm x)']) {
    assert.match(bash(c) || '', /runs only read-only/, c);
  }
});

test('other tools pass; the script prints a deny decision', () => {
  assert.strictEqual(decide({ tool_name: 'Read', tool_input: { file_path: 'CLAUDE.md' } }), null);
  const out = execFileSync('node', [script], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push' } }), encoding: 'utf8' });
  assert.strictEqual(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny');
  assert.strictEqual(execFileSync('node', [script], { input: '', encoding: 'utf8' }), '');
  assert.strictEqual(execFileSync('node', [script], { input: 'not json', encoding: 'utf8' }), '');
  assert.strictEqual(execFileSync('node', [script], { input: 'null', encoding: 'utf8' }), '');
  assert.match(bash(5) || '', /runs only read-only/);
  assert.match(bash('git diff --no-index ../x ../y') || '', /runs only read-only/);
});
