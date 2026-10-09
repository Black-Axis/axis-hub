# TASK-{{TT}}: {{Task Title}}

| Field | Value |
|-------|-------|
| Status | Not Started |
| Plan | [P-{{NN}}-{{slug}}](../../plans/P-{{NN}}-{{slug}}.md) |
| Contract | [CONT-{{NN}}-{{slug}}](../../contracts/CONT-{{NN}}-{{slug}}.md) |
| Tracking | [TRK-{{NN}}-{{slug}}](../../tracking/TRK-{{NN}}-{{slug}}.md) |
| Depends On | {{TASK-xx, TASK-yy \| —}} |
| Source | {{Feature requirement(s) or change request (FEAT-n) this task comes from}} |
| Created | {{YYYY-MM-DD}} |
| Baseline | {{git commit hash \| C<changeset> \| YYYY-MM-DD HH:MM}} |
| Tests | {{targeted test command(s) for this task \| — (the contract's Tests)}} |

## Problem

{{Description of the problem to be solved.}}

## Evidence

{{Facts from the code and the feature description that justify this task: file paths with line numbers, current behavior, logs, requirement references.}}

## Required Outcome

{{The final result required from the implementation.}}

## Files Expected to Change

- `{{path/to/file}}` — {{edit | new | delete | rename to `new/path`}} — {{why}}

## Out of Scope

- {{What is closed for this subtask and must not be modified.}}

## Implementation

{{Mandatory requirements for the implementation: approach, constraints, patterns to reuse, edge cases, tests to add.}}

## Report Requirements

{{The data and results the subagent must report after implementation, for example:}}
- Summary of changes per file
- Tests added or run and their results
- Any deviation from this task, with reason
- Blockers or open questions
