// Checks the output parsing of scripts/check-all.js (the checks themselves are not run).
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const { testSummary, validateSummary } = require('../scripts/check-all.js');

const failing = [
  '✔ good (1.1ms)',
  '✖ bad one (1.1ms)',
  'ℹ tests 2',
  'ℹ suites 0',
  'ℹ pass 1',
  'ℹ fail 1',
  '',
  '✖ failing tests:',
  '',
  'test at a.test.js:3:1',
  '✖ bad one (1.1ms)',
  '  AssertionError [ERR_ASSERTION]: numbers differ',
  '  ',
  '  1 !== 2',
  '  ',
  '      at TestContext.<anonymous> (C:\\x\\a.test.js:3:35)',
  '      at Test.runInAsyncScope (node:async_hooks:227:14)',
  '      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {',
  '    generatedMessage: false,',
  "    code: 'ERR_ASSERTION',",
  '  }',
].join('\r\n');

test('test summary: counts and the failures without stack or property block', () => {
  assert.deepStrictEqual(testSummary(failing), {
    tests: 2, pass: 1, fail: 1,
    failures: ['test at a.test.js:3:1', '✖ bad one (1.1ms)', '  AssertionError [ERR_ASSERTION]: numbers differ', '  1 !== 2'],
  });
});

test('test summary: keeps a deep-equal diff, drops the property block after it', () => {
  const out = [
    '✖ failing tests:',
    'test at t.js:1:1',
    '✖ deep (1ms)',
    '  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:',
    '  + actual - expected',
    '    {',
    '  +   a: 1',
    '    }',
    '      at TestContext.<anonymous> (t.js:2:10) {',
    '    generatedMessage: true,',
    '  }',
  ].join('\n');
  assert.deepStrictEqual(testSummary(out).failures.slice(3), ['  + actual - expected', '    {', '  +   a: 1', '    }']);
});

test('test summary: a green run has no failures', () => {
  assert.deepStrictEqual(testSummary('✔ good (1ms)\nℹ tests 1\nℹ pass 1\nℹ fail 0\n'), { tests: 1, pass: 1, fail: 0, failures: [] });
});

test('validate summary: status and the ❯ lines', () => {
  const out = 'Validating plugin manifest: x\n\n⚠ Found 1 warning:\n\n  ❯ author: No author information provided.\n\n✔ Validation passed with warnings\n';
  assert.deepStrictEqual(validateSummary(out, 0), { ok: true, items: ['❯ author: No author information provided.'] });
  assert.deepStrictEqual(validateSummary('✔ Validation passed\n', 0), { ok: true, items: [] });
  assert.strictEqual(validateSummary('✖ Validation failed\n  ❯ name: required\n', 1).ok, false);
});
