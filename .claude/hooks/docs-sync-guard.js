#!/usr/bin/env node
// PreToolUse hook of the axis-docs-sync subagent (set in its frontmatter, so it runs
// only inside that subagent): Edit only on the docs it keeps in step (DOCS), and
// Bash only for read-only `git diff`, `git log`, `git show`, and `git status`, one
// command without chaining or redirects. Always exits 0; a refusal is returned as
// a "deny" decision with the reason.
'use strict';

const path = require('path');
const { readOnlyGit } = require('./reviewer-guard.js');

const DOCS = [
  /^(CLAUDE|README|CONTRIBUTING|SECURITY)\.md$/,
  /^e2e\/(CLAUDE|README)\.md$/,
  /^\.claude\/rules\/[^/]+\.md$/,
  /^plugins\/[^/]+\/README\.md$/,
];

// Returns the deny reason for one tool call, or null to let it through.
function decide(input, projectDir) {
  const tool = input && input.tool_name;
  const args = (input && input.tool_input) || {};
  if (tool === 'Edit') {
    const root = path.resolve(projectDir);
    const rel = path.relative(root, path.resolve(root, String(args.file_path || ''))).split(path.sep).join('/');
    if (DOCS.some((re) => re.test(rel))) return null;
    return `axis-docs-sync edits only CLAUDE.md, README.md, CONTRIBUTING.md, SECURITY.md, e2e/CLAUDE.md, e2e/README.md, .claude/rules/*.md, and plugins/*/README.md; not ${args.file_path}.`;
  }
  if (tool === 'Bash') {
    const command = String(args.command || '').trim();
    if (readOnlyGit(command)) return null;
    return `axis-docs-sync runs only read-only \`git diff\`, \`git log\`, \`git show\`, or \`git status\`, one command without cd or chaining; not: ${command}`;
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
  const reason = decide(input, process.env.CLAUDE_PROJECT_DIR || (input && input.cwd) || process.cwd());
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
