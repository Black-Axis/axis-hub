#!/usr/bin/env node
// Sets the organization issue fields of an issue by name (Priority, Effort, dates).
// Usage: node .github/scripts/issue-fields.js <issue> [--priority <name>] [--effort <name>]
//          [--start YYYY-MM-DD] [--target YYYY-MM-DD]
// Looks up the issue node ID and the field and option IDs through gh, then runs
// setIssueFieldValue. Exit 1 with a message on a bad argument or option name.
'use strict';

const { execFileSync } = require('child_process');

const REPO = 'Black-Axis/axis-hub';
const ORG = 'Black-Axis';
const FLAGS = { '--priority': 'Priority', '--effort': 'Effort', '--start': 'Start date', '--target': 'Target date' };

// Returns { issue, values: { <field name>: <value> } } or { error }.
function parseArgs(argv) {
  const values = {};
  let issue = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (FLAGS[a]) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) return { error: `${a} needs a value` };
      values[FLAGS[a]] = v;
    } else if (/^#?\d+$/.test(a) && issue === null) {
      issue = a.replace('#', '');
    } else {
      return { error: `unknown argument: ${a}` };
    }
  }
  if (issue === null) return { error: 'missing issue number' };
  if (!Object.keys(values).length) return { error: `nothing to set (use ${Object.keys(FLAGS).join(', ')})` };
  return { issue, values };
}

// Maps field names and values to setIssueFieldValue inputs, using the
// organization's fields ({ __typename, id, name, options }). Returns { inputs } or { error }.
function fieldInputs(fields, values) {
  const inputs = [];
  for (const [name, value] of Object.entries(values)) {
    const field = fields.find((f) => f.name === name);
    if (!field) return { error: `the organization has no issue field "${name}"` };
    if (field.options) {
      const option = field.options.find((o) => o.name.toLowerCase() === value.toLowerCase());
      if (!option) return { error: `${name}: no option "${value}" (valid: ${field.options.map((o) => o.name).join(', ')})` };
      inputs.push({ fieldId: field.id, singleSelectOptionId: option.id, label: `${name} ${option.name}` });
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: `${name}: "${value}" is not YYYY-MM-DD` };
      inputs.push({ fieldId: field.id, dateValue: value, label: `${name} ${value}` });
    }
  }
  return { inputs };
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) throw new Error(args.error);
  const fields = JSON.parse(gh(['api', 'graphql', '-f', `query={ organization(login:"${ORG}"){ issueFields(first:20){ nodes{ __typename ... on IssueFieldSingleSelect { id name options{ id name } } ... on IssueFieldDate { id name } } } } }`]))
    .data.organization.issueFields.nodes.filter((f) => f.name);
  const result = fieldInputs(fields, args.values);
  if (result.error) throw new Error(result.error);
  const id = gh(['issue', 'view', args.issue, '--repo', REPO, '--json', 'id', '--jq', '.id']);
  const list = result.inputs.map((i) => (i.dateValue
    ? `{fieldId:"${i.fieldId}", dateValue:"${i.dateValue}"}`
    : `{fieldId:"${i.fieldId}", singleSelectOptionId:"${i.singleSelectOptionId}"}`)).join(', ');
  gh(['api', 'graphql', '-f', `query=mutation($issue:ID!){ setIssueFieldValue(input:{issueId:$issue, issueFields:[${list}]}){ clientMutationId } }`, '-f', `issue=${id}`]);
  console.log(`#${args.issue}: ${result.inputs.map((i) => i.label).join(', ')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`ERROR: ${e.message.trim()}`);
    process.exit(1);
  }
}

module.exports = { parseArgs, fieldInputs };
