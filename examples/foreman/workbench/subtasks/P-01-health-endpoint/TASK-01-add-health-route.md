# TASK-01: Add health route

| Field | Value |
|-------|-------|
| Plan | [P-01-health-endpoint](../../plans/P-01-health-endpoint.md) |
| Contract | [CONT-01-health-endpoint](../../contracts/CONT-01-health-endpoint.md) |
| Tracking | [TRK-01-health-endpoint](../../tracking/TRK-01-health-endpoint.md) |
| Depends On | — |
| Source | Requirements 1-3 |
| Created | 2026-09-20 |
| Baseline | 3f9c2a1d8e4b7f60a5c1d2e3f4a5b6c7d8e9f0a1 |
| Tests | — |

## Problem

The service has no endpoint the load balancer can use to check health and version.

## Evidence

- `src/app.js:14` registers routes; no `/health` route exists.
- `package.json` has `"version": "2.3.0"`.

## Required Outcome

`GET /health` returns `200` with `{"status":"ok","version":"<package.json version>"}`, without auth.

## Files Expected to Change

- `src/routes/health.js` — new — route module
- `src/app.js` — edit — register the route before the auth middleware

## Out of Scope

- Auth middleware, other routes, database code.

## Implementation

- Follow the pattern of `src/routes/users.js`.
- Read the version once at module load from `package.json`.
- No database or network calls.

## Report Requirements

- Files changed and what changed
- `npm test` result
- Deviations or blockers
