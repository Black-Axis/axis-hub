// Checks that relative links in Markdown files point to files that exist.
// External links (http, mailto) are not checked. Plugin templates are skipped:
// their links contain {{...}} placeholders filled in at run time.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const skipDirs = new Set(['.git', 'node_modules', '.claude']);
const skipPaths = [path.join('plugins', 'foreman', 'templates')];

function markdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(repo, full);
    if (skipPaths.includes(rel)) continue;
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) out.push(...markdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

// Link targets outside fenced and inline code.
function linkTargets(text) {
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return [...prose.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
}

for (const file of markdownFiles(repo)) {
  const rel = path.relative(repo, file).split(path.sep).join('/');
  test(`links in ${rel}`, () => {
    const broken = linkTargets(fs.readFileSync(file, 'utf8'))
      .filter((t) => !/^[a-z][a-z0-9+.-]*:/i.test(t) && !t.startsWith('#'))
      .filter((t) => !fs.existsSync(path.resolve(path.dirname(file), decodeURIComponent(t.split('#')[0]))));
    assert.deepStrictEqual(broken, [], `broken links in ${rel}`);
  });
}
