// e2e harness: builds a sample project from a fixture in e2e/.work/, then lets a
// scenario play a plugin's flow on it without a model - the plugin's own scripts and
// hooks run for real; the steps a command or agent would take are done by the
// scenario (file edits, status calls), and the results are checked.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const E2E = path.join(REPO, 'e2e');
const WORK = path.join(E2E, '.work');

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'e2e', GIT_AUTHOR_EMAIL: 'e2e@example.com',
  GIT_COMMITTER_NAME: 'e2e', GIT_COMMITTER_EMAIL: 'e2e@example.com',
  GIT_CONFIG_NOSYSTEM: '1',
};

// The Claude Code session the plugin's scripts see (as in a Bash tool call): fixed,
// so runs inside Claude Code and in CI behave the same. `Project.session` changes it.
const SESSION_ENV = { CLAUDE_CODE_SESSION_ID: 'e2e-session', CLAUDE_PID: String(process.pid) };

// Plugins that have e2e scenarios: e2e/<plugin>/scenarios/*.js.
function plugins() {
  return fs.readdirSync(E2E, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(E2E, d.name, 'scenarios')))
    .map((d) => d.name).sort();
}

function scenarios(plugin) {
  const dir = path.join(E2E, plugin, 'scenarios');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()
    .map((f) => ({ file: path.join(dir, f), id: f.slice(0, -3), ...require(path.join(dir, f)) }));
}

function rel(p) {
  return p.split(path.sep).join('/');
}

class Project {
  constructor(plugin, id, fixture) {
    this.plugin = plugin;
    this.pluginRoot = path.join(REPO, 'plugins', plugin);
    this.dir = path.join(WORK, plugin, id);
    this.steps = [];
    this.sessionEnv = { ...SESSION_ENV };
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    if (fixture) fs.cpSync(path.join(E2E, plugin, 'fixtures', fixture), this.dir, { recursive: true });
    this.git('init', '-q', '-b', 'main');
    this.git('config', 'core.autocrlf', 'false');
    this.git('add', '-A');
    this.git('commit', '-q', '--allow-empty', '-m', 'fixture');
    // Fixture files may say E2E_BASELINE where a commit hash belongs (e.g. task baselines).
    const head = this.git('log', '-1', '--format=%H');
    const marked = this.files().filter((f) => !f.startsWith('.git/') && this.read(f).includes('E2E_BASELINE'));
    for (const f of marked) this.write(f, this.read(f).split('E2E_BASELINE').join(head));
    if (marked.length) this.commit('baselines');
    this.base = head;
  }

  step(text) {
    this.steps.push(text);
  }

  // Runs fn as another Claude Code session (id, process id), then switches back.
  session(id, pid, fn) {
    const saved = this.sessionEnv;
    this.sessionEnv = { CLAUDE_CODE_SESSION_ID: id, CLAUDE_PID: String(pid) };
    try { return fn(); } finally { this.sessionEnv = saved; }
  }

  path(p) {
    return path.join(this.dir, p);
  }

  exists(p) {
    return fs.existsSync(this.path(p));
  }

  read(p) {
    return fs.readFileSync(this.path(p), 'utf8');
  }

  write(p, text) {
    fs.mkdirSync(path.dirname(this.path(p)), { recursive: true });
    fs.writeFileSync(this.path(p), text);
  }

  // Replaces `from` (string or RegExp) in a file; fails when it does not match.
  edit(p, from, to) {
    const text = this.read(p);
    const hit = typeof from === 'string' ? text.includes(from) : from.test(text);
    if (!hit) throw new Error(`${p}: no match for ${from}`);
    this.write(p, text.replace(from, to));
  }

  remove(p) {
    fs.rmSync(this.path(p), { recursive: true, force: true });
  }

  // Files under `dir` (relative, '/' separated), recursively.
  files(dir = '.') {
    const out = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(this.path(d), { withFileTypes: true })) {
        if (e.name === '.git') continue;
        const r = d === '.' ? e.name : `${d}/${e.name}`;
        if (e.isDirectory()) walk(r);
        else out.push(r);
      }
    };
    walk(dir);
    return out.sort();
  }

  run(cmd, args, opts = {}) {
    const res = spawnSync(cmd, args, {
      cwd: this.dir, encoding: 'utf8', input: opts.input,
      env: { ...process.env, ...GIT_ENV, ...this.sessionEnv, CLAUDE_PROJECT_DIR: this.dir, CLAUDE_PLUGIN_ROOT: this.pluginRoot, ...opts.env },
    });
    if (res.error) throw res.error;
    return { code: res.status, out: `${res.stdout || ''}`.trim(), err: `${res.stderr || ''}`.trim() };
  }

  git(...args) {
    const r = this.run('git', args);
    if (r.code !== 0) throw new Error(`git ${args.join(' ')}: ${r.err || r.out}`);
    return r.out;
  }

  commit(message) {
    this.git('add', '-A');
    this.git('commit', '-q', '-m', message);
    return this.git('log', '-1', '--format=%H');
  }

  // Runs a script of the plugin: node plugins/<plugin>/<script> ...args.
  script(script, ...args) {
    return this.run(process.execPath, [path.join(this.pluginRoot, script), ...args]);
  }

  // Runs a hook script with a JSON input; returns { code, out, json }.
  hook(script, input = {}) {
    const r = this.run(process.execPath, [path.join(this.pluginRoot, 'hooks', script)], {
      input: JSON.stringify({ cwd: this.dir, ...input }),
    });
    let json = null;
    try { json = r.out ? JSON.parse(r.out) : null; } catch { json = { raw: r.out }; }
    return { ...r, json };
  }

  // Runs the project's node:test specs (node --test <patterns>); returns { code, out }.
  test(...patterns) {
    return this.run(process.execPath, ['--test', ...patterns]);
  }
}

// Everything a plugin provides that an e2e scenario must cover: command:<name>,
// agent:<name>, skill:<name>, hook:<script name>, plus what e2e/<plugin>/components.js
// adds (e.g. foreman's wb:<subcommand>).
function components(plugin) {
  const root = path.join(REPO, 'plugins', plugin);
  const list = (dir, re) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)) : [])
    .map((f) => re.exec(f)).filter(Boolean).map((m) => m[1]);
  const out = [
    ...list('commands', /^(.+)\.md$/).map((n) => `command:${n}`),
    ...list('agents', /^(.+)\.md$/).map((n) => `agent:${n}`),
    ...list('skills', /^([^.]+)$/).map((n) => `skill:${n}`),
  ];
  const hooksFile = path.join(root, 'hooks', 'hooks.json');
  if (fs.existsSync(hooksFile)) {
    const scripts = new Set(fs.readFileSync(hooksFile, 'utf8').match(/hooks\/[\w-]+\.js/g) || []);
    for (const s of scripts) out.push(`hook:${path.basename(s, '.js')}`);
  }
  const extra = path.join(E2E, plugin, 'components.js');
  if (fs.existsSync(extra)) out.push(...require(extra)(root));
  return [...new Set(out)].sort();
}

// Runs one scenario; returns { ok, error, steps, dir }.
function runScenario(plugin, s) {
  const p = new Project(plugin, s.id, s.fixture);
  if (s.setup) s.setup(p);
  try {
    s.run(p, require('node:assert'));
    return { ok: true, steps: p.steps, dir: p.dir };
  } catch (error) {
    return { ok: false, error, steps: p.steps, dir: p.dir };
  }
}

module.exports = { REPO, E2E, WORK, Project, plugins, scenarios, runScenario, components, rel };
