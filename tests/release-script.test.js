// Checks scripts/release.js without git or GitHub: the proposed versions, the
// changelog rename, the manifest / README edits, and the push remote.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { unreleasedLines, rootAreas, pluginTypes, bumpOf, bump, compare, milestoneVersion, kindOf, phaseOf, propose, releaseChangelog, setJsonVersion, setReadmeRow, setVersionLine, prepareEdits, prepare, pushRemote } = require('../scripts/release.js');

const ROOT_LOG = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### foreman 1.6.0',
  '',
  'Details: [foreman changelog](plugins/foreman/CHANGELOG.md).',
  '',
  '#### Fixed',
  '',
  '- A fix (#1)',
  '',
  '### Marketplace',
  '',
  '#### Added',
  '',
  '- A script (#2)',
  '',
  '## [1.6.0] - 2026-10-09',
  '',
  '### foreman 1.6.0',
  '',
  '#### Added',
  '',
  '- Old (#0)',
  '',
].join('\r\n');

const PLUGIN_LOG = '# Changelog - foreman\n\n## [Unreleased]\n\n### Fixed\n\n- A fix (#1): details.\n\n## [1.6.0] - 2026-10-09\n\n### Added\n\n- Old.\n';

const MARKETPLACE = [
  '{',
  '  "name": "axis-hub",',
  '  "metadata": {',
  '    "description": "x",',
  '    "version": "1.6.0"',
  '  },',
  '  "plugins": [',
  '    {',
  '      "name": "foreman",',
  '      "source": "./plugins/foreman",',
  '      "version": "1.6.0",',
  '      "keywords": ["a", "b"]',
  '    }',
  '  ]',
  '}',
  '',
].join('\n');

const FILES = {
  '.claude-plugin/marketplace.json': MARKETPLACE,
  'CHANGELOG.md': ROOT_LOG,
  'README.md': '| Plugin | Version | What |\n|---|---|---|\n| <img src="x.png"> [foreman](plugins/foreman/README.md) | 1.6.0 | Plan |\n',
  'plugins/foreman/CHANGELOG.md': PLUGIN_LOG,
  'plugins/foreman/README.md': '# foreman\n\nVersion 1.6.0 - [changelog](CHANGELOG.md).\n',
  'plugins/foreman/.claude-plugin/plugin.json': '{\n  "name": "foreman",\n  "version": "1.6.0"\n}\n',
};
const read = (rel) => FILES[rel];

test('unreleased areas and change types', () => {
  assert.strictEqual(unreleasedLines('# x\n'), null);
  const areas = rootAreas(ROOT_LOG);
  assert.deepStrictEqual([...areas.keys()], ['foreman', 'Marketplace']);
  assert.deepStrictEqual([...areas.get('foreman')], ['Fixed']);
  assert.deepStrictEqual([...pluginTypes(PLUGIN_LOG)], ['Fixed']);
});

test('bumps: Removed major, Added minor, others patch, none null', () => {
  assert.strictEqual(bumpOf(new Set(['Removed', 'Added'])), 'major');
  assert.strictEqual(bumpOf(new Set(['Added', 'Fixed'])), 'minor');
  assert.strictEqual(bumpOf(new Set(['Changed'])), 'patch');
  assert.strictEqual(bumpOf(new Set()), null);
  assert.strictEqual(bump('1.6.3', 'major'), '2.0.0');
  assert.strictEqual(bump('1.6.3', 'minor'), '1.7.0');
  assert.strictEqual(bump('1.6.3', 'patch'), '1.6.4');
  assert.strictEqual(compare('1.10.0', '1.9.9'), 1);
  assert.strictEqual(compare('1.6.0', '1.6.0'), 0);
  assert.strictEqual(kindOf('1.6.0', '2.0.0'), 'major');
  assert.strictEqual(kindOf('1.6.0', '1.7.0'), 'minor');
  assert.strictEqual(kindOf('1.6.0', '1.6.1'), 'patch');
});

test('phaseOf: an untagged or unclosed release before new Unreleased entries', () => {
  const yes = () => true;
  const no = () => false;
  assert.strictEqual(phaseOf({ hasUnreleased: true, tagged: false, hasSection: true, closable: no }), 'tag');
  assert.strictEqual(phaseOf({ hasUnreleased: true, tagged: true, hasSection: true, closable: yes }), 'close');
  assert.strictEqual(phaseOf({ hasUnreleased: true, tagged: true, hasSection: true, closable: no }), 'prepare');
  assert.strictEqual(phaseOf({ hasUnreleased: false, tagged: true, hasSection: true, closable: no }), 'none');
  assert.strictEqual(phaseOf({ hasUnreleased: true, tagged: false, hasSection: false, closable: no }), 'prepare');
});

test('milestoneVersion: lowest vX.Y.Z milestone above the current version', () => {
  assert.strictEqual(milestoneVersion(['v1.8.0', 'Backlog', 'v1.7.0', 'v1.6.0'], '1.6.0'), '1.7.0');
  assert.strictEqual(milestoneVersion(['v1.10.0', 'v1.9.0'], '1.6.0'), '1.9.0');
  assert.strictEqual(milestoneVersion(['v1.6.0', 'next'], '1.6.0'), null);
});

