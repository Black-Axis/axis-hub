# TASK-02: Filter GET /notes by q

| Field | Value |
|-------|-------|
| Status | Not Started |
| Plan | [P-02-search-notes](../../plans/P-02-search-notes.md) |
| Contract | [CONT-02-search-notes](../../contracts/CONT-02-search-notes.md) |
| Tracking | [TRK-02-search-notes](../../tracking/TRK-02-search-notes.md) |
| Depends On | TASK-01 |
| Source | Requirement 2 |
| Created | 2026-10-03 |
| Baseline | E2E_BASELINE |
| Tests | `node --test spec/notes.spec.js` |

## Problem

`GET /notes` ignores `q`.

## Evidence

- `src/notes.js`: `list` sends every note.
- `parseTerms` exists (TASK-01).

## Required Outcome

- `GET /notes?q=a|b` returns the notes containing any term, case-insensitive, newest first.

## Files Expected to Change

- `src/notes.js` — edit — filter in `list`
- `spec/notes.spec.js` — edit — HTTP specs

## Out of Scope

- Other routes and modules.

## Implementation

- No terms: all notes, as today.

## Report Requirements

- Summary of changes per file
- Tests added or run and their results
- Any deviation from this task, with reason
- Blockers or open questions
