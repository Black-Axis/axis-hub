# DOC-01: Health endpoint

- Plan: [P-01-health-endpoint](../plans/P-01-health-endpoint.md)
- Last Updated: 2026-09-21

## Summary

`GET /health` returns service status and version for the load balancer. Public, no database calls.

## Implemented Tasks

### TASK-01: Add health route (2026-09-21)

- What changed: new route returning `{status, version}`, registered before auth
- Files: `src/routes/health.js`, `src/app.js`
- Decisions: version read once at module load from `package.json`

## Architecture / Key Files

- `src/routes/health.js` — health route
- `src/app.js` — route registration

## How to Extend

Add dependency checks (database, cache) in a separate `/ready` route, not `/health`.

## Acceptance

Not verified yet.

## Known Limitations

- Does not check downstream services.
