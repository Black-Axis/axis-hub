#!/usr/bin/env node
// Waits for the GitHub Actions runs of a pull request, branch, or tag on
// Black-Axis/axis-hub and prints one line per workflow plus one per open CodeQL
// alert. Read-only gh calls only.
// Usage: node scripts/ci-watch.js pr <n> | branch <name> | tag <vX.Y.Z> [--timeout <minutes>]
// Polls `gh run list --commit <head sha>` every 15 s until every run is completed in
// two polls in a row (so late-starting workflows like CodeQL are seen), or the timeout
// (default 9 minutes, under the 10-minute shell limit) passes; runs still going then
// print as `pending`. A failed run adds its decisive `--log-failed` lines.
// Output: `<workflow>: <conclusion> - <url>` (plus `  <log line>` rows), then
// `alert: <rule> <severity> <path>:<line>` per open alert, or `alerts: none`.
'use strict';

const { execFileSync } = require('child_process');

const REPO = 'Black-Axis/axis-hub';
const KINDS = ['pr', 'branch', 'tag'];

// Returns { kind, name, timeout } or { error }.
function parseArgs(argv) {
  const out = { kind: null, name: null, timeout: 9 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--timeout') {
      const v = argv[++i];
      if (!/^\d+(\.\d+)?$/.test(v || '')) return { error: '--timeout needs minutes' };
      out.timeout = Number(v);
    } else rest.push(argv[i]);
  }
  if (rest.length !== 2 || !KINDS.includes(rest[0])) return { error: 'usage: pr <n> | branch <name> | tag <name> [--timeout <minutes>]' };
  [out.kind, out.name] = rest;
  if (out.kind === 'pr' && !/^#?\d+$/.test(out.name)) return { error: `not a pull request number: ${out.name}` };
  if (!/^[\w./#-]+$/.test(out.name)) return { error: `bad name: ${out.name}` };
  if (out.kind === 'pr') out.name = out.name.replace('#', '');
  return out;
}

// The ref CodeQL alerts are listed for.
function alertRef({ kind, name }) {
  return kind === 'pr' ? `refs/pull/${name}/merge` : kind === 'tag' ? `refs/tags/${name}` : `refs/heads/${name}`;
}

// True when the runs are all completed (and there is at least one).
function allDone(runs) {
  return runs.length > 0 && runs.every((r) => r.status === 'completed');
}

// The decisive lines of a `gh run view --log-failed` output: error-like lines,
// without the job / step / timestamp prefix, at most `max`, the last ones.
function decisive(log, max = 5) {
  const lines = String(log).split(/\r?\n/).map((l) => l.split('\t').pop().replace(/^\S*Z\s/, '').replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean);
  const hits = lines.filter((l) => /error|fail|✖|not ok|assert|exception|denied/i.test(l) && !/^##\[group\]|^shell:/.test(l));
  return (hits.length ? hits : lines).slice(-max);
}

// The run lines: one per workflow (newest run of each), failures first.
function runLines(runs, logOf = () => '') {
  const newest = new Map();
  for (const r of runs) {
    const key = r.workflowName || r.name;
    if (!newest.has(key) || r.databaseId > newest.get(key).databaseId) newest.set(key, r);
  }
  const ordered = [...newest.values()].sort((a, b) => (b.conclusion === 'failure') - (a.conclusion === 'failure'));
  const lines = [];
  for (const r of ordered) {
    const state = r.status === 'completed' ? r.conclusion || 'completed' : 'pending';
    lines.push(`${r.workflowName || r.name}: ${state} - ${r.url}`);
    if (state === 'failure') for (const l of decisive(logOf(r.databaseId))) lines.push(`  ${l}`);
  }
  return lines;
}

// The alert lines for open code scanning alerts.
function alertLines(alerts) {
  if (!alerts.length) return ['alerts: none'];
  return alerts.map((a) => {
    const loc = (a.most_recent_instance && a.most_recent_instance.location) || {};
    const sev = (a.rule && (a.rule.security_severity_level || a.rule.severity)) || '?';
    return `alert: ${(a.rule && a.rule.id) || '?'} ${sev} ${loc.path || '?'}:${loc.start_line || '?'}`;
  });
}

function gh(...args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

function headSha({ kind, name }) {
  if (kind === 'pr') return gh('pr', 'view', name, '--repo', REPO, '--json', 'headRefOid', '--jq', '.headRefOid').trim();
  return gh('api', `repos/${REPO}/commits/${encodeURIComponent(name)}`, '--jq', '.sha').trim();
}

function listRuns(sha) {
  return JSON.parse(gh('run', 'list', '--repo', REPO, '--commit', sha, '--limit', '50', '--json', 'databaseId,name,workflowName,status,conclusion,url'));
}

function listAlerts(target) {
  try {
    return JSON.parse(gh('api', `repos/${REPO}/code-scanning/alerts?ref=${encodeURIComponent(alertRef(target))}&state=open&per_page=100`));
  } catch (e) {
    if (/no analysis found|404/i.test(`${e.stderr || ''}${e.message}`)) return null;
    throw e;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(argv) {
  const target = parseArgs(argv);
  if (target.error) {
    console.error(`ci-watch: ${target.error}`);
    return 1;
  }
  try {
    const sha = headSha(target);
    const end = Date.now() + target.timeout * 60000;
    let runs = [];
    let doneBefore = false;
    for (;;) {
      runs = listRuns(sha);
      const done = allDone(runs);
      if ((done && doneBefore) || Date.now() >= end) break;
      doneBefore = done;
      await sleep(15000);
    }
    const lines = runs.length ? runLines(runs, (id) => {
      try {
        return gh('run', 'view', String(id), '--repo', REPO, '--log-failed');
      } catch {
        return '';
      }
    }) : [`runs: none for ${sha.slice(0, 7)}`];
    const alerts = listAlerts(target);
    lines.push(...(alerts === null ? ['alerts: no CodeQL analysis for this ref'] : alertLines(alerts)));
    console.log(lines.join('\n'));
    return 0;
  } catch (e) {
    console.error(`ci-watch: ${String(e.stderr || e.message).trim().split('\n').pop()}`);
    return 1;
  }
}

if (require.main === module) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });

module.exports = { parseArgs, alertRef, allDone, decisive, runLines, alertLines };
