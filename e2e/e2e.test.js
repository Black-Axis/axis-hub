// Runs every e2e scenario (e2e/<plugin>/scenarios/*.js) under node --test, so CI
// runs them too, and checks that each component of a plugin is covered.
// Manual run with readable output: node e2e/run.js [plugin] [scenario]

const test = require('node:test');
const assert = require('node:assert');
const { plugins, scenarios, runScenario, components } = require('./lib/harness');

for (const plugin of plugins()) {
  const list = scenarios(plugin);
  for (const s of list) {
    test(`e2e ${plugin}: ${s.id} - ${s.name}`, () => {
      const r = runScenario(plugin, s);
      if (!r.ok) {
        r.error.message = `after step "${r.steps[r.steps.length - 1] || '(setup)'}": ${r.error.message}`;
        throw r.error;
      }
    });
  }
  test(`e2e ${plugin}: every component is covered by a scenario`, () => {
    const covered = new Set(list.flatMap((s) => s.covers || []));
    assert.deepStrictEqual(components(plugin).filter((c) => !covered.has(c)), []);
    for (const s of list) for (const c of s.covers || []) assert.ok(components(plugin).includes(c), `${s.id} covers unknown "${c}"`);
  });
}
