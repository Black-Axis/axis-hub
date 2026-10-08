# CONT-01: Health endpoint

- Plan: [P-01-health-endpoint](../plans/P-01-health-endpoint.md)
- Status: Approved
- Approved: 2026-09-20
- Created: 2026-09-20

> Status values: `Draft`, `Approved`, `Amended Pending Approval`.
> No task may run unless Status is `Approved`.

## Scope

- `GET /health` route returning status and version.
- Tests for the route.

## Out of Scope

- Readiness checks for the database or other services.
- Changes to authentication middleware.

## Acceptance Criteria

1. `GET /health` returns `200` and `{"status":"ok","version":"<package version>"}`.
2. The route works without an auth token.
3. `npm test` passes.

## Working Rules

- Commit policy: never auto-commit
- Auto-close: Ask
- Tests: `npm test`
- Baseline tests: yes
- Full tests: close
- Standards: follow existing route style in `src/routes/`
- Ask the user when: any file outside Files Expected to Change is needed

## Change Requests

| FEAT | Date | Change | Impact | Approved |
|------|------|--------|--------|----------|
