#!/usr/bin/env node
// Branch rules shared by the git hooks in this folder and the Claude Code hook
// in .claude/hooks/guard-git.js:
//   - never commit on main, never push to main on GitHub (use a pull request);
//   - branch names are <type>/<short-name>, e.g. feat/foreman-bug-command.
// Usage from git hooks: node .githooks/guard.js pre-commit
//                       node .githooks/guard.js pre-push <remote> <url>  (refs on stdin)
'use strict';

const { execFileSync } = require('child_process');

const PROTECTED = 'main';
const TYPES = ['feat', 'fix', 'docs', 'test', 'ci', 'chore', 'refactor'];
const BRANCH_PATTERN = new RegExp(`^(${TYPES.join('|')})/[a-z0-9]+(-[a-z0-9]+)*$`);
const HOW = `Create a branch: git switch -c <type>/<short-name> (types: ${TYPES.join(', ')}; e.g. feat/foreman-bug-command).`;

// Error text for a branch name, or null if the name is allowed.
function checkBranchName(name) {
  if (name === PROTECTED) return `Work on "${PROTECTED}" is not allowed. ${HOW}`;
  if (!BRANCH_PATTERN.test(name)) return `Branch name "${name}" does not follow <type>/<short-name>. ${HOW}`;
  return null;
}

// Error text for committing on `branch` (null = detached HEAD, rebase, etc.), or null if allowed.
function checkCommit(branch) {
  if (!branch) return null;
  return checkBranchName(branch);
}

function isGitHubUrl(url) {
  return /github\.com[:/]/i.test(url || '');
}

// Errors for a push. `updates` are { localRef, localSha, remoteRef } from pre-push stdin.
// main is protected on GitHub remotes only; other remotes are not checked.
function checkPush(url, updates) {
  if (!isGitHubUrl(url)) return [];
  const errors = [];
  for (const u of updates) {
    const deleting = /^0+$/.test(u.localSha || '');
    const name = (u.remoteRef || '').replace(/^refs\/heads\//, '');
    if (!(u.remoteRef || '').startsWith('refs/heads/')) continue; // tags etc.
    if (name === PROTECTED) {
      errors.push(`Push to "${PROTECTED}" is not allowed: push your branch and open a pull request. ${HOW}`);
    } else if (!deleting) {
      const err = checkBranchName(name);
      if (err) errors.push(err);
    }
  }
  return errors;
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

function fail(errors) {
  for (const e of errors) console.error(`✘ ${e}`);
  process.exit(1);
}

if (require.main === module) {
  const [hook, , url] = process.argv.slice(2);
  if (hook === 'pre-commit') {
    const err = checkCommit(currentBranch(process.cwd()));
    if (err) fail([err]);
  } else if (hook === 'pre-push') {
    const updates = require('fs').readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
      const [localRef, localSha, remoteRef] = line.split(' ');
      return { localRef, localSha, remoteRef };
    });
    const errors = checkPush(url, updates);
    if (errors.length) fail(errors);
  }
}

module.exports = { PROTECTED, TYPES, BRANCH_PATTERN, checkBranchName, checkCommit, checkPush, isGitHubUrl, currentBranch };
