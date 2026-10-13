#!/usr/bin/env node
// PostToolUse hook on Write / Edit / MultiEdit: warns at once (as context for
// Claude) when the written file's line endings no longer match what git checks out
// for it, or its Markdown frontmatter would not parse as YAML (an unquoted ": " or
// " #" in a value). Only files inside the project; silent otherwise. Always exits 0.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// The line endings of a text: 'lf', 'crlf', 'mixed', or null (no line break).
function eolOf(text) {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/\n/g) || []).length - crlf;
  if (!crlf && !lf) return null;
  if (crlf && lf) return 'mixed';
  return crlf ? 'crlf' : 'lf';
}

// The line endings git checks the file out with, from `git ls-files --eol` fields
// (index `i/<eol>`, attributes `attr/...`) and core.autocrlf; null when unknown.
function expectedEol(index, attr, autocrlf) {
  if (/eol=lf/.test(attr)) return 'lf';
  if (/eol=crlf/.test(attr)) return 'crlf';
  if (/-text|binary/.test(attr) || !['lf', 'crlf'].includes(index)) return null;
  return autocrlf === 'true' ? 'crlf' : index;
}

// Problems in a Markdown text's frontmatter (empty when it has none or it parses).
function frontmatterProblems(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!m) return [];
  const out = [];
  m[1].split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || /^\s/.test(line) || /^#/.test(line)) return; // nested block, comment
    const kv = /^([A-Za-z][\w-]*):( (.*))?$/.exec(line);
    if (!kv) return out.push(`frontmatter line ${i + 2} is not "key: value": ${line}`);
    const value = (kv[3] || '').trim();
    if (/^(["']).*\1$/.test(value) || /^\[[^\]]*\]$|^\{[^}]*\}$/.test(value)) return; // quoted, or one flow list / map
    if (/^[[{]/.test(value)) return out.push(`frontmatter line ${i + 2}: ${kv[1]} starts with "${value[0]}" but is not one list or map - quote the value`);
    if (/: | #/.test(value)) out.push(`frontmatter line ${i + 2}: ${kv[1]} has an unquoted ": " or " #" - quote the value`);
  });
  return out;
}

function git(cwd, ...args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// Warning lines for one written file.
function check(file, root) {
  const rel = path.relative(root, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  const eol = eolOf(text);
  const relPosix = rel.split(path.sep).join('/');
  const info = git(root, 'ls-files', '--eol', '--', relPosix);
  if (eol === 'mixed') out.push(`${relPosix}: mixed CRLF and LF line endings - rewrite it with one kind`);
  else if (info && eol) {
    // "i/lf    w/crlf  attr/text eol=lf      \t<path>"
    const [, index, attr] = /^i\/(\S*)\s+w\/\S*\s+attr\/(.*)$/.exec(info.split('\t')[0].trim()) || [];
    const want = expectedEol(index, (attr || '').trim(), git(root, 'config', 'core.autocrlf'));
    if (want && want !== eol) out.push(`${relPosix}: line endings are now ${eol.toUpperCase()}, git checks it out with ${want.toUpperCase()} - keep the file's line endings`);
  }
  if (/\.md$/i.test(file)) for (const p of frontmatterProblems(text)) out.push(`${relPosix}: ${p}`);
  return out;
}

if (require.main === module) {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}') || {};
    const file = input.tool_input && input.tool_input.file_path;
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    if (typeof file === 'string') {
      const lines = check(path.resolve(root, file), root);
      if (lines.length) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `check-edit: ${lines.join('; ')}` },
        }));
      }
    }
  } catch {
    // never fail the edit: no output
  }
  process.exit(0);
}

module.exports = { eolOf, expectedEol, frontmatterProblems, check };
