# Foreman Version Control Detection

Part of the foreman shared rules (`${CLAUDE_PLUGIN_ROOT}/reference/rules.md`, "Topic files"). Read when the INDEX `Version control` line is missing, during setup (`setup.md`), and by `/foreman:doctor`.

## Detection

A `.git` folder or file in the project root or a parent folder → `git`; a `$tf` or `.tf` folder (TFVC local workspace) or a `.tfignore` file in the root or a parent folder → `tfvc`; otherwise `none`. TFVC server workspaces leave no marker: when the result is `none`, ask the user (`git` / `tfvc` / `none`). When the line is missing, add the detected value and tell the user in one line.
