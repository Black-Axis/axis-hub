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

test('settings allow only the check and issue fields scripts, never a broad tool or gh issue create', () => {
  const allow = JSON.parse(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8')).permissions.allow;
  for (const rule of allow) {
    assert.match(rule, /^(Bash|PowerShell)\(node (scripts\/check-all\.js|e2e\/run\.js|\.github\/scripts\/issue-fields\.js)(:\*)?\)$/, rule);
  }
});

test('axis-test-runner runs the allowed commands bare, never after a cd', () => {
  const text = fs.readFileSync(path.join(claude, 'agents', 'axis-test-runner.md'), 'utf8');
  assert.match(text, /never prefix it with `cd`, never chain commands/);
});

test('axis-open-pr proposes and asks; axis-pr-opener commits, pushes, opens', () => {
  const skill = fs.readFileSync(path.join(claude, 'skills', 'axis-open-pr', 'SKILL.md'), 'utf8');
  for (const s of ['AskUserQuestion', 'Never mention GitLab', '`axis-pr-opener` subagent', 'never `documentation`', 'krypton225', 'never `gh pr merge`', '`Co-Authored-By` trailer of the model running this session', 'Never credit a model that only ran commands']) {
    assert.ok(skill.includes(s), `axis-open-pr: ${s}`);
  }
  assert.ok(!/gh pr create --|git push -/.test(skill), 'axis-open-pr leaves committing and opening to the subagent');
  const agent = fs.readFileSync(path.join(claude, 'agents', 'axis-pr-opener.md'), 'utf8');
  for (const s of ['--assignee <assignee>', '--milestone', 'closingIssuesReferences', 'never change, add to, or guess', 'no `cd`, no chaining']) {
    assert.ok(agent.includes(s), `axis-pr-opener: ${s}`);
  }
  // The texts come final from the main session: the subagent adds no trailer or footer of its own model.
  assert.ok(!/Co-Authored-By|Generated with/.test(agent), 'axis-pr-opener adds no attribution');
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

test('skills: allowed-tools only scoped command rules, never a whole tool', () => {
  for (const d of list(path.join(claude, 'skills'))) {
    const tools = frontmatter(path.join(claude, 'skills', d, 'SKILL.md'))['allowed-tools'];
    if (!tools) continue;
    for (const rule of tools.split(/,\s*/)) {
      assert.match(rule, /^(Bash|PowerShell)\([a-z][^()*]*:\*\)$|^(Bash|PowerShell)\([a-z][^()*]*\)$/, `${d}: "${rule}" is too broad`);
    }
  }
});

test('axis-new-issue proposes and asks; axis-issue-creator creates', () => {
  const skill = fs.readFileSync(path.join(claude, 'skills', 'axis-new-issue', 'SKILL.md'), 'utf8');
  for (const s of ['AskUserQuestion', 'Never mention GitLab', '`axis-issue-creator` subagent', 'krypton225']) {
    assert.ok(skill.includes(s), `axis-new-issue: ${s}`);
  }
  assert.ok(!/gh issue create --/.test(skill), 'axis-new-issue leaves creating to the subagent');
  const agent = fs.readFileSync(path.join(claude, 'agents', 'axis-issue-creator.md'), 'utf8');
  for (const s of ['--assignee <assignee>', '--milestone', 'node .github/scripts/issue-fields.js', 'never change, add, or guess', 'no `cd`, no chaining']) {
    assert.ok(agent.includes(s), `axis-issue-creator: ${s}`);
  }
});
