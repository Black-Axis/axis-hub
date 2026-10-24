#!/usr/bin/env node
// #120: the steps of a marketplace release, for the /axis-release skill.
// Usage:
//   node scripts/release.js status [X.Y.Z]
//     One line each: the phase (prepare / tag / close / none), the branch, the
//     milestone's open issues, the versions, the last tag. The marketplace version is
//     the open milestone `vX.Y.Z` (the lowest above metadata.version), flagged when the
//     change types need a bigger bump; plugin versions are proposed from the change
//     types under Unreleased (Removed = major, Added = minor, anything else = patch).
//   node scripts/release.js prepare X.Y.Z [<plugin>=X.Y.Z ...] [--date YYYY-MM-DD]
//     Sets metadata.version, the given plugins' versions (both manifests, root README
//     table, plugin README Version line), renames Unreleased to `[X.Y.Z] - date` in the
//     root and those plugins' changelogs (new empty Unreleased above), and sets the
//     root `### <plugin> X.Y.Z` headings. Every plugin with Unreleased entries needs a
//     version. All files or none (also when the release notes then fail); each keeps
//     its line endings.
//   node scripts/release.js tag X.Y.Z
//     On a clean `main` equal to GitHub's, with no open milestone issues and valid
//     release notes: creates the annotated tag vX.Y.Z and pushes only that tag to the
//     remote whose URL is Black-Axis/axis-hub (never a remote name).
//   node scripts/release.js close X.Y.Z
//     Closes the milestone vX.Y.Z once its GitHub release exists and no issue is open.
// Errors print `release: <reason>` and exit 1 without changing anything.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { changelogSection, releaseNotes } = require('../.github/scripts/release-notes.js');

const ROOT = path.resolve(__dirname, '..');
const REPO = 'Black-Axis/axis-hub';
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const KINDS = ['patch', 'minor', 'major'];

const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');

// The lines under `## [Unreleased]` up to the next `## ` heading, or null without one.
function unreleasedLines(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^## \[Unreleased\]/i.test(l));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end === -1) end = lines.length;
  return lines.slice(start + 1, end);
}

// Root changelog Unreleased: Map area ('Marketplace' or plugin name) -> Set of change types.
function rootAreas(text) {
  const areas = new Map();
  let area = null;
  for (const line of unreleasedLines(text) || []) {
    const a = /^### (\S+)/.exec(line);
    const t = /^#### (\S+)/.exec(line);
    if (a) areas.set(area = a[1], areas.get(a[1]) || new Set());
    else if (t && area) areas.get(area).add(t[1]);
  }
  return areas;
}

