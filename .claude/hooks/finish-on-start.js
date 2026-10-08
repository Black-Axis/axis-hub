#!/usr/bin/env node
// SessionStart hook: runs `git finish` (.githooks/finish.js) so a session never
// starts on a branch whose pull request was already merged. Skipped on main
// with no other local branch (nothing to finish, so no fetch), and the fetch
// stops after 10 s. Silent when there is nothing to clean up, the branch is
// still in progress, or the fetch fails. Always exits 0.
'use strict';

const path = require('path');

try {
  let input = {};
  try {
    input = JSON.parse(require('fs').readFileSync(0, 'utf8') || '{}');
  } catch {}
  const { finish, hasWork } = require(path.join(__dirname, '..', '..', '.githooks', 'finish.js'));
  const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const result = hasWork(cwd) ? finish(cwd, { fetchTimeout: 10000 }) : { ok: false };
  if (result.ok && result.changed) {
    const text = `git finish: ${result.lines.join(' ')}`;
    process.stdout.write(JSON.stringify({
      systemMessage: text,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text },
    }));
  }
} catch {}
process.exit(0);
