// Checks scripts/ci-watch.js without calling GitHub: arguments, the alert ref,
// when runs count as done, the decisive log lines, and the output lines.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const { parseArgs, alertRef, allDone, decisive, runLines, alertLines } = require('../scripts/ci-watch.js');

test('parseArgs: targets, timeout, errors', () => {
  assert.deepStrictEqual(parseArgs(['pr', '#143']), { kind: 'pr', name: '143', timeout: 9 });
  assert.deepStrictEqual(parseArgs(['branch', 'feat/axis-ci-watcher', '--timeout', '5']), { kind: 'branch', name: 'feat/axis-ci-watcher', timeout: 5 });
  assert.strictEqual(parseArgs(['tag', 'v1.7.0']).name, 'v1.7.0');
  assert.match(parseArgs(['pr', 'x']).error, /not a pull request number/);
  assert.match(parseArgs(['run', '1']).error, /usage/);
  assert.match(parseArgs(['pr']).error, /usage/);
  assert.match(parseArgs(['pr', '1', '--timeout']).error, /minutes/);
  assert.match(parseArgs(['branch', 'a;rm']).error, /bad name/);
});

test('alertRef: pull request merge ref, tag, branch', () => {
  assert.strictEqual(alertRef({ kind: 'pr', name: '12' }), 'refs/pull/12/merge');
  assert.strictEqual(alertRef({ kind: 'tag', name: 'v1.7.0' }), 'refs/tags/v1.7.0');
  assert.strictEqual(alertRef({ kind: 'branch', name: 'main' }), 'refs/heads/main');
});

test('allDone: at least one run and all completed', () => {
  assert.strictEqual(allDone([]), false);
  assert.strictEqual(allDone([{ status: 'completed' }, { status: 'in_progress' }]), false);
  assert.strictEqual(allDone([{ status: 'completed' }, { status: 'completed' }]), true);
});

test('decisive: error lines without job, step, timestamp, and colors', () => {
  const log = [
    'validate\tRun tests\t2026-10-12T10:00:00.0000000Z ##[group]Run node --test',
    'validate\tRun tests\t2026-10-12T10:00:01.0000000Z ✔ manifests ok',
    'validate\tRun tests\t2026-10-12T10:00:02.0000000Z \x1b[31m✖ release notes\x1b[0m',
    'validate\tRun tests\t2026-10-12T10:00:02.1000000Z AssertionError [ERR_ASSERTION]: bullet longer than 140 characters',
    'validate\tRun tests\t2026-10-12T10:00:03.0000000Z ##[error]Process completed with exit code 1.',
  ].join('\n');
  assert.deepStrictEqual(decisive(log), ['✖ release notes', 'AssertionError [ERR_ASSERTION]: bullet longer than 140 characters', '##[error]Process completed with exit code 1.']);
  assert.deepStrictEqual(decisive('a\tb\t2026-10-12T10:00:00Z just text'), ['just text']);
});

test('runLines: newest run per workflow, failures first with log lines, pending', () => {
  const runs = [
    { databaseId: 1, workflowName: 'validate', status: 'completed', conclusion: 'failure', url: 'u1' },
    { databaseId: 3, workflowName: 'validate', status: 'completed', conclusion: 'success', url: 'u3' },
    { databaseId: 2, workflowName: 'CodeQL', status: 'completed', conclusion: 'failure', url: 'u2' },
    { databaseId: 4, workflowName: 'release', status: 'in_progress', conclusion: '', url: 'u4' },
  ];
  assert.deepStrictEqual(runLines(runs, (id) => (id === 2 ? 'x\ty\t2026-10-12T10:00:00Z Error: boom' : '')), [
    'CodeQL: failure - u2',
    '  Error: boom',
    'validate: success - u3',
    'release: pending - u4',
  ]);
});

test('alertLines: one per open alert, or none', () => {
  assert.deepStrictEqual(alertLines([]), ['alerts: none']);
  assert.deepStrictEqual(alertLines([{ rule: { id: 'js/path-injection', security_severity_level: 'high' }, most_recent_instance: { location: { path: 'scripts/x.js', start_line: 7 } } }]), ['alert: js/path-injection high scripts/x.js:7']);
});
