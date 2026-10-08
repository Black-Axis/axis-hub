## What and why

<!-- What changed, and the problem it solves. Link issues: Closes #123 -->

## Plugins affected

- [ ] foreman
- [ ] marketplace / repository

## Checklist

- [ ] Branch named `<type>/<short-name>` (e.g. `feat/foreman-bug-command`).
- [ ] `claude plugin validate .` and `claude plugin validate plugins/<plugin>` pass.
- [ ] `node --test` passes (includes the e2e scenarios; `node e2e/run.js` for readable output).
- [ ] New or changed commands, agents, skills, hooks, or script subcommands are covered by an e2e scenario in `e2e/<plugin>/`.
- [ ] Tried the changed commands, agents, skills, or hooks in Claude Code.
- [ ] `version` bumped and equal in `plugin.json` and `marketplace.json`; `description` and `keywords` in sync.
- [ ] `CHANGELOG.md` updated (plugin and/or root).
- [ ] Plugin `README.md`, root `README.md`, and `CLAUDE.md` updated where relevant.
- [ ] `allowed-tools` stays scoped; no broad `Edit`, `Write`, or `Bash`.
- [ ] No secrets, tokens, or personal data.
- [ ] First contribution: added myself to `AUTHORS.md`.
