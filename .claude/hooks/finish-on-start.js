#!/usr/bin/env node
// SessionStart hook: runs `git finish` (.githooks/finish.js) so a session never
// starts on a branch whose pull request was already merged. Silent when there
// is nothing to clean up or the branch is still in progress. Always exits 0.
'use strict';

const path = require('path');

try {
  let input = {};
  try {
    input = JSON.parse(require('fs').readFileSync(0, 'utf8') || '{}');
  } catch {}
  const { finish } = require(path.join(__dirname, '..', '..', '.githooks', 'finish.js'));
  const result = finish(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  if (result.ok && result.changed) {
    const text = `git finish: ${result.lines.join(' ')}`;
    process.stdout.write(JSON.stringify({
      systemMessage: text,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text },
    }));
  }
} catch {}
process.exit(0);
