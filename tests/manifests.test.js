// Checks that marketplace.json and each plugin's plugin.json stay in sync,
// and that every plugin has a README and a CHANGELOG entry for its version.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const marketplace = JSON.parse(fs.readFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'));

for (const entry of marketplace.plugins) {
  test(`${entry.name}: manifests in sync`, () => {
    const dir = path.join(repo, entry.source);
    const plugin = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.strictEqual(plugin.name, entry.name, 'name');
    assert.strictEqual(plugin.version, entry.version, 'version');
    assert.strictEqual(plugin.description, entry.description, 'description');
    assert.deepStrictEqual(plugin.keywords, entry.keywords, 'keywords');
  });

  test(`${entry.name}: README and CHANGELOG entry exist`, () => {
    const dir = path.join(repo, entry.source);
    assert.ok(fs.existsSync(path.join(dir, 'README.md')), 'README.md missing');
    const changelog = path.join(dir, 'CHANGELOG.md');
    assert.ok(fs.existsSync(changelog), 'CHANGELOG.md missing');
    assert.match(fs.readFileSync(changelog, 'utf8'), new RegExp(`## \\[${entry.version.replace(/\./g, '\\.')}\\]`),
      `CHANGELOG.md has no entry for ${entry.version}`);
  });

  test(`${entry.name}: listed in root README`, () => {
    assert.match(fs.readFileSync(path.join(repo, 'README.md'), 'utf8'), new RegExp(`\\[${entry.name}\\]`));
  });
}
