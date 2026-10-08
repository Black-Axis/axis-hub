# P-02: Search notes

- Contract: [CONT-02-search-notes](../contracts/CONT-02-search-notes.md)
- Tracking: [TRK-02-search-notes](../tracking/TRK-02-search-notes.md)
- Tasks: [subtasks/P-02-search-notes/](../subtasks/P-02-search-notes/)
- Doc: [DOC-02-search-notes](../docs/DOC-02-search-notes.md)
- Created: 2026-10-03

## Overview

`GET /notes?q=<text>` returns only the notes whose text contains `<text>`; `a|b` means OR.

## Source

- Received: 2026-10-03
- Type: text

### Working Files

- none

### User Text

> `GET /notes?q=<text>` returns only the notes whose text contains `<text>`; `a|b` means OR.

## Feature Review Findings

| # | Finding | Type | Resolution |
|---|---------|------|------------|
| 1 | Error responses not defined | missing | `{ "error": "<text>" }` with a 4xx status, as the existing routes do |

## Requirements

1. `q` is split on `|`, trimmed, lowercased; empty terms ignored.
2. `GET /notes?q=` filters case-insensitively, newest first.
3. The README documents search.

## Technical Approach

- Changes stay in `src/` and `spec/`; no new dependencies.

## Task Breakdown

| Task | Title | Depends On |
|------|-------|------------|
| TASK-01 | Parse q terms (a\|b = OR) | — |
| TASK-02 | Filter GET /notes by q | TASK-01 |
| TASK-03 | Document search in README | TASK-02 |

## Risks

- none

## Open Questions

- none
