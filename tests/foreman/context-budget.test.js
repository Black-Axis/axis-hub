// #104: how much context each foreman command loads, with a budget per command.
// The measuring and the budgets are in scripts/context-budget.js (what counts as
// loaded is described there). Raise a budget only on purpose, in the same pull
// request that needs it; a new command needs an entry.
// Run: node --test (sizes print as diagnostics: node --test tests/foreman/context-budget.test.js;
// only what is near budget or changed: node scripts/context-budget.js --base main)

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { BUDGET, ALWAYS_BUDGET, treeReader, gitReader, measure, report } = require('../../scripts/context-budget.js');

const now = measure(treeReader());
const tokens = (chars) => Math.round(chars / 4);

test('every command has a context budget', () => {
  assert.deepStrictEqual(Object.keys(BUDGET).sort(), Object.keys(now.commands).sort(), 'add or remove the command in BUDGET (scripts/context-budget.js)');
});

test('context loaded per command stays within its budget', (t) => {
  const over = [];
  for (const [c, { size, files }] of Object.entries(now.commands)) {
    t.diagnostic(`${c.padEnd(10)} ${String(size).padStart(6)} chars ~${String(tokens(size)).padStart(5)} tokens (budget ${BUDGET[c]}) - ${Object.keys(files).join(', ')}`);
    if (size > BUDGET[c]) over.push(`${c}: loads ${size} characters, budget ${BUDGET[c]}`);
  }
  assert.deepStrictEqual(over, [], 'make these smaller, or raise their budget on purpose');
});

test('always-loaded context stays within its budget', (t) => {
  for (const [k, v] of Object.entries(now.always.parts)) t.diagnostic(`${k}: ${v} chars`);
  t.diagnostic(`always loaded: ${now.always.total} chars ~${tokens(now.always.total)} tokens (budget ${ALWAYS_BUDGET})`);
  assert.ok(now.always.total <= ALWAYS_BUDGET, `always-loaded context is ${now.always.total} characters, budget ${ALWAYS_BUDGET}`);
});

test('report: only commands near budget or changed, with the changed files', () => {
  const m = (size, files) => ({ size, files });
  const always = { parts: {}, total: 100 };
  const cur = { commands: { status: m(1000, { 'commands/status.md': 1000 }), run: m(70000, { 'commands/run.md': 20000, 'reference/rules.md': 50000 }), map: m(1920, { 'commands/map.md': 1920 }), new: m(54855, { 'commands/new.md': 54855 }) }, always };
  assert.deepStrictEqual(report(cur, null), ['run: 70000/70500 (99%)', 'map: 1920/2000 (96%)'], 'not new at 91%');
  const base = { commands: { status: m(900, { 'commands/status.md': 900 }), run: m(70000, { 'commands/run.md': 20000, 'reference/rules.md': 50000 }), map: m(1920, { 'commands/map.md': 1920 }), new: m(54855, { 'commands/new.md': 54855 }), old: m(10, { 'commands/old.md': 10 }) }, always: { parts: {}, total: 90 } };
  assert.deepStrictEqual(report(cur, base), [
    'status: 1000/3000 (33%) +100 vs base - commands/status.md +100',
    'run: 70000/70500 (99%)',
    'map: 1920/2000 (96%)',
    'old: removed',
    'always loaded: 100/2700 (4%) +10 vs base',
  ]);
  const small = { commands: { status: m(1000, { 'commands/status.md': 1000 }) }, always };
  assert.deepStrictEqual(report(small, small), ['context budget: ok']);
});

test('measure works on a plugin without vcs files (a base revision from before them)', () => {
  const files = {
    'commands/run.md': '---\ndescription: Run\n---\nRead `${CLAUDE_PLUGIN_ROOT}/reference/vcs-<value>.md`, then the vcs file.\n',
    'templates/claude-md.md': 'block',
  };
  const r = {
    text: (rel) => files[rel],
    exists: (rel) => rel in files,
    list: (rel) => (rel === 'commands' ? ['run.md'] : []),
  };
  const m = measure(r);
  assert.deepStrictEqual(Object.keys(m.commands.run.files), ['commands/run.md']);
});

test('the git reader on HEAD measures what the tree measures when nothing is changed', () => {
  // A throwaway clone of HEAD: the working tree there is HEAD, so both readers must agree.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axis-context-budget-'));
  try {
    execFileSync('git', ['clone', '-q', '--no-hardlinks', path.resolve(__dirname, '..', '..'), dir], { stdio: 'ignore' });
    const tree = measure(treeReader(path.join(dir, 'plugins', 'foreman')));
    const git = measure(gitReader('HEAD', dir));
    assert.deepStrictEqual(git, tree);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
