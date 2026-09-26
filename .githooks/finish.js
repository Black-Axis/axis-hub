#!/usr/bin/env node
// Cleans up after a pull request is merged: switches to main, pulls it, and
// deletes the local branches whose pull requests were merged (and their GitHub
// copy if it still exists). Run as `git finish` (see CONTRIBUTING.md); the
// Claude Code session start hook (.claude/hooks/finish-on-start.js) runs it too.
//
// A branch counts as merged only if its local tip is contained in the updated
// main, and either GitHub reports its pull request as MERGED (needs the gh CLI)
// or its upstream branch was deleted from the remote. Unmerged work is never
// deleted, and nothing happens while there are uncommitted changes.
'use strict';

const { execFileSync } = require('child_process');
const { PROTECTED } = require('./guard.js');

function run(cmd, args, cwd) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() };
  } catch (e) {
    return { ok: false, out: `${e.stderr || e.message}`.trim() };
  }
}

const git = (cwd, ...args) => run('git', args, cwd);

// "owner/repo" for a GitHub remote URL, or null.
function githubRepo(url) {
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(\.git)?\/?$/i.exec(url || '');
  return m ? `${m[1]}/${m[2]}` : null;
}

// The remote that holds main on GitHub (upstream of main, else the first GitHub remote, else origin).
function mainRemote(cwd) {
  const upstream = git(cwd, 'config', `branch.${PROTECTED}.remote`);
  if (upstream.ok && upstream.out) return upstream.out;
  const remotes = git(cwd, 'remote').out.split(/\r?\n/).filter(Boolean);
  return remotes.find((r) => githubRepo(git(cwd, 'remote', 'get-url', r).out)) || 'origin';
}

// Is `branch` merged? `tip` must already be contained in the updated main.
function isMerged(cwd, branch, repo) {
  if (repo) {
    const pr = run('gh', ['pr', 'view', branch, '-R', repo, '--json', 'state', '-q', '.state'], cwd);
    if (pr.ok) return pr.out === 'MERGED';
  }
  // No gh: the branch had an upstream that the remote no longer has.
  const upstream = git(cwd, 'config', `branch.${branch}.merge`);
  if (!upstream.ok) return false;
  return !git(cwd, 'rev-parse', '--verify', '-q', `refs/remotes/${git(cwd, 'config', `branch.${branch}.remote`).out}/${branch}`).ok;
}

// Returns { ok, changed, lines } describing what was done; `lines` are user-facing messages.
function finish(cwd) {
  const lines = [];
  const top = git(cwd, 'rev-parse', '--show-toplevel');
  if (!top.ok) return { ok: false, changed: false, lines: ['Not a git repository.'] };
  cwd = top.out;

  if (git(cwd, 'status', '--porcelain', '--untracked-files=no').out) {
    return { ok: false, changed: false, lines: ['Uncommitted changes: commit or stash them first. Nothing was changed.'] };
  }

  const remote = mainRemote(cwd);
  const repo = githubRepo(git(cwd, 'remote', 'get-url', remote).out);
  const fetched = git(cwd, 'fetch', '--prune', remote);
  if (!fetched.ok) return { ok: false, changed: false, lines: [`Could not fetch ${remote}: ${fetched.out}`] };

  const mainRef = `refs/remotes/${remote}/${PROTECTED}`;
  const current = git(cwd, 'symbolic-ref', '--short', '-q', 'HEAD').out || null;
  const branches = git(cwd, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').out
    .split(/\r?\n/).filter((b) => b && b !== PROTECTED);

  const merged = branches.filter((b) =>
    git(cwd, 'merge-base', '--is-ancestor', b, mainRef).ok &&
    git(cwd, 'rev-parse', b).out !== git(cwd, 'rev-parse', mainRef).out &&
    isMerged(cwd, b, repo));

  if (current && current !== PROTECTED && !merged.includes(current)) {
    return { ok: false, changed: false, lines: [`${current} is not merged yet (or has commits not in ${PROTECTED}). Nothing was changed.`] };
  }

  let changed = false;
  if (current !== PROTECTED) {
    const sw = git(cwd, 'switch', PROTECTED);
    if (!sw.ok) return { ok: false, changed: false, lines: [`Could not switch to ${PROTECTED}: ${sw.out}`] };
    lines.push(`Switched to ${PROTECTED}.`);
    changed = true;
  }
  const pull = git(cwd, 'merge', '--ff-only', mainRef);
  if (!pull.ok) return { ok: false, changed, lines: [...lines, `Could not update ${PROTECTED} from ${remote}: ${pull.out}`] };
  if (!/Already up to date/i.test(pull.out)) {
    lines.push(`Pulled ${PROTECTED} from ${remote}.`);
    changed = true;
  }

  for (const b of merged) {
    const onRemote = git(cwd, 'ls-remote', '--exit-code', '--heads', remote, b).ok;
    if (onRemote) git(cwd, 'push', remote, '--delete', b);
    git(cwd, 'branch', '-D', b);
    lines.push(`Deleted merged branch ${b}${onRemote ? ` (also on ${remote})` : ''}.`);
    changed = true;
  }
  if (!changed) lines.push(`Nothing to finish: on ${PROTECTED}, up to date, no merged branches.`);
  return { ok: true, changed, lines };
}

if (require.main === module) {
  const { ok, lines } = finish(process.cwd());
  for (const l of lines) (ok ? console.log : console.error)(l);
  process.exitCode = ok ? 0 : 1;
}

module.exports = { finish, githubRepo };
