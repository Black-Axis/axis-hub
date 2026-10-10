// Checks the repo's own Claude Code subagents and skills (.claude/agents, .claude/skills):
// axis- names, frontmatter that parses, a model on agents, and skills that stay out of the context.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const claude = path.resolve(__dirname, '..', '.claude');
const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);

// Returns { key: value } of the frontmatter; fails on lines a YAML parser would misread.
function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  assert.ok(m, `${file}: no frontmatter`);
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([a-z-]+): (.*)$/.exec(line);
    assert.ok(kv, `${file}: unexpected frontmatter line "${line}"`);
    let value = kv[2];
    if (/^".*"$/.test(value)) value = value.slice(1, -1);
    else assert.ok(!/: | #/.test(value), `${file}: ${kv[1]} has an unquoted ": " or " #"`);
    fields[kv[1]] = value;
  }
  return fields;
}

test('agents: axis- names matching the file, description, model, tools', () => {
  for (const f of list(path.join(claude, 'agents')).filter((n) => n.endsWith('.md'))) {
    const fm = frontmatter(path.join(claude, 'agents', f));
    assert.match(f, /^axis-[a-z0-9-]+\.md$/, f);
    assert.strictEqual(fm.name, f.slice(0, -3), `${f}: name`);
    assert.ok(fm.description, `${f}: description`);
    assert.ok(['haiku', 'sonnet', 'opus'].includes(fm.model), `${f}: model`);
    assert.ok(fm.tools, `${f}: tools (smallest set)`);
  }
});

test('skills: axis- names matching the folder, user-invoked only', () => {
  for (const d of list(path.join(claude, 'skills'))) {
    const fm = frontmatter(path.join(claude, 'skills', d, 'SKILL.md'));
    assert.match(d, /^axis-[a-z0-9-]+$/, d);
    assert.strictEqual(fm.name, d, `${d}: name`);
    assert.ok(fm.description, `${d}: description`);
    assert.strictEqual(fm['disable-model-invocation'], 'true', `${d}: disable-model-invocation keeps it out of the context`);
  }
});
