// Checks that no Markdown file in the repository repeats a "## " heading - a sign of
// text pasted twice (CLAUDE.md was once duplicated by a scripted edit).
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.resolve(__dirname, '..');

test('no Markdown file repeats a level-2 heading', () => {
  const files = execFileSync('git', ['ls-files', '*.md'], { cwd: repo, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.ok(files.length > 10);
  for (const file of files) {
    const headings = fs.readFileSync(path.join(repo, file), 'utf8').split(/\r?\n/).filter((l) => l.startsWith('## '));
    const seen = new Set();
    for (const h of headings) {
      assert.ok(!seen.has(h), `${file}: "${h}" appears twice`);
      seen.add(h);
    }
  }
});

test('SECURITY.md names no fixed plugin version', () => {
  const text = fs.readFileSync(path.join(repo, 'SECURITY.md'), 'utf8');
  assert.ok(!/\b\d+\.\d+\.\d+\b/.test(text), 'SECURITY.md names a fixed version; say "latest" instead');
});
