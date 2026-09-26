// Checks the release tooling: tag/version matching, release notes from
// CHANGELOG.md, and one pinned Claude Code version across workflows.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { changelogSection, releaseNotes } = require('../.github/scripts/release-notes.js');

const repo = path.resolve(__dirname, '..');
const marketplace = JSON.parse(fs.readFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'));
const version = marketplace.metadata.version;

test('current marketplace version produces release notes', () => {
  const result = releaseNotes(`v${version}`);
  assert.ifError(result.error);
  for (const p of marketplace.plugins) assert.ok(result.notes.includes(`| ${p.name} | ${p.version} |`), p.name);
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

test('workflows pin the same Claude Code version', () => {
  const dir = path.join(repo, '.github', 'workflows');
  const pins = fs.readdirSync(dir)
    .map((f) => /CLAUDE_CODE_VERSION: (\S+)/.exec(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter(Boolean)
    .map((m) => m[1]);
  assert.ok(pins.length >= 2, 'expected validate.yml and release.yml to pin CLAUDE_CODE_VERSION');
  assert.strictEqual(new Set(pins).size, 1, `different pins: ${pins.join(', ')}`);
});
