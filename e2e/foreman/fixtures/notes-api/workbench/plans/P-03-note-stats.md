# P-03: Note stats

- Contract: [CONT-03-note-stats](../contracts/CONT-03-note-stats.md)
- Tracking: [TRK-03-note-stats](../tracking/TRK-03-note-stats.md)
- Tasks: [subtasks/P-03-note-stats/](../subtasks/P-03-note-stats/)
- Doc: [DOC-03-note-stats](../docs/DOC-03-note-stats.md)
- Created: 2026-10-05

## Overview

`GET /notes/stats` returns the number of notes.

## Source

- Received: 2026-10-05
- Type: text

### Working Files

- none

### User Text

> `GET /notes/stats` returns the number of notes.

## Feature Review Findings

| # | Finding | Type | Resolution |
|---|---------|------|------------|
| 1 | Error responses not defined | missing | `{ "error": "<text>" }` with a 4xx status, as the existing routes do |

## Requirements

1. `GET /notes/stats` returns `{ "notes": <count> }`.

## Technical Approach

- Changes stay in `src/` and `spec/`; no new dependencies.

## Task Breakdown

| Task | Title | Depends On |
|------|-------|------------|
| TASK-01 | GET /notes/stats route | — |

## Risks

- none

## Open Questions

- none
