# TASK-01: Parse q terms (a|b = OR)

| Field | Value |
|-------|-------|
| Status | Done |
| Plan | [P-02-search-notes](../../plans/P-02-search-notes.md) |
| Contract | [CONT-02-search-notes](../../contracts/CONT-02-search-notes.md) |
| Tracking | [TRK-02-search-notes](../../tracking/TRK-02-search-notes.md) |
| Depends On | — |
| Source | Requirement 1 |
| Created | 2026-10-03 |
| Baseline | E2E_BASELINE |
| Tests | `node --test spec/notes.spec.js` |

## Problem

The `q` query needs parsing into terms.

## Evidence

- `src/notes.js`: handlers get `req.url` unparsed.

## Required Outcome

- `parseTerms(url)` returns lowercased, trimmed, non-empty terms split on `|`.

## Files Expected to Change

- `src/notes.js` — edit
- `spec/notes.spec.js` — edit

## Out of Scope

- Other routes and modules.

## Implementation

- `URLSearchParams` on the part after `?`.

## Report Requirements

- Summary of changes per file
- Tests added or run and their results
- Any deviation from this task, with reason
- Blockers or open questions
