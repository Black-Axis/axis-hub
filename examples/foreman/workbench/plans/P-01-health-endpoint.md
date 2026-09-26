# P-01: Health endpoint

- Contract: [CONT-01-health-endpoint](../contracts/CONT-01-health-endpoint.md)
- Tracking: [TRK-01-health-endpoint](../tracking/TRK-01-health-endpoint.md)
- Tasks: [subtasks/P-01-health-endpoint/](../subtasks/P-01-health-endpoint/)
- Doc: [DOC-01-health-endpoint](../docs/DOC-01-health-endpoint.md)
- Created: 2026-09-20

## Overview

Add `GET /health` so the load balancer can check that the service is up and which version runs.

## Source

- Received: 2026-09-20
- Type: text

### User Text

add a /health endpoint returning {status:"ok"} and the app version

## Feature Review Findings

| # | Finding | Type | Resolution |
|---|---------|------|------------|
| 1 | Source of the version not stated | unclear | Read `version` from `package.json` at startup |
| 2 | Auth on `/health` not stated | missing | No auth; endpoint is public |

## Requirements

1. `GET /health` returns `200` with `{"status":"ok","version":"<package version>"}`.
2. No authentication.
3. Response time under 50 ms (no database calls).

## Technical Approach

- New route module `src/routes/health.js`, registered in `src/app.js` next to existing routes.
- Version read once from `package.json`.

## Task Breakdown

| Task | Title | Depends On |
|------|-------|------------|
| TASK-01 | Add health route | — |
| TASK-02 | Add health route tests | TASK-01 |

## Risks

- None significant.

## Open Questions

- None.
