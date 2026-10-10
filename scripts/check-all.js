#!/usr/bin/env node
// Runs the repository checks and prints one line per check, plus the failures only.
// Usage: node scripts/check-all.js              all tests (e2e included) + every plugin validation
//        node scripts/check-all.js <test file>  only these test files, no validation
// Exit 1 when any check fails.
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// From the spec reporter output: the summary counts and the "failing tests" section,
// without stack frames and the error object's property block.
function testSummary(output) {
  const count = (name) => Number((new RegExp(`^ℹ ${name} (\\d+)`, 'm').exec(output) || [])[1] || 0);
  const lines = output.split(/\r?\n/);
  const start = lines.findIndex((l) => /^✖ failing tests:/.test(l));
  const failures = [];
  if (start !== -1) {
    // The property block opens with " {" on the error line or its last stack frame
    // and closes with "}" at the error line's indent.
    let errIndent = null;
    let inBlock = false;
    const indent = (l) => /^ */.exec(l)[0].length;
    for (const line of lines.slice(start + 1)) {
      if (inBlock) { if (/^\s*\}$/.test(line) && indent(line) === errIndent) inBlock = false; continue; }
      if (/^\s+\w*Error\b/.test(line)) errIndent = indent(line);
      if (errIndent !== null && / \{$/.test(line) && (/^\s+at /.test(line) || indent(line) === errIndent)) { inBlock = true; continue; }
      if (/^\s+at /.test(line)) continue;
      if (line.trim()) failures.push(line);
    }
  }
  return { tests: count('tests'), pass: count('pass'), fail: count('fail'), failures };
}

// From `claude plugin validate`: ok / failed and the warning or error lines.
function validateSummary(output, status) {
  const items = output.split(/\r?\n/).filter((l) => /^\s*❯ /.test(l)).map((l) => l.trim());
  return { ok: status === 0, items };
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { status: 1, output: `${cmd}: ${r.error.code === 'ENOENT' ? 'not found' : r.error.message}` };
  return { status: r.status, output: `${r.stdout}${r.stderr}` };
}

function main(files) {
  let failed = false;
  const t = run(process.execPath, ['--test', '--test-reporter=spec', ...files]);
  const s = testSummary(t.output);
  if (t.status !== 0 && !s.fail) {
    failed = true;
    console.log(`node --test: FAILED (exit ${t.status})\n${t.output.trim().split(/\r?\n/).slice(-20).join('\n')}`);
  } else {
    failed = failed || s.fail > 0;
    console.log(`node --test: ${s.fail ? 'FAILED' : 'ok'} - ${s.pass}/${s.tests} pass`);
    for (const l of s.failures) console.log(`  ${l}`);
  }
  if (files.length) return failed;

  const pluginsDir = path.join(root, 'plugins');
  const targets = ['.', ...fs.readdirSync(pluginsDir).filter((d) => fs.existsSync(path.join(pluginsDir, d, '.claude-plugin', 'plugin.json'))).map((d) => `plugins/${d}`)];
  for (const target of targets) {
    const r = run('claude', ['plugin', 'validate', target]);
    const v = validateSummary(r.output, r.status);
    failed = failed || !v.ok;
    console.log(`validate ${target}: ${v.ok ? 'ok' : 'FAILED'}${v.items.length ? ` - ${v.items.length} ${v.ok ? 'warning(s)' : 'item(s)'}` : ''}`);
    if (!v.ok && !v.items.length) console.log(`  ${r.output.trim().split(/\r?\n/).slice(-5).join('\n  ')}`);
    for (const l of v.items) console.log(`  ${l}`);
  }
  return failed;
}

if (require.main === module) process.exit(main(process.argv.slice(2)) ? 1 : 0);

module.exports = { testSummary, validateSummary };
