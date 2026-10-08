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
  assert.strictEqual(check('git tag -a v2.0.0 -m "v2.0.0" && git push origin v2.0.0', dir).length, 0, 'tag created in the same command');
  assert.strictEqual(check('git push origin refs/tags/v3.0.0', dir).length, 0, 'full tag ref');
  assert.ok(check('git tag -d v2.0.0 && git push origin v2.0.0', dir).length, 'deleted tag is not a new tag');
  assert.strictEqual(check('git status && git log', dir).length, 0, 'read-only');
  assert.strictEqual(check('git push -u origin feat/x 2>&1 | tail -5', dir).length, 0, 'redirect and pipe');
  assert.strictEqual(check('git push origin feat/x > out.txt 2> err.txt', dir).length, 0, 'redirect with space');
  assert.ok(check('git push origin main 2>/dev/null', dir).length, 'redirect does not hide main');
});

test('Claude hook: heredoc and here-string bodies are data, not commands', () => {
  const dir = tempRepo();
  const heredoc = "cat > pr.md <<'EOF'\n- `git tag x && git push origin main` was denied\nEOF\ngh pr create --body-file pr.md";
  assert.strictEqual(check(heredoc, dir).length, 0, 'heredoc');
  const hereString = "git log -1 -m @'\ngit push origin main\n'@";
  assert.strictEqual(check(hereString, dir).length, 0, 'PowerShell here-string');
  assert.ok(check("cat > a <<EOF\nx\nEOF\ngit push origin main", dir).length, 'command after the heredoc is still checked');
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

test('Claude hook: merging pull requests is denied', () => {
  const dir = tempRepo();
  for (const cmd of [
    'gh pr merge 12 --squash',
    'gh pr merge --auto --merge',
    'gh.exe pr merge 5',
    'git push -u origin feat/x && gh pr merge',
    'gh api -X PUT repos/Black-Axis/axis-hub/pulls/12/merge',
    'gh api --method put /repos/o/r/pulls/3/merge -f merge_method=squash',
    "gh api graphql -f query='mutation { mergePullRequest(input:{pullRequestId:\"x\"}) { clientMutationId } }'",
    "gh api graphql -f query='mutation { enablePullRequestAutoMerge(input:{pullRequestId:\"x\"}) { clientMutationId } }'",
  ]) assert.match(check(cmd, dir).join(' '), /user reviews and merges/, cmd);
  for (const cmd of [
    'gh pr view 12 --json state',
    'gh pr create --title "x" --body "do not run gh pr merge"',
    'gh api repos/o/r/pulls/12/merge',
    "cat > pr.md <<'EOF'\ngh pr merge 12\nEOF\ngh pr create --body-file pr.md",
  ]) assert.strictEqual(check(cmd, dir).length, 0, cmd);
});

test('Claude hook: git -C checks that repository', () => {
  const onMain = tempRepo();
  const onBranch = tempRepo();
  execFileSync('git', ['switch', '-q', '-c', 'feat/x'], { cwd: onBranch });
  assert.strictEqual(check(`git -C "${onBranch}" commit -m y`, onMain).length, 0, 'other repo on a branch');
  assert.ok(check(`git -C "${onMain}" commit -m y`, onBranch).length, 'other repo on main');
  assert.ok(check(`git -C "${onMain}" push origin HEAD`, onBranch).length, 'push HEAD of the other repo');
  assert.strictEqual(check(`git -C "${onMain}" switch -c fix/z && git -C "${onMain}" commit -m y`, onBranch).length, 0, 'switch tracked per repo');
  assert.strictEqual(check(`git -C "${onMain}" switch -c fix/z && git commit -m y`, onBranch).length, 0, 'own repo untouched by the other');
  const rel = path.relative(path.dirname(onBranch), onBranch);
  assert.strictEqual(check(`git -C .. -C ${rel} commit -m y`, onMain).length, 0, 'relative -C chain');
});
