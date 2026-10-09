# Foreman Snapshots

Part of the foreman shared rules (`${CLAUDE_PLUGIN_ROOT}/reference/rules.md`, "Topic files"). Read by `/foreman:run` and `/foreman:round` when the vcs file says so: always with tfvc and none, with git only when a file in the task's `Files Expected to Change` is untracked at the start. Cleanup is "Snapshot cleanup" in `version-control.md`.

## Snapshot

Tfvc and none; git only for listed files untracked at the start. Before the worker starts, copy every existing file in the task's `Files Expected to Change` to `workbench/.baseline/P-NN/TASK-TT/<same relative path>` and create the stamp file `.stamp` there; its modification time is the snapshot time. Do it with one shell command (the user's normal permission prompt applies), never with Read + Write, which can change line endings, a BOM, or the encoding, cannot copy binary files, and loads every file into context:
- shell: `mkdir -p <dir> && tar cf - <files> | tar xf - -C <dir> && touch <dir>/.stamp`
- PowerShell: `foreach ($f in @('<file>', ...)) { $d = Join-Path '<dir>' $f; New-Item -ItemType Directory -Force (Split-Path $d) | Out-Null; Copy-Item $f $d }; New-Item -ItemType File '<dir>/.stamp' | Out-Null`

Afterwards:
- Diff each listed file against its copy (`diff -u <copy> <file>` if a `diff` command exists; otherwise compare them yourself and show the changed lines in unified diff form). A listed file with no copy is new: show it in full.
- Find files changed outside the list: list files modified after the stamp with a read-only command (`find . -newer <dir>/.stamp -type f`, or PowerShell `Get-ChildItem -Recurse -File | Where-Object LastWriteTime -gt (Get-Item '<dir>/.stamp').LastWriteTime`), excluding `workbench/` and dependency and build folders. Without version control this cannot see deleted files or every change; tell the user once per task that changes outside the list are checked by modification time only.
