# TASK-01: GET /notes/stats route

| Field | Value |
|-------|-------|
| Status | Not Started |
| Plan | [P-03-note-stats](../../plans/P-03-note-stats.md) |
| Contract | [CONT-03-note-stats](../../contracts/CONT-03-note-stats.md) |
| Tracking | [TRK-03-note-stats](../../tracking/TRK-03-note-stats.md) |
| Depends On | — |
| Source | Requirement 1 |
| Created | 2026-10-05 |
| Baseline | E2E_BASELINE |
| Tests | — |

## Problem

There is no endpoint with note statistics.

## Evidence

- `src/app.js`: exact-path routes.

## Required Outcome

- `GET /notes/stats` returns `{ "notes": <count> }`.

## Files Expected to Change

- `src/app.js` — edit
- `src/notes.js` — edit
- `spec/notes.spec.js` — edit

## Out of Scope

- Other routes and modules.

## Implementation

- `store.length`.

## Report Requirements

- Summary of changes per file
- Tests added or run and their results
- Any deviation from this task, with reason
- Blockers or open questions
