# Version control: git

Rules for projects with INDEX `- Version control: git` ("Version control" in rules.md). The other version controls have the same sections in `vcs-tfvc.md` and `vcs-none.md`.

## Ignore file

`.gitignore` at the project root (create it if missing; no duplicate line):
- Workbench `ignored`: `workbench/`.
- Workbench `tracked`: `workbench/.baseline/` (temporary snapshots).
- CLAUDE.md block in `CLAUDE.local.md`: `CLAUDE.local.md`.

## Empty subfolders

A `.gitkeep` in each `workbench/` subfolder (`tracked` or `ignored`), written with `Write`.

## Commit policy

As the contract's Working Rules say (asked by setup and `/foreman:new`).

## Start state

**Start hash** - isolates the task's changes from earlier uncommitted ones (an earlier task's or the user's) in the same files:
- Before the worker starts, run `git stash create`. It stores the current tracked files and index as a commit object and prints its hash; it changes no file, the index, any branch, or the stash list. Empty output means a clean tree: use `git log -1 --format=%H`. If it fails (e.g. an unfinished merge), use `git log -1 --format=%H` and tell the user that earlier uncommitted changes will show in the task's diff.
- Also record `git status --porcelain` (the untracked files at the start). `git stash create` does not include untracked files, so snapshot every file in the task's `Files Expected to Change` that is untracked at the start (e.g. new and not yet committed by an earlier task), as in "Snapshot" in rules.md.
- Log it (`Main agent`, `Action`, `start state: <hash>`).

## Task changes

At verification and in every fix round: `git diff <start hash>` (tracked files), files untracked now but not at the start (new: show in full), and the snapshot diff of files untracked at the start. Never plain `git diff`, which also shows earlier uncommitted changes.

## Commit

Only when the contract's commit policy says the main agent commits (`/foreman:run` Pass and `/foreman:close`):
1. **Files**: only the task's own changes, by explicit path - the files of its verified diff (changed, new, deleted, renamed since the recorded start state). Workbench `tracked`: also the `workbench/` files this command changed (TRK, doc, task file, INDEX), written before the commit; never `workbench/.baseline/`. Workbench `ignored`: no `workbench/` files.
2. **Not the task's**: if a listed file also has changes that are not the task's (the user's changes kept at the pre-check, another task's uncommitted changes), show them and ask whether to include the whole file or leave it out of this commit.
3. **Show and ask**: show the file list (`git status --porcelain -- <paths>`, `git diff HEAD --stat -- <paths>`) and the commit message (references `P-NN TASK-TT`), then ask with `AskUserQuestion`: commit, or leave the changes uncommitted. Log the answer (`User`, `Decision`).
4. **Commit** on yes: `git add -- <new files>` for untracked files only, then `git commit -m "<message>" -- <paths>`. This commits exactly those paths; anything else the user has staged stays staged and is not committed. Never `git add -A`, `git add .`, `git add -u`, or `git commit -a`.
5. **Log** the commit (`Main agent`, `Action`, with its hash). This Activity row is written after the commit, so it goes into the next commit.

## Deletes, renames, new files

The worker deletes and renames only the files the task lists for that; new files go into the commit above (or stay for the user).

## Task baseline

- Set: the current commit, `git log -1 --format=%H`.
- What changed since: `git log --oneline <hash>..HEAD -- <files>` and `git diff <hash> -- <files>` (includes uncommitted changes).

## Baseline reuse

Skip the baseline test run and reuse the last recorded test run when all of these hold, else run it:
1. The last test run in this TRK's Activity used exactly the same commands and recorded `state: <hash>, untracked: none` (see below).
2. `git diff --stat <hash> -- . ":!workbench"` prints nothing (no tracked change outside `workbench/` since then).
3. `git status --porcelain --untracked-files=all -- . ":!workbench"` lists no untracked file now (untracked content cannot be compared; the recorded run must say `untracked: none` too).

Then log `Main agent`, `Action`, `baseline reused from TASK-xx: <commands> -> <result>`; the failures of that run count as the baseline. Otherwise run the baseline and add `(not reused: <which check failed>)` to its Activity row, so every baseline shows the decision.

**Recording the state**: after each verification test run, run `git stash create` (or `git log -1 --format=%H` when it prints nothing, a clean tree) and `git status --porcelain --untracked-files=all -- . ":!workbench"`, and add `state: <hash>, untracked: none` (or `untracked: yes`) to that run's Activity row. When the main agent then commits the task ("Commit"), record the same again after the commit (`git log -1 --format=%H` and the untracked check) in the commit's Activity row: the task's new files are tracked now, so the next task can reuse that run.
