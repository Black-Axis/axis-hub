# Foreman Version Control Rules

Part of the foreman shared rules (`${CLAUDE_PLUGIN_ROOT}/reference/rules.md`, "Topic files"). Read by `init`, `new`, `interview`, `import`, `change`, `run`, `round`, `close`, `cancel`, `hold`, `doctor`, and `settings`; `detection.md` and `snapshot.md` (same folder) only when needed.

## Version control

INDEX `Settings` holds two lines:
- `- Version control: git | tfvc | none` - the project's version control. `tfvc` is Team Foundation Version Control (Azure DevOps Server / TFS).
- `- Workbench: tracked | ignored` - whether `workbench/` is kept in version control. The older line `- Git: committed | ignored` means the same (`committed` = `tracked`): read it as `Workbench`; `/foreman:doctor` offers to rename it.

**Detection**: when the INDEX `Version control` line is missing, read `detection.md` (in this folder) and follow it; setup and `/foreman:doctor` always use it.

**Per version control rules**: everything that depends on the version control - ignore file, empty subfolders, commit policy, a task's start state and changes, commits or check-ins, deletes and renames, read-only files, `tf` availability, the task baseline, baseline test reuse - is in `${CLAUDE_PLUGIN_ROOT}/reference/vcs-<value>.md` (`vcs-git.md`, `vcs-tfvc.md`, `vcs-none.md`). A command that does any of these reads only the file for the INDEX value (after detection when the line is missing), before its first question ("Questions and follow-up turns" in rules.md); `/foreman:settings` also reads the file of a new value. The three files share their section names: "<Section>" in the vcs file means that section of the project's file.

Never run version control commands that change state (commit, check-in, shelve, checkout, add, delete, rename, undo) except where the vcs file and the command files say so, and then only after telling the user. Read-only commands (`git status`, `git diff`, `git log`, `git ls-files`, `git stash create` (writes only an unreferenced commit object), `tf status`, `tf diff`, `tf history`, and read-only file listings for modification times) are always fine.

**Task baseline** - the project state a task file was written against, in the task header `Baseline` row. Every command that creates a task file or rewrites its Evidence, Files Expected to Change, or Implementation (`new`, `interview`, `import`, `change`, the `run` pre-check) sets it as "Task baseline" in the vcs file says, and uses it to see what changed in the task's files since.
- **Date baseline** (none, tfvc without `tf`): the current date and time, `YYYY-MM-DD HH:MM`, taken from a command (`date '+%Y-%m-%d %H:%M'`, or PowerShell `Get-Date -Format 'yyyy-MM-dd HH:mm'`), never from memory. What changed since: the files' modification times compared with the baseline time (read-only command, as for snapshots). This shows that a file changed, not how; read it again in full. A date baseline (or a value of another version control) is compared this way in every project.
- A missing or unreadable baseline (tasks created before 1.3.0): use the task's Created date as a date baseline.

**Snapshot**: the copy of a task's listed files taken before the worker starts (tfvc and none; git only for listed files untracked at the start) is in `snapshot.md` (in this folder); the vcs file says when to read it.

**Snapshot cleanup**: `wb.js status` deletes `workbench/.baseline/P-NN/TASK-TT/` (with the session marker, "Sessions" in sessions.md) when the task leaves `In Progress`, whichever command changes the status (`run`, `hold`, `cancel`, ...); `wb.js refresh P-NN` removes leftovers of tasks not `In Progress`. Without Node, delete it then with one shell command (`rm -rf <dir>`, or PowerShell `Remove-Item -Recurse -Force '<dir>'`; the user's normal permission prompt applies). Keep `workbench/.baseline/` out of version control ("Ignore file" in the vcs file).
