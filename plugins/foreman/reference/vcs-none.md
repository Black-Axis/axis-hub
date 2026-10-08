# Version control: none

Rules for projects with INDEX `- Version control: none` ("Version control" in rules.md). The other version controls have the same sections in `vcs-git.md` and `vcs-tfvc.md`.

## Ignore file

None: nothing to ignore. Workbench is always `tracked`, so the CLAUDE.md block goes into `CLAUDE.md`.

## Empty subfolders

Not needed. Create the folders with the `mkdir` / `New-Item` form in `reference/setup.md`.

## Commit policy

Always `never auto-commit (user checks in)`; do not ask about it.

## Start state

A snapshot of the task's listed files ("Snapshot" in rules.md).

## Task changes

The snapshot diff and the modification-time check ("Snapshot" in rules.md).

## Commit

Never.

## Deletes, renames, new files

The worker deletes and renames only the files the task lists for that.

## Task baseline

A date baseline ("Task baseline" in rules.md).

## Baseline reuse

Never: always run the baseline tests.
