// Checks the branch rules (.githooks/guard.js) and the Claude Code hook that
// applies them to Claude's git commands (.claude/hooks/guard-git.js).
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const guard = require('../.githooks/guard.js');
const { segments, check } = require('../.claude/hooks/guard-git.js');

const repo = path.resolve(__dirname, '..');
const hook = path.join(repo, '.claude', 'hooks', 'guard-git.js');

// Temporary git repo on `main` with one commit, a tag, a GitHub remote, and a non-GitHub remote.
function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  git('tag', 'v1.0.0');
  git('remote', 'add', 'origin', 'https://github.com/Black-Axis/axis-hub.git');
  git('remote', 'add', 'backup', 'https://example.com/backup.git');
  return dir;
}

test('branch names', () => {
  for (const ok of ['feat/foreman-bug-command', 'fix/a', 'ci/protect-main', 'docs/readme-2']) {
    assert.strictEqual(guard.checkBranchName(ok), null, ok);
  }
  for (const bad of ['main', 'feature/x', 'feat/Bad_Name', 'feat/', 'my-branch', 'feat/a--b']) {
    assert.ok(guard.checkBranchName(bad), bad);
  }
});

test('commit refused on main, allowed on a named branch or detached HEAD', () => {
  assert.match(guard.checkCommit('main'), /not allowed/);
  assert.strictEqual(guard.checkCommit('feat/x'), null);
  assert.strictEqual(guard.checkCommit(null), null);
});

test('push to main refused on GitHub only; tags allowed', () => {
  const gh = 'git@github.com:Black-Axis/axis-hub.git';
  assert.strictEqual(guard.checkPush(gh, [{ remoteRef: 'refs/heads/main', localSha: 'abc' }]).length, 1);
  assert.strictEqual(guard.checkPush(gh, [{ remoteRef: 'refs/heads/feat/x', localSha: 'abc' }]).length, 0);
  assert.strictEqual(guard.checkPush(gh, [{ remoteRef: 'refs/heads/wip', localSha: 'abc' }]).length, 1);
  assert.strictEqual(guard.checkPush(gh, [{ remoteRef: 'refs/tags/v1.0.0', localSha: 'abc' }]).length, 0);
  assert.strictEqual(guard.checkPush('https://example.com/x.git', [{ remoteRef: 'refs/heads/main', localSha: 'abc' }]).length, 0);
});

test('command splitting honors quotes and operators', () => {
  assert.deepStrictEqual(segments('git add . && git commit -m "a && b"; git push'),
    [['git', 'add', '.'], ['git', 'commit', '-m', 'a && b'], ['git', 'push']]);
});

test('Claude hook: commit and push on main', () => {
  const dir = tempRepo();
  assert.ok(check('git commit -m x', dir).length, 'commit on main');
  assert.ok(check('git push origin main', dir).length, 'push main to GitHub');
  assert.ok(check('git push', dir).length, 'bare push from main');
  assert.ok(check('git push origin HEAD', dir).length, 'push HEAD from main');
  assert.ok(check('git push origin feat/x:main', dir).length, 'refspec to main');
  assert.ok(check('git push --all origin', dir).length, 'push all');
  assert.strictEqual(check('git push backup main', dir).length, 0, 'non-GitHub remote');
  assert.strictEqual(check('git push origin v1.0.0', dir).length, 0, 'tag');
  assert.strictEqual(check('git push --tags origin', dir).length, 0, 'all tags');
  assert.strictEqual(check('git status && git log', dir).length, 0, 'read-only');
});

test('Claude hook: branch creation', () => {
  const dir = tempRepo();
  assert.strictEqual(check('git switch -c feat/x && git commit -m y && git push -u origin feat/x', dir).length, 0);
  assert.strictEqual(check('git checkout -b fix/y; git commit -m z', dir).length, 0);
  assert.ok(check('git switch -c my-branch', dir).length, 'bad name');
  assert.ok(check('git branch wip', dir).length, 'bad name via branch');
  assert.ok(check('git switch -c feat/x && git switch main && git commit -m y', dir).length, 'back on main');
});

test('Claude hook: deny output and silent otherwise', () => {
  const dir = tempRepo();
  const run = (command) => spawnSync('node', [hook], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: dir }), encoding: 'utf8',
  });
  const denied = run('git commit -m x');
  assert.strictEqual(denied.status, 0);
  const out = JSON.parse(denied.stdout);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /git switch -c/);
  const allowed = run('npm test');
  assert.strictEqual(allowed.status, 0);
  assert.strictEqual(allowed.stdout, '');
});
