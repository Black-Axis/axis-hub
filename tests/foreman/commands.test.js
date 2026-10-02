// Checks foreman command files that run reference/setup.md (in Auto or Ask all mode).
// userConfig values are substituted only in a loaded command, never in a file
// read with Read, so each such command must contain every placeholder itself.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const plugin = path.resolve(__dirname, '..', '..', 'plugins', 'foreman');
const manifest = JSON.parse(fs.readFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), 'utf8'));
const keys = Object.keys(manifest.userConfig);
const commandsDir = path.join(plugin, 'commands');

test('commands running setup.md carry every user_config placeholder', () => {
  const users = fs.readdirSync(commandsDir)
    .filter((f) => /reference\/setup\.md` in \*\*(Auto|Ask all)\*\* mode/.test(fs.readFileSync(path.join(commandsDir, f), 'utf8')));
  for (const expected of ['init.md', 'new.md', 'interview.md', 'import.md']) assert.ok(users.includes(expected), expected);
  for (const file of users) {
    const text = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    for (const key of keys) assert.ok(text.includes(`\${user_config.${key}}`), `${file} lacks ${key}`);
  }
});

test('allowed-tools stay scoped: workbench edits and read-only version control only', () => {
  const readOnly = /^Bash\((git (status|diff|ls-files|log)|tf (status|diff|history)):\*\)$/;
  for (const file of fs.readdirSync(commandsDir)) {
    const m = /^allowed-tools:\s*(.+)$/m.exec(fs.readFileSync(path.join(commandsDir, file), 'utf8'));
    if (!m) continue;
    for (const tool of m[1].split(/,\s*(?![^()]*\))/).map((t) => t.trim())) {
      if (/^(Edit|Write|Bash|PowerShell)/.test(tool)) {
        assert.ok(/^(Edit|Write)\(workbench\/\*\*\)$/.test(tool) || readOnly.test(tool), `${file}: ${tool}`);
      }
    }
  }
});

test('settings.md carries every user_config placeholder (its menu shows the defaults)', () => {
  const text = fs.readFileSync(path.join(commandsDir, 'settings.md'), 'utf8');
  for (const key of keys) assert.ok(text.includes(`\${user_config.${key}}`), `settings.md lacks ${key}`);
});

test('setup.md itself has no user_config placeholders', () => {
  const text = fs.readFileSync(path.join(plugin, 'reference', 'setup.md'), 'utf8');
  assert.doesNotMatch(text, /\$\{user_config\.[a-z_]+\}/);
});