test('propose: per plugin from its types, marketplace from the highest bump', () => {
  const p = propose({ marketplace: JSON.parse(MARKETPLACE), root: ROOT_LOG, plugins: { foreman: PLUGIN_LOG } });
  assert.deepStrictEqual(p.marketplace, { from: '1.6.0', to: '1.7.0', kind: 'minor', types: ['Fixed', 'Added'] });
  assert.deepStrictEqual(p.plugins, [{ name: 'foreman', from: '1.6.0', to: '1.6.1', kind: 'patch', types: ['Fixed'] }]);
  const quiet = propose({ marketplace: JSON.parse(MARKETPLACE), root: '## [Unreleased]\n\n### Marketplace\n\n#### Fixed\n\n- x (#3)\n', plugins: { foreman: '## [Unreleased]\n' } });
  assert.strictEqual(quiet.marketplace.to, '1.6.1');
  assert.strictEqual(quiet.plugins[0].to, null);
});

test('releaseChangelog: new empty Unreleased, dated section, plugin headings, line endings kept', () => {
  const { text } = releaseChangelog(ROOT_LOG, '1.7.0', '2026-10-13', { foreman: '1.6.1' });
  assert.ok(text.includes('## [Unreleased]\r\n\r\n## [1.7.0] - 2026-10-13\r\n\r\n### foreman 1.6.1\r\n'));
  assert.ok(text.includes('## [1.6.0] - 2026-10-09\r\n\r\n### foreman 1.6.0\r\n'), 'older sections unchanged');
  assert.ok(!/[^\r]\n/.test(text), 'CRLF kept');
  assert.match(releaseChangelog('# x\n\n## [Unreleased]\n\n## [1.0.0]\n', '1.1.0', '2026-10-13').error, /empty/);
  assert.match(releaseChangelog('# x\n', '1.1.0', '2026-10-13').error, /no "## \[Unreleased\]"/);
});

test('manifest, README row, and Version line edits', () => {
  assert.ok(setJsonVersion(MARKETPLACE, '"metadata"', '1.6.0', '1.7.0').text.includes('"description": "x",\n    "version": "1.7.0"'));
  const plugin = setJsonVersion(MARKETPLACE, '"name": "foreman"', '1.6.0', '1.6.1').text;
  assert.ok(plugin.includes('"source": "./plugins/foreman",\n      "version": "1.6.1"'));
  assert.ok(plugin.includes('"version": "1.6.0"\n  }'), 'metadata.version unchanged');
  assert.match(setJsonVersion(MARKETPLACE, '"metadata"', '9.9.9', '1.0.0').error, /no "version": "9.9.9"/);
  assert.ok(setReadmeRow(FILES['README.md'], 'foreman', '1.6.0', '1.6.1').text.includes('README.md) | 1.6.1 | Plan |'));
  assert.match(setReadmeRow(FILES['README.md'], 'foreman', '1.5.0', '1.6.1').error, /shows 1.6.0/);
  assert.match(setReadmeRow(FILES['README.md'], 'other', '1.0.0', '1.0.1').error, /no other row/);
  assert.strictEqual(setVersionLine('Version 1.6.0 - x', '1.6.0', '1.6.1').text, 'Version 1.6.1 - x');
  assert.match(setVersionLine('Version 1.5.0 - x', '1.6.0', '1.6.1').error, /no "Version 1.6.0 "/);
});

test('prepareEdits: every file, or an error', () => {
  const { files, error } = prepareEdits(read, '1.7.0', { foreman: '1.6.1' }, '2026-10-13');
  assert.ifError(error);
  assert.deepStrictEqual(Object.keys(files).sort(), [
    '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'README.md',
    'plugins/foreman/.claude-plugin/plugin.json', 'plugins/foreman/CHANGELOG.md', 'plugins/foreman/README.md',
  ]);
  const m = JSON.parse(files['.claude-plugin/marketplace.json']);
  assert.strictEqual(m.metadata.version, '1.7.0');
  assert.strictEqual(m.plugins[0].version, '1.6.1');
  assert.ok(files['.claude-plugin/marketplace.json'].includes('"keywords": ["a", "b"]'), 'layout kept');
  assert.ok(files['plugins/foreman/CHANGELOG.md'].includes('## [Unreleased]\n\n## [1.6.1] - 2026-10-13\n\n### Fixed'));
  assert.strictEqual(JSON.parse(files['plugins/foreman/.claude-plugin/plugin.json']).version, '1.6.1');
  assert.ok(files['plugins/foreman/README.md'].includes('Version 1.6.1 '));

  assert.match(prepareEdits(read, '1.7.0', {}, '2026-10-13').error, /need a version: foreman=X.Y.Z/);
  assert.match(prepareEdits(read, '1.6.0', { foreman: '1.6.1' }, '2026-10-13').error, /not above metadata.version/);
  assert.match(prepareEdits(read, '1.7.0', { foreman: '1.6.0' }, '2026-10-13').error, /not above 1.6.0/);
  assert.match(prepareEdits(read, '1.7.0', { foreman: '1.6.1', other: '1.0.0' }, '2026-10-13').error, /no plugin other/);
  assert.match(prepareEdits(read, '1.7', {}, '2026-10-13').error, /not a version/);
  assert.match(prepareEdits(read, '1.7.0', { foreman: '1.6.1' }, '13.10.2026').error, /not a date/);
  const noPluginEntries = (rel) => (rel === 'plugins/foreman/CHANGELOG.md' ? '## [Unreleased]\n\n## [1.6.0]\n' : rel === 'CHANGELOG.md' ? '## [Unreleased]\n\n### Marketplace\n\n#### Fixed\n\n- x (#3)\n' : read(rel));
  assert.match(prepareEdits(noPluginEntries, '1.6.1', { foreman: '1.6.1' }, '2026-10-13').error, /foreman has no Unreleased entries/);
  // #150: no plugin version, so the README stays unchanged and is not listed.
  assert.deepStrictEqual(Object.keys(prepareEdits(noPluginEntries, '1.6.1', {}, '2026-10-13').files).sort(), ['.claude-plugin/marketplace.json', 'CHANGELOG.md']);
});

