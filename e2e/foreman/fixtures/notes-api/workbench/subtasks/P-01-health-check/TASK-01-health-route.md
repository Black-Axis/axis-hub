# TASK-01: Health route

| Field | Value |
|-------|-------|
| Plan | [P-01-health-check](../../plans/P-01-health-check.md) |
| Contract | [CONT-01-health-check](../../contracts/CONT-01-health-check.md) |
| Tracking | [TRK-01-health-check](../../tracking/TRK-01-health-check.md) |
| Depends On | — |
| Source | Requirement 1 |
| Created | 2026-10-01 |
| Baseline | E2E_BASELINE |
| Tests | — |

## Problem

There is no way to check that the service is up.

## Evidence

- `src/app.js`: `routes` maps `METHOD /path` to handlers.

## Required Outcome

- `GET /health` returns `200` with `{ "status": "ok" }`.

## Files Expected to Change

- `src/app.js` — edit — route

## Out of Scope

- Other routes and modules.

## Implementation

- Inline handler in `routes`.

## Report Requirements

- Summary of changes per file
- Tests added or run and their results
- Any deviation from this task, with reason
- Blockers or open questions
