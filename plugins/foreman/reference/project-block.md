# Foreman Project Instructions Block

Part of the foreman shared rules (`${CLAUDE_PLUGIN_ROOT}/reference/rules.md`, "Topic files"). Read by `init`, `new`, `interview`, `import` (through `setup.md`), `settings`, and `doctor`.

## Project instructions block

The INDEX setting `- CLAUDE.md: yes | no` controls a short block that tells Claude about `workbench/` in every session of the project. The block is the full content of the `claude-md.md` template, from `<!-- foreman:start` to `<!-- foreman:end -->`. Never change text outside these markers.

- **Target file**: if Workbench is `tracked`, the project's shared instructions: `CLAUDE.md` at the project root, or `.claude/CLAUDE.md` if that exists and the root one does not. If Workbench is `ignored`, the personal `CLAUDE.local.md` at the project root, and add `CLAUDE.local.md` to the ignore file ("Ignore file" in the vcs file; no duplicate line).
- **AGENTS.md projects**: if the project has an `AGENTS.md` and none of `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, creating a CLAUDE file makes Claude Code stop reading `AGENTS.md`. Tell the user and ask: create the file starting with the line `@AGENTS.md` (keeps AGENTS.md loaded - recommended), or do not add the block (set `CLAUDE.md: no`). Never write the block into `AGENTS.md`.
- **Write (`yes`)**: if the target file has the markers, replace everything between and including them with the template; otherwise append the block at the end, after one blank line (create the file if missing). Remove a foreman block from the other CLAUDE file if one is there.
- **Remove (`no`)**: delete the block, markers included, from every CLAUDE file that has one. If a file is left empty (or only `@AGENTS.md` that foreman added), ask before deleting the file.
- These files are outside `workbench/`: the user's normal permission prompt applies. Tell the user in one line which file was changed.
