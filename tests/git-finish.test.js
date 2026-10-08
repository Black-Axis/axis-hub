// Checks `git finish` (.githooks/finish.js) against throwaway repositories:
// a local bare repository stands in for GitHub, so merges are detected by the
// "upstream deleted + contained in main" rule (no gh CLI involved).
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { finish, hasWork, githubRepo } = require('../.githooks/finish.js');

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

// A clone of a bare "remote" with main pushed, plus a helper to run git in it.
function setup() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'finish-'));
  const remote = path.join(base, 'remote.git');
  const dir = path.join(base, 'work');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  execFileSync('git', ['clone', '-q', remote, dir], { stdio: 'ignore' });
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git('switch', '-q', '-c', 'main');
  git('commit', '-q', '--allow-empty', '-m', 'init');
  git('push', '-q', '-u', 'origin', 'main');
  return { dir, git };
}

// Creates `branch` with one commit and pushes it.
function work(git, branch) {
  git('switch', '-q', '-c', branch, 'main');
  git('commit', '-q', '--allow-empty', '-m', `work on ${branch}`);
  git('push', '-q', '-u', 'origin', branch);
}

// Merges `branch` into main on the remote and deletes it there, as GitHub does; local main stays behind.
function mergeOnRemote(git, branch) {
  const current = git('symbolic-ref', '--short', 'HEAD');
  git('switch', '-q', 'main');
  const before = git('rev-parse', 'main');
  git('merge', '-q', '--no-ff', '-m', `Merge ${branch}`, branch);
  git('push', '-q', 'origin', 'main', `:${branch}`);
  git('reset', '-q', '--hard', before);
  git('switch', '-q', current);
}

test('githubRepo parses GitHub URLs only', () => {
  assert.strictEqual(githubRepo('https://github.com/Black-Axis/axis-hub.git'), 'Black-Axis/axis-hub');
  assert.strictEqual(githubRepo('git@github.com:Black-Axis/axis-hub.git'), 'Black-Axis/axis-hub');
  assert.strictEqual(githubRepo('https://example.com/a/b.git'), null);
});

test('merged branch: switch to main, pull, delete the branch', () => {
  const { dir, git } = setup();
  work(git, 'feat/x');
  mergeOnRemote(git, 'feat/x');
  const result = finish(dir);
  assert.ok(result.ok, result.lines.join(' '));
  assert.strictEqual(git('symbolic-ref', '--short', 'HEAD'), 'main');
  assert.strictEqual(git('rev-parse', 'main'), git('rev-parse', 'origin/main'));
  assert.strictEqual(git('branch', '--list', 'feat/x'), '');
});

test('branch not merged yet: nothing changes', () => {
  const { dir, git } = setup();
  work(git, 'feat/y');
  const result = finish(dir);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.changed, false);
  assert.strictEqual(git('symbolic-ref', '--short', 'HEAD'), 'feat/y');
});

test('new branch without commits is kept', () => {
  const { dir, git } = setup();
  git('switch', '-q', '-c', 'feat/new');
  assert.strictEqual(finish(dir).ok, false);
  assert.strictEqual(git('symbolic-ref', '--short', 'HEAD'), 'feat/new');
});

test('uncommitted changes: nothing changes', () => {
  const { dir, git } = setup();
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  git('add', 'a.txt');
  git('commit', '-q', '-m', 'a');
  git('push', '-q');
  work(git, 'feat/z');
  mergeOnRemote(git, 'feat/z');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed');
  const result = finish(dir);
  assert.strictEqual(result.ok, false);
  assert.match(result.lines[0], /Uncommitted/);
  assert.strictEqual(git('symbolic-ref', '--short', 'HEAD'), 'feat/z');
});

test('on main: pulls and deletes other merged branches, keeps unmerged ones', () => {
  const { dir, git } = setup();
  work(git, 'fix/done');
  mergeOnRemote(git, 'fix/done');
  work(git, 'fix/open');
  git('switch', '-q', 'main');
  const result = finish(dir);
  assert.ok(result.ok, result.lines.join(' '));
  assert.strictEqual(git('branch', '--list', 'fix/done'), '');
  assert.notStrictEqual(git('branch', '--list', 'fix/open'), '');
  assert.strictEqual(git('rev-parse', 'main'), git('rev-parse', 'origin/main'));
});

test('hasWork: false only on main with no other local branch', () => {
  const { dir, git } = setup();
  assert.strictEqual(hasWork(dir), false);
  git('branch', 'fix/other');
  assert.strictEqual(hasWork(dir), true);
  git('branch', '-D', 'fix/other');
  git('switch', '-q', '-c', 'feat/x');
  assert.strictEqual(hasWork(dir), true);
});

test('session start hook: no fetch on clean main, finishes on a merged branch', () => {
  const { dir, git } = setup();
  const hook = path.resolve(__dirname, '..', '.claude', 'hooks', 'finish-on-start.js');
  const runHook = () => execFileSync('node', [hook], { input: '{}', env: { ...env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8' });
  // The remote's main is one commit ahead; a fetch would pull it and report it.
  git('commit', '-q', '--allow-empty', '-m', 'ahead');
  git('push', '-q');
  git('reset', '-q', '--hard', 'HEAD~1');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  assert.strictEqual(runHook(), '');
  assert.notStrictEqual(git('rev-parse', 'main'), git('ls-remote', 'origin', 'main').split(/\s/)[0]);
  git('pull', '-q', '--ff-only');
  work(git, 'feat/x');
  mergeOnRemote(git, 'feat/x');
  assert.match(runHook(), /Deleted merged branch feat\/x/);
});
