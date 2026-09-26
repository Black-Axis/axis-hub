#!/usr/bin/env node
// PreToolUse hook: stops Claude from committing on main, pushing to main on
// GitHub, or creating branches not named <type>/<short-name>. The rules live in
// .githooks/guard.js (shared with the git hooks). Always exits 0; a refusal is
// returned as a "deny" decision with the reason.
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const guard = require(path.join(__dirname, '..', '..', '.githooks', 'guard.js'));

// Splits a command line into segments (on && || ; | and newlines) of tokens, honoring quotes.
function segments(command) {
  const out = [];
  let tokens = [];
  let token = '';
  let quote = null;
  let inToken = false;
  const endToken = () => {
    if (inToken) tokens.push(token);
    token = '';
    inToken = false;
  };
  const endSegment = () => {
    endToken();
    if (tokens.length) out.push(tokens);
    tokens = [];
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      else token += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      inToken = true;
    } else if (c === '\n' || c === ';' || c === '|' || (c === '&' && command[i + 1] === '&')) {
      if (c === '&' || (c === '|' && command[i + 1] === '|')) i++;
      endSegment();
    } else if (/\s/.test(c)) {
      endToken();
    } else {
      token += c;
      inToken = true;
    }
  }
  endSegment();
  return out;
}

// Returns { sub, args } for a git invocation, or null.
function gitCall(tokens) {
  if (!/^git(\.exe)?$/i.test(tokens[0] || '')) return null;
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith('-')) i += ['-c', '-C'].includes(tokens[i]) ? 2 : 1;
  if (i >= tokens.length) return null;
  return { sub: tokens[i], args: tokens.slice(i + 1) };
}

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function positionals(args) {
  return args.filter((a) => !a.startsWith('-'));
}

// Errors for one push, given the simulated current branch.
function checkPushCall(args, branch, cwd) {
  const pos = positionals(args);
  const remote = pos[0] || (branch && git(cwd, ['config', `branch.${branch}.remote`])) || 'origin';
  const url = /[:/]/.test(remote) ? remote : git(cwd, ['remote', 'get-url', remote]);
  if (!guard.isGitHubUrl(url)) return [];

  if (args.includes('--all') || args.includes('--mirror') || args.includes('--branches')) {
    return guard.checkPush(url, [{ remoteRef: `refs/heads/${guard.PROTECTED}`, localSha: '1' }]);
  }
  const deleting = args.includes('-d') || args.includes('--delete');
  let refspecs = pos.slice(1);
  if (!refspecs.length) {
    if (args.includes('--tags') || !branch) return [];
    refspecs = [branch];
  }
  const updates = [];
  for (const spec of refspecs) {
    const s = spec.replace(/^\+/, '');
    const [src, dst] = s.includes(':') ? s.split(':') : [s, s];
    let name = dst === 'HEAD' ? branch : dst;
    if (!name) continue;
    if (name.startsWith('refs/tags/') || (!name.startsWith('refs/') && git(cwd, ['show-ref', '--verify', '-q', `refs/tags/${name}`]) !== null)) continue;
    name = name.replace(/^refs\/heads\//, '');
    updates.push({ remoteRef: `refs/heads/${name}`, localSha: deleting || src === '' ? '0' : '1' });
  }
  return guard.checkPush(url, updates);
}

// Walks the command in order, tracking branch switches, and returns the first set of errors.
function check(command, cwd) {
  let branch = guard.currentBranch(cwd);
  for (const tokens of segments(command)) {
    const call = gitCall(tokens);
    if (!call) continue;
    const { sub, args } = call;
    let errors = [];
    if (sub === 'switch' || sub === 'checkout') {
      const createAt = args.findIndex((a) => ['-c', '-C', '-b', '-B', '--create', '--force-create'].includes(a));
      if (createAt !== -1 && args[createAt + 1]) {
        const err = guard.checkBranchName(args[createAt + 1]);
        if (err) errors = [err];
        else branch = args[createAt + 1];
      } else {
        const target = positionals(args)[0];
        if (target && !args.includes('--') && (target === guard.PROTECTED || guard.BRANCH_PATTERN.test(target))) branch = target;
      }
    } else if (sub === 'branch') {
      const renameAt = args.findIndex((a) => ['-m', '-M', '--move'].includes(a));
      const pos = positionals(args);
      const name = renameAt !== -1 ? pos[pos.length - 1] : (args.length && !args[0].startsWith('-') ? args[0] : null);
      if (name) {
        const err = guard.checkBranchName(name);
        if (err) errors = [err];
      }
    } else if (sub === 'commit') {
      const err = guard.checkCommit(branch);
      if (err) errors = [err];
    } else if (sub === 'push') {
      errors = checkPushCall(args, branch, cwd);
    }
    if (errors.length) return errors;
  }
  return [];
}

if (require.main === module) {
  let input = {};
  try {
    input = JSON.parse(require('fs').readFileSync(0, 'utf8') || '{}');
  } catch {
    process.exit(0);
  }
  const command = (input.tool_input && input.tool_input.command) || '';
  if (/\bgit\b/.test(command)) {
    const errors = check(command, input.cwd || process.cwd());
    if (errors.length) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: errors.join(' '),
        },
      }));
    }
  }
  process.exit(0);
}

module.exports = { segments, gitCall, check };
