#!/usr/bin/env node
// PreToolUse hook of the axis-e2e-writer subagent (set in its frontmatter, so it
// runs only inside that subagent): Edit and Write only on files under e2e/
// (never e2e/.work/, the scenario work folders), and Bash only for
// `node e2e/run.js [plugin] [scenario]` and read-only `git diff` / `git status`,
// one command without chaining or redirects. Always exits 0; a refusal is
// returned as a "deny" decision with the reason.
'use strict';

const path = require('path');

const RUN = /^node e2e\/run\.js( [a-z0-9-]+){0,2}$/;
const GIT = /^git (diff|status)( [^\s;&|<>`$]+)*$/;

// Returns the deny reason for one tool call, or null to let it through.
function decide(input, projectDir) {
  const tool = input.tool_name;
  const args = input.tool_input || {};
  if (tool === 'Edit' || tool === 'Write') {
    const root = path.resolve(projectDir);
    const file = path.resolve(root, args.file_path || '');
    const rel = path.relative(path.join(root, 'e2e'), file);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return `axis-e2e-writer edits only files under e2e/, not ${args.file_path}.`;
    if (rel.split(path.sep)[0] === '.work') return 'axis-e2e-writer never edits e2e/.work/: scenarios build it.';
    return null;
  }
  if (tool === 'Bash') {
    const command = (args.command || '').trim();
    if (RUN.test(command)) return null;
    if (GIT.test(command) && !/--output|--ext-diff/.test(command)) return null;
    return `axis-e2e-writer runs only \`node e2e/run.js [plugin] [scenario]\`, \`git diff\`, or \`git status\`, one command without cd or chaining; not: ${command}`;
  }
  return null;
}

if (require.main === module) {
  let input = {};
  try {
    input = JSON.parse(require('fs').readFileSync(0, 'utf8') || '{}');
  } catch {
    process.exit(0);
  }
  const reason = decide(input, process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
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

module.exports = { decide };
