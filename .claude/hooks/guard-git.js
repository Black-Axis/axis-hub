#!/usr/bin/env node
// PreToolUse hook: stops Claude from committing on main, pushing to main on
// GitHub, creating branches not named <type>/<short-name>, or merging pull
// requests (`gh pr merge`, merge calls through `gh api`). The branch rules live in
// .githooks/guard.js (shared with the git hooks). Always exits 0; a refusal is
// returned as a "deny" decision with the reason.
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const guard = require(path.join(__dirname, '..', '..', '.githooks', 'guard.js'));

// Removes heredoc bodies (<<EOF ... EOF) and PowerShell here-strings (@' ... '@):
// they are data (file content, PR text), not commands.
function stripHereDocs(command) {
  return command
    .replace(/<<-?[ \t]*(['"]?)([A-Za-z_][\w-]*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\r?\n|$)/g, (m, q, tag, rest) => rest)
    .replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, "''");
}

// Splits a command line into segments (on && || ; | and newlines) of tokens, honoring quotes.
function segments(rawCommand) {
  const command = stripHereDocs(rawCommand);
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

// Removes redirections (2>&1, >file, > file, <file, ...) from a segment's tokens.
function withoutRedirects(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const m = /^(\d*|&)(>>?|<)(&?\d*)(.*)$/.exec(tokens[i]);
    if (!m) out.push(tokens[i]);
    else if (!m[3] && !m[4]) i++; // target is the next token
  }
  return out;
}

// Returns { sub, args, cwd } for a git invocation, or null. `cwd` follows
// `-C <path>` options (relative ones resolve against the previous directory).
function gitCall(rawTokens, cwd) {
  const tokens = withoutRedirects(rawTokens);
  if (!/^git(\.exe)?$/i.test(tokens[0] || '')) return null;
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (tokens[i] === '-C' && tokens[i + 1] !== undefined) cwd = path.resolve(cwd || '.', tokens[i + 1]);
    i += ['-c', '-C'].includes(tokens[i]) ? 2 : 1;
  }
  if (i >= tokens.length) return null;
  return { sub: tokens[i], args: tokens.slice(i + 1), cwd };
}

const MERGE_DENIED = 'Merging pull requests is not allowed: the user reviews and merges every pull request.';

// Error text for a gh call that merges a pull request, or null.
function checkGh(rawTokens) {
  const tokens = withoutRedirects(rawTokens);
  if (!/^gh(\.exe)?$/i.test(tokens[0] || '')) return null;
  const pos = positionals(tokens.slice(1));
  if (pos[0] === 'pr' && pos[1] === 'merge') return MERGE_DENIED;
  if (pos[0] === 'api') {
    const text = tokens.join(' ');
    if (/\bmergePullRequest\b|\benablePullRequestAutoMerge\b/.test(text)) return MERGE_DENIED;
    const put = tokens.some((t, i) => /^(-X|--method)$/.test(tokens[i - 1] || '') && /^put$/i.test(t)) ||
      tokens.some((t) => /^(-XPUT|--method=put)$/i.test(t));
    if (put && /pulls\/[^/\s]+\/merge\b/.test(text)) return MERGE_DENIED;
  }
  return null;
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

// Name of the tag a `git tag` call creates, or null (listing, deleting, verifying).
function createdTag(args) {
  if (args.some((a) => ['-d', '--delete', '-l', '--list', '-v', '--verify'].includes(a))) return null;
  const withValue = ['-m', '--message', '-F', '--file', '-u', '--local-user', '--cleanup'];
  for (let i = 0; i < args.length; i++) {
    if (withValue.includes(args[i])) i++;
    else if (!args[i].startsWith('-')) return args[i];
  }
  return null;
}

// Errors for one push, given the simulated current branch and the tags created earlier in the command.
function checkPushCall(args, branch, cwd, newTags = new Set()) {
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
    if (name.startsWith('refs/tags/') || newTags.has(name)) continue;
    if (!name.startsWith('refs/') && git(cwd, ['show-ref', '--verify', '-q', `refs/tags/${name}`]) !== null) continue;
    name = name.replace(/^refs\/heads\//, '');
    updates.push({ remoteRef: `refs/heads/${name}`, localSha: deleting || src === '' ? '0' : '1' });
  }
  return guard.checkPush(url, updates);
}

// Walks the command in order, tracking branch switches, and returns the first set of errors.
// Branches are tracked per repository, so `git -C <path>` is checked against that repository.
function check(command, cwd) {
  const branches = new Map();
  const newTags = new Set();
  for (const tokens of segments(command)) {
    const ghError = checkGh(tokens);
    if (ghError) return [ghError];
    const call = gitCall(tokens, cwd);
    if (!call) continue;
    const { sub, args } = call;
    const dir = call.cwd;
    if (!branches.has(dir)) branches.set(dir, guard.currentBranch(dir));
    let branch = branches.get(dir);
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
    } else if (sub === 'tag') {
      const tag = createdTag(args);
      if (tag) newTags.add(tag);
    } else if (sub === 'push') {
      errors = checkPushCall(args, branch, dir, newTags);
    }
    if (errors.length) return errors;
    branches.set(dir, branch);
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
  if (/\b(git|gh)\b/.test(command)) {
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

module.exports = { segments, gitCall, checkGh, check };
