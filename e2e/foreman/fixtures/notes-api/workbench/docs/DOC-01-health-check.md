# DOC-01: Health check

- Plan: [P-01-health-check](../plans/P-01-health-check.md)
- Last Updated: 2026-10-03

## Summary

`GET /health` returns `{ "status": "ok" }`.

## Implemented Tasks

### TASK-01: Health route (2026-10-03)

- What changed: route in `src/app.js`
- Files: `src/app.js`
- Decisions: inline handler

### TASK-02: Health spec (2026-10-03)

- What changed: spec
- Files: `spec/health.spec.js`
- Decisions: none

## Architecture / Key Files

- `src/app.js` — routes
- `src/notes.js` — notes store and handlers

## How to Extend

Add a route in `src/app.js` and a spec in `spec/`.

## Acceptance

| Criterion | Result | Evidence |
|-----------|--------|----------|
| 1 | Pass | `spec/health.spec.js` |
| 2 | Pass | `npm test` |

## Known Limitations

- In-memory store only.