// Plugin changelog Unreleased: Set of change types (`### Added` ...).
function pluginTypes(text) {
  return new Set((unreleasedLines(text) || []).map((l) => /^### (\S+)/.exec(l)).filter(Boolean).map((m) => m[1]));
}

// The bump a set of change types needs: major, minor, patch, or null when empty.
function bumpOf(types) {
  if (!types || !types.size) return null;
  if (types.has('Removed')) return 'major';
  if (types.has('Added')) return 'minor';
  return 'patch';
}

function bump(version, kind) {
  const [, a, b, c] = SEMVER.exec(version).map(Number);
  if (kind === 'major') return `${a + 1}.0.0`;
  if (kind === 'minor') return `${a}.${b + 1}.0`;
  return `${a}.${b}.${c + 1}`;
}

// -1, 0, 1 like a sort comparator.
function compare(x, y) {
  const a = SEMVER.exec(x).slice(1).map(Number);
  const b = SEMVER.exec(y).slice(1).map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
  return 0;
}

// Proposed versions. `files` = { marketplace (parsed), root (text), plugins: { name: changelog text } }.
// Returns { marketplace: { from, to, kind, types }, plugins: [{ name, from, to, kind, types }] }.
function propose(files) {
  const areas = rootAreas(files.root);
  const plugins = files.marketplace.plugins.map((p) => {
    const types = new Set([...(areas.get(p.name) || []), ...pluginTypes(files.plugins[p.name] || '')]);
    const kind = bumpOf(types);
    return { name: p.name, from: p.version, to: kind ? bump(p.version, kind) : null, kind, types: [...types] };
  });
  const all = new Set([...areas.values()].flatMap((s) => [...s]));
  const kinds = [bumpOf(areas.get('Marketplace')), ...plugins.map((p) => p.kind), bumpOf(all)].filter(Boolean);
  const kind = kinds.sort((x, y) => KINDS.indexOf(y) - KINDS.indexOf(x))[0] || null;
  const from = files.marketplace.metadata.version;
  return { marketplace: { from, to: kind ? bump(from, kind) : null, kind, types: [...all] }, plugins };
}

// Renames `## [Unreleased]` to `## [version] - date` with a new empty Unreleased above,
// and in the root changelog sets each `### <plugin> X.Y.Z` heading of that section.
function releaseChangelog(text, version, date, pluginVersions = {}) {
  const eol = eolOf(text);
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^## \[Unreleased\]/i.test(l));
  if (start === -1) return { error: 'no "## [Unreleased]" section' };
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end === -1) end = lines.length;
  if (!lines.slice(start + 1, end).some((l) => l.trim())) return { error: 'the Unreleased section is empty' };
  for (let i = start + 1; i < end; i++) {
    const m = /^### (\S+) \d+\.\d+\.\d+$/.exec(lines[i]);
    if (m && pluginVersions[m[1]]) lines[i] = `### ${m[1]} ${pluginVersions[m[1]]}`;
  }
  lines.splice(start, 1, '## [Unreleased]', '', `## [${version}] - ${date}`);
  return { text: lines.join(eol) };
}

// Replaces the first `"version": "<from>"` after the first match of `anchor` (a string).
function setJsonVersion(text, anchor, from, to) {
  const at = text.indexOf(anchor);
  if (at === -1) return { error: `no ${anchor}` };
  const needle = `"version": "${from}"`;
  const i = text.indexOf(needle, at);
  if (i === -1) return { error: `no ${needle} after ${anchor}` };
  return { text: text.slice(0, i) + `"version": "${to}"` + text.slice(i + needle.length) };
}

// Sets a plugin's version in its root README table row.
function setReadmeRow(text, name, from, to) {
  const eol = eolOf(text);
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith('|') && l.includes(`[${name}](`));
  if (i === -1) return { error: `no ${name} row in the README table` };
  const cells = lines[i].split('|');
  if (cells[2].trim() !== from) return { error: `README table shows ${cells[2].trim()} for ${name}, expected ${from}` };
  cells[2] = cells[2].replace(from, to);
  lines[i] = cells.join('|');
  return { text: lines.join(eol) };
}

function setVersionLine(text, from, to) {
  if (!text.includes(`Version ${from} `)) return { error: `no "Version ${from} " line` };
  return { text: text.replace(`Version ${from} `, `Version ${to} `) };
}

