#!/usr/bin/env node
// PreToolUse hook of the axis-reviewer subagent (set in its frontmatter, so it runs
// only inside that subagent): Bash only for read-only `git diff`, `git log`,
// `git show`, and `git status`, one command without chaining or redirects.
// Always exits 0; a refusal is returned as a "deny" decision with the reason.
'use strict';

const GIT = /^git (diff|log|show|status)( [^\s;&|<>`$]+)*$/;

// True for one read-only git command (also used by docs-sync-guard.js).
function readOnlyGit(command) {
  return GIT.test(command) && !/--output|--ext-diff|--textconv|--no-index/.test(command);
}

// Returns the deny reason for one tool call, or null to let it through.
function decide(input) {
  if (!input || input.tool_name !== 'Bash') return null;
  const command = String((input.tool_input && input.tool_input.command) || '').trim();
  if (readOnlyGit(command)) return null;
  return `axis-reviewer runs only read-only \`git diff\`, \`git log\`, \`git show\`, or \`git status\`, one command without cd or chaining; not: ${command}`;
}

if (require.main === module) {
  let input = {};
  try {
    input = JSON.parse(require('fs').readFileSync(0, 'utf8') || '{}');
  } catch {
    process.exit(0);
  }
  const reason = decide(input);
  if (reason) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }));
  }
  process.exit(0);
}

module.exports = { decide, readOnlyGit };
