// #104: how much context each foreman command loads, with a budget per command.
// A command loads its own file plus every plugin file it names: rules and topic
// files, on-demand files, the vcs file (the largest of the three counts), the
// templates it reads, and plugin files those reference files point to. This is the
// worst case for one call. The always-loaded parts are the command, agent, and
// skill descriptions and the CLAUDE.md block template.
// Raise a budget only on purpose, in the same pull request that needs it.
// Run: node --test (sizes print as diagnostics: node --test tests/foreman/context-budget.test.js)

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const plugin = path.resolve(__dirname, '..', '..', 'plugins', 'foreman');
const ref = path.join(plugin, 'reference');
const size = (file) => fs.statSync(file).size;
const text = (file) => fs.readFileSync(file, 'utf8');
const tokens = (chars) => Math.round(chars / 4);

// Characters loaded at the start of each command (worst case), and the budgets.
// Set at the sizes after #103 and #102 plus about 10%.
const BUDGET = {
  approve: 23500,
  ask: 24500,
  cancel: 28500,
  catalog: 4000,
  change: 41500,
  close: 42000,
  doctor: 46500,
  hold: 28500,
  import: 56000,
  init: 37000,
  interview: 63000,
  map: 2000,
  new: 60500,
  report: 23500,
  resume: 23000,
  round: 61500,
  run: 70500,
  settings: 53000,
  status: 3000,
};
const ALWAYS_BUDGET = 2700; // descriptions of commands, agents, skills + CLAUDE.md block (2,425 now)

const vcsFiles = ['vcs-git.md', 'vcs-tfvc.md', 'vcs-none.md'].map((f) => path.join(ref, f));
const largestVcs = vcsFiles.reduce((a, b) => (size(a) >= size(b) ? a : b));
const templates = fs.readdirSync(path.join(plugin, 'templates'));

// Every plugin file a text names: ${CLAUDE_PLUGIN_ROOT}/... paths, `vcs-<value>.md` or
// "the vcs file", bare `<template>.md` names when it reads templates, and bare
// `<reference>.md` names (on-demand files "in this folder").
function named(body, isReference) {
  const out = new Set();
  // A reference file's own read instructions: "read `x.md`" or "read `x.md` and `y.md`".
  // Its other mentions (rules.md's template list, "is in `snapshot.md`") are pointers, not reads.
  if (isReference) {
    for (const m of body.matchAll(/read `([a-z-]+\.md)`(?: and `([a-z-]+\.md)`)?/g)) {
      for (const name of [m[1], m[2]].filter(Boolean)) if (fs.existsSync(path.join(ref, name))) out.add(path.join(ref, name));
    }
    return out;
  }
  for (const m of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./<>-]+\.(?:md|json))/g)) {
    const rel = m[1];
    if (rel.includes('<value>')) out.add(largestVcs);
    else if (fs.existsSync(path.join(plugin, rel))) out.add(path.join(plugin, rel));
  }
  if (/the vcs file/.test(body)) out.add(largestVcs);
  if (/template/i.test(body)) for (const t of templates) if (body.includes(`\`${t}\``)) out.add(path.join(plugin, 'templates', t));
  return out;
}

function loaded(command) {
  const file = path.join(plugin, 'commands', `${command}.md`);
  const seen = new Set([file]);
  const queue = [...named(text(file), false)];
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    if (f.startsWith(ref)) queue.push(...named(text(f), true));
  }
  return [...seen];
}

const commands = fs.readdirSync(path.join(plugin, 'commands')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));

test('every command has a context budget', () => {
  assert.deepStrictEqual(Object.keys(BUDGET).sort(), [...commands].sort(), 'add or remove the command in BUDGET');
});

test('context loaded per command stays within its budget', (t) => {
  const over = [];
  for (const c of commands) {
    const files = loaded(c);
    const chars = files.reduce((n, f) => n + size(f), 0);
    t.diagnostic(`${c.padEnd(10)} ${String(chars).padStart(6)} chars ~${String(tokens(chars)).padStart(5)} tokens (budget ${BUDGET[c]}) - ${files.map((f) => path.relative(plugin, f).replace(/\\/g, '/')).join(', ')}`);
    if (chars > BUDGET[c]) over.push(`${c}: loads ${chars} characters, budget ${BUDGET[c]}`);
  }
  assert.deepStrictEqual(over, [], 'make these smaller, or raise their budget on purpose');
});

test('always-loaded context stays within its budget', (t) => {
  const description = (file) => (/^description: (.+)$/m.exec(text(file)) || [, ''])[1].trim();
  const parts = {
    'command descriptions': commands.reduce((n, c) => n + description(path.join(plugin, 'commands', `${c}.md`)).length, 0),
    'agent descriptions': fs.readdirSync(path.join(plugin, 'agents')).reduce((n, a) => n + description(path.join(plugin, 'agents', a)).length, 0),
    'skill descriptions': fs.readdirSync(path.join(plugin, 'skills')).reduce((n, s) => n + description(path.join(plugin, 'skills', s, 'SKILL.md')).length, 0),
    'CLAUDE.md block': size(path.join(plugin, 'templates', 'claude-md.md')),
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(parts)) t.diagnostic(`${k}: ${v} chars`);
  t.diagnostic(`always loaded: ${total} chars ~${tokens(total)} tokens (budget ${ALWAYS_BUDGET})`);
  assert.ok(total <= ALWAYS_BUDGET, `always-loaded context is ${total} characters, budget ${ALWAYS_BUDGET}`);
});
