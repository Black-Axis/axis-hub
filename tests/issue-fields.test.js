// Checks the argument parsing and field mapping of .github/scripts/issue-fields.js
// (no network: the gh calls are not run).
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const { parseArgs, fieldInputs } = require('../.github/scripts/issue-fields.js');

const fields = [
  { __typename: 'IssueFieldSingleSelect', id: 'P', name: 'Priority', options: [{ id: 'p-high', name: 'High' }, { id: 'p-low', name: 'Low' }] },
  { __typename: 'IssueFieldSingleSelect', id: 'E', name: 'Effort', options: [{ id: 'e-medium', name: 'Medium' }] },
  { __typename: 'IssueFieldDate', id: 'S', name: 'Start date' },
  { __typename: 'IssueFieldDate', id: 'T', name: 'Target date' },
];

test('parses the issue number and the flags', () => {
  assert.deepStrictEqual(parseArgs(['123', '--priority', 'High', '--effort', 'Medium']),
    { issue: '123', values: { Priority: 'High', Effort: 'Medium' } });
  assert.deepStrictEqual(parseArgs(['--start', '2026-10-10', '#7', '--target', '2026-10-20']),
    { issue: '7', values: { 'Start date': '2026-10-10', 'Target date': '2026-10-20' } });
});

test('rejects bad arguments', () => {
  assert.match(parseArgs(['--priority', 'High']).error, /missing issue number/);
  assert.match(parseArgs(['5']).error, /nothing to set/);
  assert.match(parseArgs(['5', '--priority']).error, /--priority needs a value/);
  assert.match(parseArgs(['5', '--priority', '--effort', 'Low']).error, /--priority needs a value/);
  assert.match(parseArgs(['5', '--size', 'L']).error, /unknown argument: --size/);
  assert.match(parseArgs(['5', '6', '--effort', 'Low']).error, /unknown argument: 6/);
});

test('maps names to IDs, option names in any case', () => {
  const { inputs } = fieldInputs(fields, { Priority: 'high', Effort: 'Medium', 'Start date': '2026-10-10' });
  assert.deepStrictEqual(inputs, [
    { fieldId: 'P', singleSelectOptionId: 'p-high', label: 'Priority High' },
    { fieldId: 'E', singleSelectOptionId: 'e-medium', label: 'Effort Medium' },
    { fieldId: 'S', dateValue: '2026-10-10', label: 'Start date 2026-10-10' },
  ]);
});

test('a wrong option name lists the valid names; a bad date or field fails', () => {
  assert.strictEqual(fieldInputs(fields, { Priority: 'Urgent' }).error, 'Priority: no option "Urgent" (valid: High, Low)');
  assert.match(fieldInputs(fields, { 'Target date': '10/20/2026' }).error, /is not YYYY-MM-DD/);
  assert.match(fieldInputs(fields.slice(0, 1), { Effort: 'Low' }).error, /no issue field "Effort"/);
});
