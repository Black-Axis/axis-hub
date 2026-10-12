#!/usr/bin/env node
// #104 / #116: how much context each foreman command loads, with a budget per command.
// A command loads its own file plus every plugin file it names: rules and topic
// files, on-demand files, the vcs file (the largest of the three counts), the
// templates it reads, and plugin files those reference files point to. This is the
// worst case for one call. The always-loaded parts are the command, agent, and
// skill descriptions and the CLAUDE.md block template. Sizes are bytes with LF line
// endings, so Windows checkouts (CRLF) and CI measure the same.
// tests/foreman/context-budget.test.js fails above a budget. Raise a budget only on
// purpose, in the same pull request that needs it; a new command needs an entry.
// Usage: node scripts/context-budget.js [--base <ref>]
//   Prints only commands over 95% of their budget (NEAR), and with --base the commands whose
//   size changed against <ref> (read through git, nothing checked out) with the files
//   that changed; `context budget: ok` when there is nothing to show.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const PLUGIN = 'plugins/foreman';

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
const ALWAYS_BUDGET = 2700; // descriptions of commands, agents, skills + CLAUDE.md block
// Shown as near budget above this share. Budgets are about 10% above the sizes they
// were set at (~91% used), so 95% shows only what grew since.
const NEAR = 0.95;

// Plugin file access, paths relative to the plugin root with `/`: the working tree.
function treeReader(root = path.join(REPO, PLUGIN)) {
  const abs = (rel) => path.join(root, rel);
  return {
    text: (rel) => fs.readFileSync(abs(rel), 'utf8').replace(/\r\n/g, '\n'),
    exists: (rel) => fs.existsSync(abs(rel)),
    list: (rel) => fs.readdirSync(abs(rel)),
  };
}

// The same access on a git revision, read with git (nothing checked out).
function gitReader(ref, repo = REPO) {
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const spec = (rel) => `${ref}:${PLUGIN}/${rel}`;
  const cache = new Map();
  return {
    text: (rel) => {
      if (!cache.has(rel)) cache.set(rel, git('show', spec(rel)).replace(/\r\n/g, '\n'));
      return cache.get(rel);
    },
    exists: (rel) => {
      try {
        git('cat-file', '-e', spec(rel));
        return true;
      } catch {
        return false;
      }
    },
    list: (rel) => git('ls-tree', '--name-only', spec(rel)).split('\n').filter(Boolean),
  };
}

// { commands: { <name>: { size, files: { <rel>: size } } }, always: { parts, total } } for one reader.
function measure(r) {
  const size = (rel) => Buffer.byteLength(r.text(rel));
  const vcs = ['vcs-git.md', 'vcs-tfvc.md', 'vcs-none.md'].map((f) => `reference/${f}`).filter(r.exists);
  const largestVcs = vcs.reduce((a, b) => (size(a) >= size(b) ? a : b));
  const templates = r.list('templates');

  // Every plugin file a text names: ${CLAUDE_PLUGIN_ROOT}/... paths, `vcs-<value>.md` or
  // "the vcs file", bare `<template>.md` names when it reads templates. A reference
  // file counts only its own read instructions ("read `x.md`" or "read `x.md` and
  // `y.md`"); its other mentions are pointers, not reads.
  function named(body, isReference) {
    const out = new Set();
    if (isReference) {
      for (const m of body.matchAll(/read `([a-z-]+\.md)`(?: and `([a-z-]+\.md)`)?/g)) {
        for (const name of [m[1], m[2]].filter(Boolean)) if (r.exists(`reference/${name}`)) out.add(`reference/${name}`);
      }
      return out;
    }
    for (const m of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./<>-]+\.(?:md|json))/g)) {
      if (m[1].includes('<value>')) out.add(largestVcs);
      else if (r.exists(m[1])) out.add(m[1]);
    }
    if (/the vcs file/.test(body)) out.add(largestVcs);
    if (/template/i.test(body)) for (const t of templates) if (body.includes(`\`${t}\``)) out.add(`templates/${t}`);
    return out;
  }

  function loaded(command) {
    const seen = new Set([`commands/${command}.md`]);
    const queue = [...named(r.text(`commands/${command}.md`), false)];
    while (queue.length) {
      const f = queue.shift();
      if (seen.has(f)) continue;
      seen.add(f);
      if (f.startsWith('reference/')) queue.push(...named(r.text(f), true));
    }
    return [...seen];
  }

  const commands = {};
  for (const c of r.list('commands').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3))) {
    const files = {};
    for (const f of loaded(c)) files[f] = size(f);
    commands[c] = { size: Object.values(files).reduce((a, b) => a + b, 0), files };
  }
  const description = (rel) => (/^description: (.+)$/m.exec(r.text(rel)) || [, ''])[1].trim().length;
  const parts = {
    'command descriptions': Object.keys(commands).reduce((n, c) => n + description(`commands/${c}.md`), 0),
    'agent descriptions': r.list('agents').reduce((n, a) => n + description(`agents/${a}`), 0),
    'skill descriptions': r.list('skills').reduce((n, s) => n + description(`skills/${s}/SKILL.md`), 0),
    'CLAUDE.md block': size('templates/claude-md.md'),
  };
  return { commands, always: { parts, total: Object.values(parts).reduce((a, b) => a + b, 0) } };
}

const pct = (n, budget) => `${Math.round((n / budget) * 100)}%`;
const signed = (n) => (n > 0 ? `+${n}` : String(n));

// The report lines: commands over NEAR of their budget, and with a base the changed ones.
function report(now, base) {
  const lines = [];
  for (const [c, { size, files }] of Object.entries(now.commands)) {
    const budget = BUDGET[c];
    const old = base && base.commands[c];
    const changed = base && (!old || old.size !== size);
    if (!(budget === undefined || size > budget * NEAR || changed)) continue;
    let line = `${c}: ${size}/${budget ?? 'no budget'}${budget ? ` (${pct(size, budget)})` : ''}`;
    if (changed) {
      line += old ? ` ${signed(size - old.size)} vs base` : ' new';
      const grew = Object.entries(files).filter(([f, s]) => !old || old.files[f] !== s).map(([f, s]) => `${f} ${old && old.files[f] !== undefined ? signed(s - old.files[f]) : `+${s}`}`);
      const gone = old ? Object.keys(old.files).filter((f) => !(f in files)).map((f) => `${f} -${old.files[f]}`) : [];
      if (grew.length || gone.length) line += ` - ${[...grew, ...gone].join(', ')}`;
    }
    lines.push(line);
  }
  if (base) for (const c of Object.keys(base.commands)) if (!(c in now.commands)) lines.push(`${c}: removed`);
  const t = now.always.total;
  const tChanged = base && base.always.total !== t;
  if (t > ALWAYS_BUDGET * NEAR || tChanged) lines.push(`always loaded: ${t}/${ALWAYS_BUDGET} (${pct(t, ALWAYS_BUDGET)})${tChanged ? ` ${signed(t - base.always.total)} vs base` : ''}`);
  return lines.length ? lines : ['context budget: ok'];
}

function main(argv) {
  let base = null;
  if (argv[0] === '--base' && argv[1] && argv.length === 2) base = argv[1];
  else if (argv.length) {
    console.error('usage: node scripts/context-budget.js [--base <ref>]');
    return 1;
  }
  try {
    const now = measure(treeReader());
    const old = base ? measure(gitReader(base)) : null;
    console.log(report(now, old).join('\n'));
    return 0;
  } catch (e) {
    console.error(`context-budget: ${String(e.message).split('\n')[0]}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { BUDGET, ALWAYS_BUDGET, treeReader, gitReader, measure, report };
