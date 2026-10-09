---
description: Draw a Mermaid map of the features and their files (interview, plan, contract, tracking, tasks, doc, reports) to workbench/maps/
argument-hint: "[P-NN]"
allowed-tools: Read, Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js":*)
---

# /foreman:map

Input: $ARGUMENTS

First read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` and follow it. The state script builds and writes the map; do not read the feature files or the map yourself.

State script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/wb.js"` ("State script" in rules.md).

1. If `workbench/INDEX.md` does not exist, tell the user to start with `/foreman:init` or `/foreman:new` and stop.
2. Run `wb.js map` (all features, closed ones too) or `wb.js map P-NN` when the input names a feature (`INT-NN` means the same number: pass `P-NN`). On `ERROR: <reason>`, show the reason and stop. If `node` is not found, tell the user: "The map needs Node.js - install it and run /foreman:map again." and stop; never build the map by hand.
3. Reply with the script's lines only: the map path (`workbench/maps/MAP.md` or `MAP-NN.md`), then its summary. Add one line: "Open it in GitHub, GitLab, or VS Code (Markdown preview) to see the diagram." Never print the diagram in chat.
