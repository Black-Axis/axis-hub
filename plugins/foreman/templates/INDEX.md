# Foreman Index

## Settings

- Version control: {{git | tfvc | none}}
- Workbench: {{tracked | ignored}}
  <!-- whether workbench/ is kept in version control -->
- Output: {{Concise | Normal}}
  <!-- Concise (default) | Normal - style of all foreman replies, reports, and files -->
- Fix rounds: {{0-10, default 4}}
  <!-- times the main agent sends failed-verification feedback back to the worker before Hold; 0 = none -->
- CLAUDE.md: {{yes | no}}
  <!-- yes = a short foreman block in CLAUDE.md (Workbench tracked) or CLAUDE.local.md (Workbench ignored) tells Claude about workbench/ -->

- Created: {{YYYY-MM-DD}}

## Working Rules Defaults

<!-- proposed for every new contract's Working Rules; set by /foreman:init, changed by /foreman:settings rules -->
- Commit policy: {{never auto-commit | main agent commits after each verified task | other; always "never auto-commit (user checks in)" for tfvc and none}}
- Auto-close: {{Ask | Yes | No}}
- Tests: {{required commands, e.g. `npm test`, or "none available"}}
- Baseline tests: {{yes | no}}
- Full tests: {{close | each task}}
- Standards: {{coding standards / conventions to follow}}
- Ask the user when: {{situations where the main agent must stop and ask}}

## Features

| # | Feature | Plan | Contract | Tracking | Doc | Contract Status | Progress |
|---|---------|------|----------|----------|-----|-----------------|----------|
