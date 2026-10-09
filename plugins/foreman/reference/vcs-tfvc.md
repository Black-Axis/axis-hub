# Version control: tfvc

Rules for projects with INDEX `- Version control: tfvc` ("Version control" in version-control.md): Team Foundation Version Control (Azure DevOps Server / TFS). `tf.exe` may be missing, so every step has a no-`tf` fallback. The other version controls have the same sections in `vcs-git.md` and `vcs-none.md`.

## `tf` availability

At the start of `/foreman:run`, `/foreman:round`, and `/foreman:close`, run `tf status` once. If the command is not found or fails, `tf` is unavailable for that run: use snapshots and ask the user for source control actions.

## Ignore file

`.tfignore` at the project root (create it if missing; no duplicate line):
- Workbench `ignored`: `\workbench`. Files already in source control stay there until the user removes them in Visual Studio; say so.
- Workbench `tracked`: `workbench/.baseline/` (temporary snapshots).
- CLAUDE.md block in `CLAUDE.local.md`: `\CLAUDE.local.md`.

## Empty subfolders

Not needed: TFVC versions folders. Create the folders with the `mkdir` / `New-Item` form in `reference/setup.md`.

## Commit policy

Always `never auto-commit (user checks in)`; do not ask about it.

## Start state

`tf status` (if `tf` is available), and a snapshot of the task's listed files ("Snapshot" in snapshot.md - read `snapshot.md`, in this folder, now). The snapshot is kept even when `tf` works, so the diff of each listed file never depends on the workspace type.

## Task changes

`tf diff /format:unified` and `tf status` (if `tf` is available), and the snapshot diff and modification-time check ("Snapshot" in snapshot.md).

## Read-only files

Pre-check of `/foreman:run`: every existing file in `Files Expected to Change` must be writable (a TFVC server workspace keeps files read-only until checked out). Check with a read-only command (`test -w <file>`, or PowerShell `(Get-Item <file>).IsReadOnly`). For read-only files: if `tf` is available, tell the user and run `tf checkout <files>` (one command, their normal permission prompt applies); otherwise list the files and ask the user to check them out in Visual Studio (Solution Explorer → Check Out for Edit), then re-check. Never clear the read-only flag yourself. Log the result (`Main agent`, `Action`).

## Commit

Never check in: the user checks in. After a verified task, tell the user the task's changes are ready to review and check in (pending changes); after `/foreman:close`, that the feature is ready to check in.

## Deletes, renames, new files

The worker never deletes or renames; it reports what is needed. After a verified task, for deletes and renames the worker reported as needed, and for new files: with `tf` available, propose `tf delete` / `tf rename` / `tf add` for those files and run them only on the user's yes; without `tf`, list them for the user to do in Visual Studio. Log what was run (`Main agent`, `Action`).

## Task baseline

- With `tf`: set the latest changeset, `C<number>` from `tf history . /recursive /stopafter:1 /noprompt`. What changed since: `tf history <file> /version:C<n+1>~T /noprompt` per file, and `tf status <files>` for pending changes.
- Without `tf`: a date baseline ("Task baseline" in version-control.md).

## Baseline reuse

Never: always run the baseline tests.