test('prepare: writes every file, or restores them all when the release notes fail', () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axis-release-'));
  const write = () => {
    for (const [rel, text] of Object.entries(FILES)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), text);
    }
  };
  const snapshot = () => Object.fromEntries(Object.keys(FILES).map((rel) => [rel, fs.readFileSync(path.join(dir, rel), 'utf8')]));
  try {
    write();
    assert.throws(() => prepare(['1.7.0', 'foreman=1.6.1', '--date', '2026-10-13'], dir, () => ({ error: 'broken' })), /notes: broken \(files restored\)/);
    assert.deepStrictEqual(snapshot(), FILES);
    assert.throws(() => prepare(['1.7.0', 'foreman=1.6.1', '--date', '2026-10-13'], dir, () => { throw new Error('unreadable'); }), /notes: unreadable \(files restored\)/);
    assert.deepStrictEqual(snapshot(), FILES);
    const lines = prepare(['1.7.0', 'foreman=1.6.1', '--date', '2026-10-13'], dir);
    assert.strictEqual(lines[lines.length - 1], 'notes: v1.7.0 ok');
    assert.match(fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8'), /## \[1\.7\.0\] - 2026-10-13/);
    // #150: without plugin versions only the two changed files are printed and written.
    write();
    fs.writeFileSync(path.join(dir, 'plugins/foreman/CHANGELOG.md'), '## [Unreleased]\n\n## [1.6.0]\n');
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), '## [Unreleased]\n\n### Marketplace\n\n#### Fixed\n\n- x (#3)\n');
    const readmeMtime = fs.statSync(path.join(dir, 'README.md')).mtimeMs;
    const marketplaceOnly = prepare(['1.7.0', '--date', '2026-10-13'], dir);
    assert.deepStrictEqual(marketplaceOnly, ['changed: .claude-plugin/marketplace.json', 'changed: CHANGELOG.md', 'notes: v1.7.0 ok']);
    assert.strictEqual(fs.statSync(path.join(dir, 'README.md')).mtimeMs, readmeMtime);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('pushRemote: by Black-Axis/axis-hub URL, never by name', () => {
  const v = [
    'fork\thttps://github.com/someone/axis-hub.git (fetch)',
    'fork\thttps://github.com/someone/axis-hub.git (push)',
    'up\tgit@github.com:Black-Axis/axis-hub.git (fetch)',
    'up\tgit@github.com:Black-Axis/axis-hub.git (push)',
    'gh\thttps://github.com/Black-Axis/axis-hub (push)',
  ].join('\n');
  assert.strictEqual(pushRemote(v, ''), 'up');
  assert.strictEqual(pushRemote(v, 'gh'), 'gh');
  assert.strictEqual(pushRemote(v, 'fork'), 'up');
  assert.strictEqual(pushRemote('x\thttps://github.com/Black-Axis/axis-hub-other (push)', ''), null);
});

test('the real repository files prepare without errors', () => {
  const repo = path.resolve(__dirname, '..');
  const readRepo = (rel) => fs.readFileSync(path.join(repo, rel), 'utf8');
  const marketplace = JSON.parse(readRepo('.claude-plugin/marketplace.json'));
  const logs = {};
  for (const p of marketplace.plugins) logs[p.name] = readRepo(path.join(p.source, 'CHANGELOG.md'));
  const p = propose({ marketplace, root: readRepo('CHANGELOG.md'), plugins: logs });
  if (!p.marketplace.to) return; // nothing under Unreleased
  const versions = Object.fromEntries(p.plugins.filter((x) => x.to).map((x) => [x.name, x.to]));
  assert.ifError(prepareEdits(readRepo, p.marketplace.to, versions, '2026-01-01').error);
});
