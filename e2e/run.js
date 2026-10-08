#!/usr/bin/env node
// Runs the e2e scenarios without a model: node e2e/run.js [plugin] [scenario]
// Sample projects are built in e2e/.work/<plugin>/<scenario>/ (gitignored) and kept
// after the run for inspection. Exit 1 when a scenario fails or a component of a
// plugin is covered by no scenario.
'use strict';

const { plugins, scenarios, runScenario, components, rel, REPO } = require('./lib/harness');
const path = require('path');

const [onlyPlugin, onlyScenario] = process.argv.slice(2);
let failed = 0;
for (const plugin of plugins().filter((p) => !onlyPlugin || p === onlyPlugin)) {
  const list = scenarios(plugin);
  console.log(`${plugin}`);
  for (const s of list.filter((x) => !onlyScenario || x.id === onlyScenario)) {
    const t0 = Date.now();
    const r = runScenario(plugin, s);
    const ms = Date.now() - t0;
    if (r.ok) {
      console.log(`  ok   ${s.id} - ${s.name} (${r.steps.length} steps, ${ms} ms)`);
    } else {
      failed++;
      console.log(`  FAIL ${s.id} - ${s.name}`);
      console.log(`       after step ${r.steps.length}: ${r.steps[r.steps.length - 1] || '(setup)'}`);
      console.log(`       ${String(r.error && r.error.message).split('\n').join('\n       ')}`);
      console.log(`       project: ${rel(path.relative(REPO, r.dir))}`);
    }
  }
  if (!onlyScenario) {
    const covered = new Set(list.flatMap((s) => s.covers || []));
    const missing = components(plugin).filter((c) => !covered.has(c));
    if (missing.length) {
      failed++;
      console.log(`  FAIL coverage - not covered by any scenario: ${missing.join(', ')}`);
    } else {
      console.log(`  ok   coverage - ${components(plugin).length} components`);
    }
  }
}
process.exitCode = failed ? 1 : 0;
