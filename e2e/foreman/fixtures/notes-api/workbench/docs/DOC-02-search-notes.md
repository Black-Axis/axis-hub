# DOC-02: Search notes

- Plan: [P-02-search-notes](../plans/P-02-search-notes.md)
- Last Updated: 2026-10-05

## Summary

Search terms are parsed; filtering is not built yet.

## Implemented Tasks

### TASK-01: Parse q terms (a\|b = OR) (2026-10-05)

- What changed: `parseTerms`
- Files: `src/notes.js`, `spec/notes.spec.js`
- Decisions: `URLSearchParams`

## Architecture / Key Files

- `src/app.js` — routes
- `src/notes.js` — notes store and handlers

## How to Extend

Add a route in `src/app.js` and a spec in `spec/`.

## Acceptance

Not verified yet

## Known Limitations

- In-memory store only.
