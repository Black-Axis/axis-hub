# CONT-02: Search notes

- Plan: [P-02-search-notes](../plans/P-02-search-notes.md)
- Status: Approved
- Approved: 2026-10-03
- Created: 2026-10-03

> Status values: `Draft`, `Approved`, `Amended Pending Approval`.
> No task may run unless Status is `Approved`.

## Scope

- `q` on `GET /notes` in `src/notes.js`, its specs, and the README line.

## Out of Scope

- Persistence, authentication, paging.
- New dependencies.

## Acceptance Criteria

1. `GET /notes?q=MILK` returns only notes containing `milk`, any case.
2. `GET /notes?q=a|b` returns notes containing `a` OR `b`, each once.
3. `npm test` passes.

## Working Rules

- Commit policy: never auto-commit
- Auto-close: Ask (what happens when the last task is Done: ask to run /foreman:close, run it automatically, or never)
- Tests: `npm test`
- Baseline tests: yes (yes = run the tests before each task, so failures that already exist are not blamed on the worker)
- Full tests: close (close = a task with its own Tests runs only those during /foreman:run, the full Tests run at /foreman:close; each task = also the full Tests once after each task)
- Standards: CommonJS, 2-space indent, single quotes, semicolons; node:test specs in `spec/`; no new dependencies
- Ask the user when: a new dependency is needed; a route or response shape changes

## Change Requests

| ID | Date | Change | Impact | Approved |
|----|------|--------|--------|----------|
