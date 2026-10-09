# TASK-02: Health spec

| Field | Value |
|-------|-------|
| Status | Done |
| Plan | [P-01-health-check](../../plans/P-01-health-check.md) |
| Contract | [CONT-01-health-check](../../contracts/CONT-01-health-check.md) |
| Tracking | [TRK-01-health-check](../../tracking/TRK-01-health-check.md) |
| Depends On | TASK-01 |
| Source | Requirement 2 |
| Created | 2026-10-01 |
| Baseline | E2E_BASELINE |
| Tests | `node --test spec/health.spec.js` |

## Problem

The health route has no test.

## Evidence

- `spec/helpers.js`: `withServer` starts the app on a free port.

## Required Outcome

- `spec/health.spec.js` checks status and body.

## Files Expected to Change

- `spec/health.spec.js` — new

## Out of Scope

- Other routes and modules.

## Implementation

- Use `withServer`.

## Report Requirements

- Summary of changes per file
- Tests added or run and their results
- Any deviation from this task, with reason
- Blockers or open questions
