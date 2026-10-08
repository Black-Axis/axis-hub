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
  const readOnly = /^(Bash|PowerShell)\((git (status|diff|ls-files|log)|tf (status|diff|history)):\*\)$/;
  for (const file of fs.readdirSync(commandsDir)) {
    const m = /^allowed-tools:\s*(.+)$/m.exec(fs.readFileSync(path.join(commandsDir, file), 'utf8'));
    if (!m) continue;
    for (const tool of m[1].split(/,\s*(?![^()]*\))/).map((t) => t.trim())) {
      if (/^(Edit|Write|Bash|PowerShell)/.test(tool)) {
        const reportWrite = file === 'report.md' && tool === 'Write(workbench/reports/**)';
        assert.ok(/^(Edit|Write)\(workbench\/\*\*\)$/.test(tool) || reportWrite || readOnly.test(tool), `${file}: ${tool}`);
      }
    }
  }
});

// On Windows the main agent may run the same read-only command through PowerShell.
test('every Bash rule has its PowerShell twin, and the other way round', () => {
  for (const file of fs.readdirSync(commandsDir)) {
    const m = /^allowed-tools:\s*(.+)$/m.exec(fs.readFileSync(path.join(commandsDir, file), 'utf8'));
    if (!m) continue;
    const tools = m[1].split(/,\s*(?![^()]*\))/).map((t) => t.trim());
    for (const tool of tools) {
      const r = /^(Bash|PowerShell)\((.+)\)$/.exec(tool);
      if (r) assert.ok(tools.includes(`${r[1] === 'Bash' ? 'PowerShell' : 'Bash'}(${r[2]})`), `${file}: ${tool} has no twin`);
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

// The reporter only reads: subagents don't get a command's Edit/Write pre-approvals,
// so the main agent saves the report it returns.
test('foreman-reporter: read-only tools, path-only prompt from report.md', () => {
  const agent = fs.readFileSync(path.join(plugin, 'agents', 'foreman-reporter.md'), 'utf8');
  assert.match(agent, /^name: foreman-reporter$/m);
  assert.match(agent, /^model: \S+$/m);
  assert.match(agent, /^tools: Read, Grep, Glob$/m);
  const report = fs.readFileSync(path.join(commandsDir, 'report.md'), 'utf8');
  assert.match(report, /foreman:foreman-reporter/);
  for (const line of ['Plan:', 'Contract:', 'Tracking:', 'Doc:', 'Output:']) {
    assert.ok(report.includes(`   ${line} `) && agent.includes(`${line} <`), `prompt line ${line}`);
  }
  assert.match(report, /^allowed-tools: .*Write\(workbench\/reports\/\*\*\)/m, 'main agent saves the report');
});

// allowed-tools end with the user's next message, so a command must read every
// plugin file it needs before its first question and keep the turn with
// AskUserQuestion (rules.md "Questions and follow-up turns", issue #42).
test('rules.md explains questions and follow-up turns', () => {
  const text = fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8');
  assert.match(text, /^## Questions and follow-up turns$/m);
  assert.match(text, /\*\*Read first\.\*\*/);
  assert.match(text, /\*\*Ask with `AskUserQuestion`\.\*\*/);
});

test('commands that ask and write workbench/ allow AskUserQuestion', () => {
  for (const file of fs.readdirSync(commandsDir)) {
    const text = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    const m = /^allowed-tools:\s*(.+)$/m.exec(text);
    const asks = /\bask\b/i.test(text.slice(text.indexOf('\n---', 3)));
    if (m && asks && /(Edit|Write)\(workbench\/\*\*\)/.test(m[1])) assert.match(m[1], /\bAskUserQuestion\b/, file);
  }
});

test('templates are read before the question that precedes writing them', () => {
  const cases = [
    ['commands/new.md', 'Before asking, read the templates', 'ask for a resolution of each with `AskUserQuestion`'],
    ['commands/import.md', 'Before asking, read the templates', 'Ask the user with `AskUserQuestion` to confirm or correct'],
    ['commands/interview.md', 'read `${CLAUDE_PLUGIN_ROOT}/commands/new.md` and the templates', '## 3. Interview rounds'],
    ['reference/setup.md', 'Before asking anything, read `${CLAUDE_PLUGIN_ROOT}/templates/INDEX.md`', 'Ask the settings together'],
    ['commands/run.md', 'read `${CLAUDE_PLUGIN_ROOT}/commands/close.md` first', '"All tasks Done. Run /foreman:close P-NN now?"'],
  ];
  for (const [file, read, ask] of cases) {
    const text = fs.readFileSync(path.join(plugin, file), 'utf8');
    const r = text.indexOf(read);
    const q = text.indexOf(ask);
    assert.ok(r >= 0, `${file}: no read-first line`);
    assert.ok(q >= 0, `${file}: question not found`);
    assert.ok(r < q, `${file}: the read must come before the question`);
  }
});
