// Checks the release tooling: tag/version matching, release notes from
// CHANGELOG.md, and one pinned Claude Code version across workflows.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { absoluteLinks, changelogSection, promoteHeadings, releaseNotes } = require('../.github/scripts/release-notes.js');

const repo = path.resolve(__dirname, '..');
const marketplace = JSON.parse(fs.readFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'));
const version = marketplace.metadata.version;

test('current marketplace version produces release notes', () => {
  const result = releaseNotes(`v${version}`);
  assert.ifError(result.error);
  for (const p of marketplace.plugins) assert.ok(result.notes.includes(`| ${p.name} | ${p.version} |`), p.name);
});

test('relative links become absolute links to the tagged files', () => {
  const base = 'https://github.com/o/r';
  assert.strictEqual(absoluteLinks('[c](plugins/x/CHANGELOG.md)', 'v1.2.3', base), `[c](${base}/blob/v1.2.3/plugins/x/CHANGELOG.md)`);
  assert.strictEqual(absoluteLinks('[c](./README.md#install)', 'v1.2.3', base), `[c](${base}/blob/v1.2.3/README.md#install)`);
  for (const kept of ['[a](https://x.y/z)', '[b](#anchor)', '[m](mailto:a@b.c)']) {
    assert.strictEqual(absoluteLinks(kept, 'v1.2.3', base), kept);
  }
});

test('tag not matching marketplace version is rejected', () => {
  assert.match(releaseNotes('v0.0.0').error, /does not match/);
});

test('malformed tag is rejected', () => {
  assert.match(releaseNotes('1.0.0').error, /vX\.Y\.Z/);
  assert.match(releaseNotes('v1.0').error, /vX\.Y\.Z/);
});

test('changelog section is extracted up to the next heading', () => {
  const text = '# Changelog\n\n## [Unreleased]\n\n## [1.1.0] - 2026-10-01\n\n- New\n\n## [1.0.0] - 2026-09-26\n\n- Old\n';
  assert.strictEqual(changelogSection(text, '1.1.0'), '- New');
  assert.strictEqual(changelogSection(text, '1.0.0'), '- Old');
  assert.strictEqual(changelogSection(text, '2.0.0'), null);
  assert.strictEqual(changelogSection(text, 'Unreleased'), null);
});

test('release notes move the section headings up one level', () => {
  assert.strictEqual(promoteHeadings('### foreman 1.5.0\n\n#### Added\n\n- x #### y'), '## foreman 1.5.0\n\n### Added\n\n- x #### y');
  const { notes } = releaseNotes(`v${version}`);
  assert.ok(!/^#### /m.test(notes), 'no #### heading on the release page');
});

// Root CHANGELOG layout from 1.5.0 on (#98): per version, one "### <plugin> X.Y.Z" or
// "### Marketplace" section per area, each with "#### Added|Changed|..." lists of
// short one-change bullets. Details stay in the plugin changelogs.
const LAYOUT_SINCE = [1, 5, 0];
const TYPES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
const MAX_BULLET = 140;

function versionSections(text) {
  const out = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const m = /^## \[([^\]]+)\]/.exec(line);
    if (m) out.push(cur = { version: m[1], lines: [] });
    else if (/^## /.test(line)) cur = null;
    else if (cur) cur.lines.push(line);
  }
  return out;
}

const newLayout = (v) => v === 'Unreleased' || v.split('.').map(Number).reduce((r, n, i) => r || (n !== LAYOUT_SINCE[i] ? Math.sign(n - LAYOUT_SINCE[i]) : 0), 0) >= 0;

test('root CHANGELOG: areas, change types, and short one-line bullets', () => {
  const plugins = new Map(marketplace.plugins.map((p) => [p.name, p.version]));
  const text = fs.readFileSync(path.join(repo, 'CHANGELOG.md'), 'utf8');
  for (const s of versionSections(text).filter((x) => newLayout(x.version))) {
    let area = null;
    let type = null;
    for (const line of s.lines) {
      const where = `[${s.version}] ${area || ''} ${type || ''}: ${line}`;
      if (/^### /.test(line)) {
        area = line.slice(4);
        type = null;
        const m = /^(\S+) (\d+\.\d+\.\d+)$/.exec(area);
        assert.ok(area === 'Marketplace' || (m && plugins.has(m[1])), `area must be "Marketplace" or "<plugin> X.Y.Z": ${where}`);
        if (m && s.version === version) assert.strictEqual(m[2], plugins.get(m[1]), `plugin version in the current release: ${where}`);
      } else if (/^#### /.test(line)) {
        type = line.slice(5);
        assert.ok(area, `change type outside an area: ${where}`);
        assert.ok(TYPES.includes(type), `change type must be one of ${TYPES.join(', ')}: ${where}`);
      } else if (/^#/.test(line)) {
        assert.fail(`only ### area and #### type headings inside a version: ${where}`);
      } else if (/^\s*[-*] /.test(line)) {
        assert.ok(type, `bullet outside a change type list: ${where}`);
        assert.ok(/^- \S/.test(line), `top-level "- " bullets only: ${where}`);
        assert.ok(line.length <= MAX_BULLET, `bullet longer than ${MAX_BULLET} characters - one short change per bullet, details in the plugin changelog: ${where}`);
      } else if (line.trim()) {
        assert.ok(area && !type, `text only under an area heading, before its lists: ${where}`);
      }
    }
  }
});

test('changelogs: no version section repeats a heading', () => {
  const files = ['CHANGELOG.md', ...marketplace.plugins.map((p) => path.join(p.source, 'CHANGELOG.md'))];
  for (const file of files) {
    for (const s of versionSections(fs.readFileSync(path.join(repo, file), 'utf8'))) {
      const seen = new Set();
      let parent = '';
      for (const line of s.lines) {
        const m = /^(#{3,}) (.+)$/.exec(line);
        if (!m) continue;
        if (m[1].length === 3) parent = m[2];
        const key = m[1].length === 3 ? m[2] : `${parent} > ${m[2]}`;
        assert.ok(!seen.has(key), `${file} [${s.version}] repeats the heading "${line}"`);
        seen.add(key);
      }
    }
  }
});

test('workflows pin the same Claude Code version', () => {
  const dir = path.join(repo, '.github', 'workflows');
  const pins = fs.readdirSync(dir)
    .map((f) => /CLAUDE_CODE_VERSION: (\S+)/.exec(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter(Boolean)
    .map((m) => m[1]);
  assert.ok(pins.length >= 2, 'expected validate.yml and release.yml to pin CLAUDE_CODE_VERSION');
  assert.strictEqual(new Set(pins).size, 1, `different pins: ${pins.join(', ')}`);
});