// All release edits in memory. `read(rel)` returns a file's text. `versions` = { name: X.Y.Z }.
// Returns { files: { rel: text } } or { error }.
function prepareEdits(read, version, versions, date) {
  if (!SEMVER.test(version || '')) return { error: `not a version: ${version}` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { error: `not a date: ${date}` };
  const marketplaceText = read('.claude-plugin/marketplace.json');
  const marketplace = JSON.parse(marketplaceText);
  const current = marketplace.metadata.version;
  if (compare(version, current) <= 0) return { error: `${version} is not above metadata.version ${current}` };
  const root = read('CHANGELOG.md');
  const pluginLogs = {};
  for (const p of marketplace.plugins) pluginLogs[p.name] = read(path.posix.join(p.source.replace(/^\.\//, ''), 'CHANGELOG.md'));
  const proposal = propose({ marketplace, root, plugins: pluginLogs });
  for (const name of Object.keys(versions)) {
    const p = proposal.plugins.find((x) => x.name === name);
    if (!p) return { error: `no plugin ${name}` };
    if (!SEMVER.test(versions[name])) return { error: `not a version: ${name}=${versions[name]}` };
    if (!p.kind) return { error: `${name} has no Unreleased entries` };
    if (compare(versions[name], p.from) <= 0) return { error: `${name}=${versions[name]} is not above ${p.from}` };
  }
  const missing = proposal.plugins.filter((p) => p.kind && !versions[p.name]).map((p) => p.name);
  if (missing.length) return { error: `Unreleased entries need a version: ${missing.map((n) => `${n}=X.Y.Z`).join(' ')}` };

  const out = {};
  const step = (rel, result) => {
    if (result.error) throw new Error(`${rel}: ${result.error}`);
    out[rel] = result.text;
  };
  try {
    let mText = setJsonVersion(marketplaceText, '"metadata"', current, version);
    for (const [name, to] of Object.entries(versions)) {
      if (mText.error) break;
      const p = marketplace.plugins.find((x) => x.name === name);
      mText = setJsonVersion(mText.text, `"name": "${name}"`, p.version, to);
    }
    step('.claude-plugin/marketplace.json', mText);
    step('CHANGELOG.md', releaseChangelog(root, version, date, versions));
    let readme = { text: read('README.md') };
    for (const [name, to] of Object.entries(versions)) {
      const p = marketplace.plugins.find((x) => x.name === name);
      const dir = p.source.replace(/^\.\//, '');
      step(`${dir}/.claude-plugin/plugin.json`, setJsonVersion(read(`${dir}/.claude-plugin/plugin.json`), '"name"', p.version, to));
      step(`${dir}/README.md`, setVersionLine(read(`${dir}/README.md`), p.version, to));
      step(`${dir}/CHANGELOG.md`, releaseChangelog(pluginLogs[name], to, date));
      readme = setReadmeRow(readme.text, name, p.version, to);
      if (readme.error) break;
    }
    step('README.md', readme);
  } catch (e) {
    return { error: e.message };
  }
  if (!changelogSection(out['CHANGELOG.md'], version)) return { error: `CHANGELOG.md: no [${version}] section after the rename` };
  return { files: out };
}

// The remote to push to: the one whose push URL is Black-Axis/axis-hub, preferring
// `preferred` (main's upstream remote) when several match. `remoteV` = `git remote -v` output.
function pushRemote(remoteV, preferred) {
  const names = [...new Set(String(remoteV).split(/\r?\n/)
    .map((l) => /^(\S+)\s+(\S+)\s+\(push\)$/.exec(l.trim()))
    .filter((m) => m && /[/:]Black-Axis\/axis-hub(\.git)?\/?$/i.test(m[2]))
    .map((m) => m[1]))];
  if (!names.length) return null;
  return names.includes(preferred) ? preferred : names[0];
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
const git = (...args) => run('git', args);
const gh = (...args) => run('gh', args);

// gh api call that returns null on a 404.
function ghMaybe(...args) {
  try {
    return gh('api', ...args);
  } catch (e) {
    if (/404|Not Found/i.test(`${e.stderr || ''}${e.message}`)) return null;
    throw e;
  }
}

const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const milestones = (state) => JSON.parse(gh('api', `repos/${REPO}/milestones?state=${state}&per_page=100`));

function milestone(version) {
  return milestones('all').find((m) => m.title === `v${version}`) || null;
}

// The release version from the milestone titles: the lowest `vX.Y.Z` above `current`, or null.
function milestoneVersion(titles, current) {
  return titles.map((t) => /^v(\d+\.\d+\.\d+)$/.exec(t)).filter(Boolean).map((m) => m[1])
    .filter((v) => compare(v, current) > 0).sort(compare)[0] || null;
}

// The release phase. A released metadata.version without its tag (or with its milestone
// still open) comes first, also when new entries landed under Unreleased after the merge.
// `closable()` = the GitHub release exists and the milestone is open (asked only when tagged).
function phaseOf({ hasUnreleased, tagged, hasSection, closable }) {
  if (!tagged && hasSection) return 'tag';
  if (tagged && closable()) return 'close';
  return hasUnreleased ? 'prepare' : 'none';
}

// The bump kind from one version to the next (major, minor, patch).
function kindOf(from, to) {
  const a = SEMVER.exec(from).slice(1).map(Number);
  const b = SEMVER.exec(to).slice(1).map(Number);
  return b[0] !== a[0] ? 'major' : b[1] !== a[1] ? 'minor' : 'patch';
}

function openIssues(number) {
  const list = JSON.parse(gh('api', `repos/${REPO}/issues?milestone=${number}&state=open&per_page=100`));
  return list.filter((i) => !i.pull_request).map((i) => `#${i.number}`);
}

const remoteTag = (version) => ghMaybe(`repos/${REPO}/git/ref/tags/v${version}`) !== null;
const ghRelease = (version) => ghMaybe(`repos/${REPO}/releases/tags/v${version}`) !== null;

function readFiles() {
  const marketplace = JSON.parse(readRel('.claude-plugin/marketplace.json'));
  const plugins = {};
  for (const p of marketplace.plugins) plugins[p.name] = readRel(path.posix.join(p.source.replace(/^\.\//, ''), 'CHANGELOG.md'));
  return { marketplace, root: readRel('CHANGELOG.md'), plugins };
}

function status(arg) {
  const files = readFiles();
  const proposal = propose(files);
  const current = files.marketplace.metadata.version;
  const hasUnreleased = (unreleasedLines(files.root) || []).some((l) => l.trim());
  const tagged = remoteTag(current);
  const phase = phaseOf({
    hasUnreleased,
    tagged,
    hasSection: !!changelogSection(files.root, current),
    closable: () => ghRelease(current) && (milestone(current) || {}).state === 'open',
  });
  const fromMilestone = phase === 'prepare' && !arg ? milestoneVersion(milestones('open').map((m) => m.title), current) : null;
  const version = arg || (phase === 'prepare' ? fromMilestone : current);
  const branch = git('branch', '--show-current');
  const dirty = git('status', '--porcelain') ? 'uncommitted changes' : 'clean';
  const lines = [`phase: ${phase}`, `branch: ${branch} (${dirty})`];
  if (version) {
    const m = milestone(version);
    lines.push(m ? `milestone v${version}: ${m.state}, open issues: ${openIssues(m.number).join(' ') || 'none'}` : `milestone v${version}: not found`);
  } else if (phase === 'prepare') lines.push(`milestone: no open vX.Y.Z milestone above ${current}`);
  const mk = proposal.marketplace;
  if (phase !== 'prepare') lines.push(`marketplace: ${current}${phase === 'none' ? '' : `, tag v${current} ${tagged ? 'pushed' : 'not pushed'}`}`);
  else if (version && SEMVER.test(version) && compare(version, current) > 0) {
    const kind = kindOf(current, version);
    const short = mk.kind && KINDS.indexOf(kind) < KINDS.indexOf(mk.kind) ? `, changes need ${mk.kind}: ${mk.types.join(', ')}` : '';
    lines.push(`marketplace: ${current} -> ${version} (${kind}${kind === 'major' ? ', confirm' : ''}${short})`);
  } else lines.push(`marketplace: ${current}, no release version${mk.kind ? ` (changes need ${mk.kind})` : ''}`);
  for (const p of proposal.plugins) {
    lines.push(p.kind && phase === 'prepare'
      ? `${p.name}: ${p.from} -> ${p.to} (${p.kind}${p.kind === 'major' ? ', confirm' : ''}: ${p.types.join(', ')})`
      : `${p.name}: ${p.from} unchanged`);
  }
  let last = '';
  try {
    last = git('describe', '--tags', '--abbrev=0', '--match', 'v*');
  } catch {
    last = 'none';
  }
  lines.push(`last tag: ${last}`);
  return lines;
}

// Writes the release edits into `root`; on a write or release notes error, restores the files and throws.
function prepare(args, root = ROOT, notesOf = releaseNotes) {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  let date = today();
  const versions = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date') date = args[++i];
    else if (args[i].includes('=')) {
      const [name, v] = args[i].split('=');
      versions[name] = v;
    } else rest.push(args[i]);
  }
  if (rest.length !== 1) throw new Error('usage: prepare X.Y.Z [<plugin>=X.Y.Z ...] [--date YYYY-MM-DD]');
  const version = rest[0];
  const result = prepareEdits(read, version, versions, date);
  if (result.error) throw new Error(result.error);
  const before = {};
  const restore = () => {
    for (const [rel, text] of Object.entries(before)) fs.writeFileSync(path.join(root, rel), text);
  };
  try {
    for (const [rel, text] of Object.entries(result.files)) {
      before[rel] = read(rel);
      fs.writeFileSync(path.join(root, rel), text);
    }
  } catch (e) {
    restore();
    throw e;
  }
  let notes;
  try {
    notes = notesOf(`v${version}`, root);
  } catch (e) {
    notes = { error: e.message };
  }
  if (notes.error) {
    restore();
    throw new Error(`notes: ${notes.error} (files restored)`);
  }
  return [...Object.keys(result.files).map((rel) => `changed: ${rel}`), `notes: v${version} ok`];
}

function tag(version) {
  if (!SEMVER.test(version || '')) throw new Error('usage: tag X.Y.Z');
  const name = `v${version}`;
  if (git('branch', '--show-current') !== 'main') throw new Error('not on main: merge the release pull request and run git finish first');
  if (git('status', '--porcelain')) throw new Error('uncommitted changes');
  const notes = releaseNotes(name, ROOT);
  if (notes.error) throw new Error(notes.error);
  const m = milestone(version);
  if (!m) throw new Error(`milestone ${name} not found`);
  const open = openIssues(m.number);
  if (open.length) throw new Error(`milestone ${name} has open issues: ${open.join(' ')}`);
  let preferred = '';
  try {
    preferred = git('config', 'branch.main.remote');
  } catch { /* no upstream */ }
  const remote = pushRemote(git('remote', '-v'), preferred);
  if (!remote) throw new Error(`no remote with the URL ${REPO}`);
  const head = git('rev-parse', 'HEAD');
  const remoteMain = git('ls-remote', remote, 'refs/heads/main').split(/\s/)[0];
  if (head !== remoteMain) throw new Error(`local main ${head.slice(0, 7)} differs from GitHub main ${(remoteMain || 'none').slice(0, 7)}: run git finish`);
  if (git('tag', '--list', name)) throw new Error(`tag ${name} already exists locally`);
  if (remoteTag(version)) throw new Error(`tag ${name} already exists on GitHub`);
  git('tag', '-a', name, '-m', name);
  try {
    git('push', remote, `refs/tags/${name}`);
  } catch (e) {
    git('tag', '-d', name); // so the next run can tag again
    throw e;
  }
  return [`tagged: ${name} at ${head.slice(0, 7)}, pushed to ${REPO}`];
}

function close(version) {
  if (!SEMVER.test(version || '')) throw new Error('usage: close X.Y.Z');
  const name = `v${version}`;
  const m = milestone(version);
  if (!m) throw new Error(`milestone ${name} not found`);
  if (m.state === 'closed') return [`milestone ${name}: already closed`];
  const open = openIssues(m.number);
  if (open.length) throw new Error(`milestone ${name} has open issues: ${open.join(' ')}`);
  if (!ghRelease(version)) throw new Error(`no GitHub release ${name} yet: check the Release workflow`);
  gh('api', '-X', 'PATCH', `repos/${REPO}/milestones/${m.number}`, '-f', 'state=closed', '--jq', '.state');
  return [`milestone ${name}: closed`];
}

function main(argv) {
  const [cmd, ...args] = argv;
  try {
    let lines;
    if (cmd === 'status' && args.length <= 1) lines = status(args[0]);
    else if (cmd === 'prepare') lines = prepare(args);
    else if (cmd === 'tag' && args.length === 1) lines = tag(args[0]);
    else if (cmd === 'close' && args.length === 1) lines = close(args[0]);
    else throw new Error('usage: status [X.Y.Z] | prepare X.Y.Z [<plugin>=X.Y.Z ...] [--date YYYY-MM-DD] | tag X.Y.Z | close X.Y.Z');
    console.log(lines.join('\n'));
    return 0;
  } catch (e) {
    console.error(`release: ${String(e.stderr || e.message).trim().split('\n').pop()}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { unreleasedLines, rootAreas, pluginTypes, bumpOf, bump, compare, milestoneVersion, kindOf, phaseOf, propose, releaseChangelog, setJsonVersion, setReadmeRow, setVersionLine, prepareEdits, prepare, pushRemote };
