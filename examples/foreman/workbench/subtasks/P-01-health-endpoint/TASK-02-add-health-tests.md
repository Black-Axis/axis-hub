# TASK-02: Add health route tests

| Field | Value |
|-------|-------|
| Plan | [P-01-health-endpoint](../../plans/P-01-health-endpoint.md) |
| Contract | [CONT-01-health-endpoint](../../contracts/CONT-01-health-endpoint.md) |
| Tracking | [TRK-01-health-endpoint](../../tracking/TRK-01-health-endpoint.md) |
| Depends On | TASK-01 |
| Source | Acceptance Criteria 1-3 |
| Created | 2026-09-20 |
| Baseline | 3f9c2a1d8e4b7f60a5c1d2e3f4a5b6c7d8e9f0a1 |
| Tests | `npm test -- test/routes/health.test.js` |

## Problem

The new `/health` route has no tests.

## Evidence

- Route tests live in `test/routes/` (e.g. `test/routes/users.test.js`) using `supertest`.

## Required Outcome

Tests prove `GET /health` returns `200` with the right body and needs no auth token.

## Files Expected to Change

- `test/routes/health.test.js` — new — test file for the route

## Out of Scope

- Changes to `src/`.

## Implementation

- Follow `test/routes/users.test.js`.
- Assert status, `status: "ok"`, and `version` equal to `package.json` version.
- One test without an `Authorization` header.

## Report Requirements

- Tests added
- `npm test` result
- Deviations or blockers
