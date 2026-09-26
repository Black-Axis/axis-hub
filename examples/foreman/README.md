# foreman example

A sample `workbench/` for one feature (P-01 Health endpoint) mid-way through: contract approved, TASK-01 Done after one fix round, TASK-02 ready.

Browse it to see what foreman produces:

| File | Shows |
|------|-------|
| [workbench/INDEX.md](workbench/INDEX.md) | Project settings and feature list |
| [workbench/plans/P-01-health-endpoint.md](workbench/plans/P-01-health-endpoint.md) | Plan from a text feature description, with review findings |
| [workbench/contracts/CONT-01-health-endpoint.md](workbench/contracts/CONT-01-health-endpoint.md) | Approved contract and working rules |
| [workbench/tracking/TRK-01-health-endpoint.md](workbench/tracking/TRK-01-health-endpoint.md) | Task statuses, History, Activity log |
| [workbench/subtasks/P-01-health-endpoint/](workbench/subtasks/P-01-health-endpoint/) | Task files |
| [workbench/docs/DOC-01-health-endpoint.md](workbench/docs/DOC-01-health-endpoint.md) | Feature doc after one task |

The source code the files refer to (`src/`, `test/`) is illustrative and not included.

This folder is also the fixture for the session start hook tests in `tests/foreman/`.
