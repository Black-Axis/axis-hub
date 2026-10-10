#!/usr/bin/env node
// Paid live check: runs one prompt with `claude -p` and a plugin loaded from this
// repository, in a scratch project outside the repository, and prints a short summary.
// Usage: node scripts/live-check.js <check> --prompt-file <file> [--plugin foreman]
//          [--fixture notes-api|none] [--model haiku] [--budget 0.10] [--continue]
// The scratch project is <OS temp>/axis-live-check/<check>/: wiped and built from the
// e2e fixture (a fresh git repo) unless --continue, which keeps it and continues the
// last session there. The full JSON result is saved next to it as <check>.json.
// Output: `<check>: <subtype> - turns <n> - $<cost> - denials <n>`, one `denied:` line
// per permission denial, a `result:` line, and the scratch path. Exit 1 on a bad
// argument or when claude returns no JSON.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const ROOT = path.join(os.tmpdir(), 'axis-live-check');
const DEFAULTS = { plugin: 'foreman', fixture: 'notes-api', model: 'haiku', budget: '0.10' };
const FLAGS = { '--prompt-file': 'promptFile', '--plugin': 'plugin', '--fixture': 'fixture', '--model': 'model', '--budget': 'budget' };

// Returns { check, promptFile, plugin, fixture, model, budget, cont } or { error }.
function parseArgs(argv) {
  const opts = { ...DEFAULTS, check: null, promptFile: null, cont: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (FLAGS[a]) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) return { error: `${a} needs a value` };
      opts[FLAGS[a]] = v;
    } else if (a === '--continue') {
      opts.cont = true;
    } else if (/^[a-z0-9-]+$/.test(a) && opts.check === null) {
      opts.check = a;
    } else {
      return { error: `unknown argument: ${a}` };
    }
  }
  if (opts.check === null) return { error: 'missing check name (lowercase, digits, hyphens)' };
  if (!opts.promptFile) return { error: 'missing --prompt-file' };
  if (!/^\d+(\.\d+)?$/.test(opts.budget)) return { error: `--budget must be a dollar amount, not ${opts.budget}` };
  if (!/^[a-z0-9-]+$/.test(opts.plugin) || !/^[a-z0-9-]+$/.test(opts.fixture)) return { error: 'bad --plugin or --fixture name' };
  return opts;
}

// The `claude -p` arguments for a check.
function claudeArgs(opts, prompt) {
  const args = ['-p', prompt, '--output-format', 'json', '--plugin-dir', path.join(REPO, 'plugins', opts.plugin),
    '--model', opts.model, '--max-budget-usd', opts.budget];
  if (opts.cont) args.push('--continue');
  return args;
}

// The summary lines of a `claude -p --output-format json` result.
function summarize(check, json) {
  const denials = json.permission_denials || [];
  const cost = typeof json.total_cost_usd === 'number' ? json.total_cost_usd.toFixed(4) : '?';
  const lines = [`${check}: ${json.subtype || json.type || '?'}${json.is_error ? ' (error)' : ''} - turns ${json.num_turns ?? '?'} - $${cost} - denials ${denials.length}`];
  for (const d of denials) lines.push(`denied: ${d.tool_name} ${JSON.stringify(d.tool_input || {}).slice(0, 160)}`);
  const result = String(json.result || '').replace(/\s+/g, ' ').trim();
  lines.push(`result: ${result.length > 400 ? `${result.slice(0, 400)}...` : result}`);
  return lines;
}

// Builds the scratch project: the fixture as a fresh git repo, E2E_BASELINE replaced by the first commit.
function buildProject(dir, opts) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  if (opts.fixture !== 'none') {
    const src = path.join(REPO, 'e2e', opts.plugin, 'fixtures', opts.fixture);
    if (!fs.existsSync(src)) throw new Error(`no fixture ${opts.plugin}/${opts.fixture}`);
    fs.cpSync(src, dir, { recursive: true });
  }
  const git = (...args) => execFileSync('git', ['-c', 'user.name=live-check', '-c', 'user.email=live-check@example.invalid', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', 'fixture');
  const head = git('log', '-1', '--format=%H');
  let marked = [];
  try {
    marked = git('grep', '-l', 'E2E_BASELINE').split('\n').filter(Boolean);
  } catch {
    // git grep exits 1 when nothing matches
  }
  for (const f of marked) {
    const file = path.join(dir, f);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split('E2E_BASELINE').join(head));
  }
  if (marked.length) {
    git('add', '-A');
    git('commit', '-q', '-m', 'baselines');
  }
}

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.error) {
    console.error(`live-check: ${opts.error}`);
    return 1;
  }
  const dir = path.join(ROOT, opts.check);
  try {
    const prompt = fs.readFileSync(opts.promptFile, 'utf8');
    if (!opts.cont || !fs.existsSync(dir)) buildProject(dir, opts);
    const r = spawnSync('claude', claudeArgs(opts, prompt), { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let json;
    try {
      json = JSON.parse(r.stdout);
    } catch {
      const last = `${r.stderr || ''}${r.stdout || ''}`.trim().split(/\r?\n/).pop() || (r.error && r.error.message) || `exit ${r.status}`;
      console.error(`live-check: ${opts.check}: no JSON from claude - ${last}`);
      return 1;
    }
    fs.writeFileSync(path.join(ROOT, `${opts.check}.json`), JSON.stringify(json, null, 2));
    console.log([...summarize(opts.check, json), `scratch: ${dir}`].join('\n'));
    return 0;
  } catch (e) {
    console.error(`live-check: ${opts.check}: ${e.message.split('\n')[0]}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { parseArgs, claudeArgs, summarize, buildProject, ROOT };
