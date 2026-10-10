// Checks the axis-e2e-writer hook (.claude/hooks/e2e-writer-guard.js): edits only
// under e2e/ (not e2e/.work/), Bash only for e2e/run.js and read-only git.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const script = path.resolve(__dirname, '..', '.claude', 'hooks', 'e2e-writer-guard.js');
const { decide } = require(script);
const root = path.resolve(__dirname, '..');

const edit = (file_path) => decide({ tool_name: 'Edit', tool_input: { file_path } }, root);
const bash = (command) => decide({ tool_name: 'Bash', tool_input: { command } }, root);

test('Edit and Write: only files under e2e/, never e2e/.work/', () => {
  assert.strictEqual(edit('e2e/foreman/scenarios/01-lifecycle.js'), null);
  assert.strictEqual(edit(path.join(root, 'e2e', 'foreman', 'lib.js')), null);
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: 'e2e/foreman/scenarios/11-new.js' } }, root), null);
  for (const f of ['plugins/foreman/commands/run.md', 'e2e', 'e2e/../CLAUDE.md', 'e2e-other/x.js', path.join(root, '..', 'e2e', 'x.js')]) {
    assert.match(edit(f) || '', /only files under e2e\//, f);
  }
  assert.match(edit('e2e/.work/foreman/01/x.md') || '', /never edits e2e\/\.work/);
});

test('Bash: only e2e/run.js and read-only git diff / status, one command', () => {
  for (const c of ['node e2e/run.js', 'node e2e/run.js foreman', 'node e2e/run.js foreman 07-change', 'git diff', 'git diff --stat main', 'git status']) {
    assert.strictEqual(bash(c), null, c);
  }
  for (const c of ['cd e2e && node run.js', 'node e2e/run.js foreman; rm -rf x', 'node e2e/run.js > out.txt', 'git diff --output=x', 'git commit -m x', 'node scripts/check-all.js', 'rm e2e/x.js', 'git diff | tee x']) {
    assert.match(bash(c) || '', /runs only/, c);
  }
});

test('other tools pass; the script prints a deny decision', () => {
  assert.strictEqual(decide({ tool_name: 'Read', tool_input: { file_path: 'CLAUDE.md' } }, root), null);
  const out = execFileSync('node', [script], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'README.md' } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
  });
  assert.strictEqual(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny');
  const none = execFileSync('node', [script], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'node e2e/run.js' } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
  });
  assert.strictEqual(none, '');
});
