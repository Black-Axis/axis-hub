# TRK-02: Search notes

- Plan: [P-02-search-notes](../plans/P-02-search-notes.md)
- Plan Status: In Progress

> Status values: `Not Started`, `In Progress`, `Hold`, `Done`, `Canceled`.

## Tasks

| Task | Title | Status | Updated | Note |
|------|-------|--------|---------|------|
| [TASK-01](../subtasks/P-02-search-notes/TASK-01-parse-q-terms.md) | Parse q terms (a\|b = OR) | Done | 2026-10-05 | verified; 1 fix round |
| [TASK-02](../subtasks/P-02-search-notes/TASK-02-filter-notes.md) | Filter GET /notes by q | Not Started | 2026-10-03 |  |
| [TASK-03](../subtasks/P-02-search-notes/TASK-03-readme-search.md) | Document search in README | Not Started | 2026-10-03 |  |

## History

| Date | Target | Old -> New | By | Reason |
|------|--------|------------|----|--------|
| 2026-10-03 | P-02 | — -> Not Started | Main agent | Plan created |
| 2026-10-05 | TASK-01 | Not Started -> In Progress | User | /foreman:run P-02 TASK-01 |
| 2026-10-05 | P-02 | Not Started -> In Progress | Main agent | first task started |
| 2026-10-05 | TASK-01 | In Progress -> In Progress | Main agent | Fix round 1: 1 issues |
| 2026-10-05 | TASK-01 | In Progress -> Done | Main agent | verified; 1 fix round |

## Activity

> By: `User`, `Main agent`, `Worker`. Type: `Decision` (a choice or answer), `Action` (files changed, commands run, commits, task-file fixes).

| Date | Target | By | Type | Details |
|------|--------|----|------|---------|
| 2026-10-03 | P-02 | User | Decision | Approve CONT-02? → yes |
| 2026-10-05 | TASK-01 | Main agent | Action | tests: `node --test spec/notes.spec.js` → 2 pass, 0 fail |
