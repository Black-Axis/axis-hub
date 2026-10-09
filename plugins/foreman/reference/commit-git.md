# Foreman Commit (git)

Read by `/foreman:run` and `/foreman:close` only when the contract's commit policy says the main agent commits, at the step that commits ("Commit" in `vcs-git.md`).

## Commit

Only when the contract's commit policy says the main agent commits (`/foreman:run` Pass and `/foreman:close`):
1. **Files**: only the task's own changes, by explicit path - the files of its verified diff (changed, new, deleted, renamed since the recorded start state). Workbench `tracked`: also the `workbench/` files this command changed (TRK, doc, task file, INDEX), written before the commit; never `workbench/.baseline/`. Workbench `ignored`: no `workbench/` files.
2. **Not the task's**: if a listed file also has changes that are not the task's (the user's changes kept at the pre-check, another task's uncommitted changes), show them and ask whether to include the whole file or leave it out of this commit.
3. **Show and ask**: show the file list (`git status --porcelain -- <paths>`, `git diff HEAD --stat -- <paths>`) and the commit message (references `P-NN TASK-TT`), then ask with `AskUserQuestion`: commit, or leave the changes uncommitted. Log the answer (`User`, `Decision`).
4. **Commit** on yes: `git add -- <new files>` for untracked files only, then `git commit -m "<message>" -- <paths>`. This commits exactly those paths; anything else the user has staged stays staged and is not committed. Never `git add -A`, `git add .`, `git add -u`, or `git commit -a`.
5. **Log** the commit (`Main agent`, `Action`, with its hash). This Activity row is written after the commit, so it goes into the next commit.
