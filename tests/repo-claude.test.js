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
// A key with an indented block below (`hooks:`) gets the block's text as its value.
function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  assert.ok(m, `${file}: no frontmatter`);
  const fields = {};
  let block = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (block && /^ {2}/.test(line)) {
      fields[block] += `${line}\n`;
      continue;
    }
    block = null;
    const key = /^([A-Za-z-]+):$/.exec(line);
    if (key) {
      block = key[1];
      fields[block] = '';
      continue;
    }
    const kv = /^([A-Za-z-]+): (.*)$/.exec(line);
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
  for (const s of ['AskUserQuestion', 'Never mention GitLab', '`axis-pr-opener` call, prompt lines only', '`Commit message file:`', '`Body file:`', 'never paste it again', 'never `gh pr merge`', '`Co-Authored-By` trailer this session', 'never one that only ran commands']) {
    assert.ok(skill.includes(s), `axis-open-pr: ${s}`);
  }
  assert.ok(!/gh pr create --|git push -/.test(skill), 'axis-open-pr leaves committing and opening to the subagent');
  const agent = fs.readFileSync(path.join(claude, 'agents', 'axis-pr-opener.md'), 'utf8');
  for (const s of ['--assignee <assignee>', '--milestone', '-F <commit message file>', '--body-file <body file>', 'closingIssuesReferences', 'never change, add to, or guess', 'no `cd`, no chaining']) {
    assert.ok(agent.includes(s), `axis-pr-opener: ${s}`);
  }
  // The texts come final from the main session: the subagent adds no trailer or footer of its own model.
  assert.ok(!/Co-Authored-By|Generated with/.test(agent), 'axis-pr-opener adds no attribution');
});

test('command-only subagents: Bash only, no CLAUDE.md, short description', () => {
  for (const name of ['axis-test-runner', 'axis-issue-creator', 'axis-pr-opener', 'axis-live-check']) {
    const fm = frontmatter(path.join(claude, 'agents', `${name}.md`));
    assert.strictEqual(fm.tools, 'Bash', `${name}: tools`);
    assert.strictEqual(fm.omitClaudeMd, 'true', `${name}: omitClaudeMd`);
    assert.strictEqual(fm.effort, 'low', `${name}: effort`);
    assert.ok(fm.description.length <= 130, `${name}: description is ${fm.description.length} characters`);
  }
});

test('axis-e2e-writer: Sonnet, e2e/CLAUDE.md only, guarded by its hook', () => {
  const file = path.join(claude, 'agents', 'axis-e2e-writer.md');
  const fm = frontmatter(file);
  assert.strictEqual(fm.model, 'sonnet');
  assert.strictEqual(fm.omitClaudeMd, 'true');
  assert.strictEqual(fm.effort, 'medium');
  assert.strictEqual(fm.tools, 'Read, Grep, Edit, Write, Bash', 'tools: no Glob, Grep finds files');
  assert.strictEqual(fm.disallowedTools, 'mcp__*', 'no MCP tools');
  assert.ok(fm.description.length <= 130, `description is ${fm.description.length} characters`);
  assert.match(fm.hooks, /PreToolUse:\n\s+- matcher: "Edit\|Write\|Bash"\n[\s\S]*\.claude\/hooks\/e2e-writer-guard\.js/);
  assert.ok(fs.existsSync(path.join(claude, 'hooks', 'e2e-writer-guard.js')), 'hook script exists');
  const text = fs.readFileSync(file, 'utf8');
  for (const s of ['Read `e2e/CLAUDE.md` first', 'never read `e2e/lib/harness.js` or `e2e/<plugin>/lib.js` whole', 'git diff -- <changed paths>', 'read only the one scenario','Edit only files under `e2e/`', 'no `cd`, no chaining', 'e2e: pass', 'PLUGIN BUG']) {
    assert.ok(text.includes(s), `axis-e2e-writer: ${s}`);
  }
});

test('axis-live-check: runs only confirmed checks through the script, one line each', () => {
  const file = path.join(claude, 'agents', 'axis-live-check.md');
  assert.strictEqual(frontmatter(file).disallowedTools, 'mcp__*');
  const text = fs.readFileSync(file, 'utf8');
  for (const s of ['the user already confirmed them', 'Never add, retry, or change a check', 'node scripts/live-check.js <name> --prompt-file <file>', 'No `cd`, no chaining', '<name>: pass|FAIL']) {
    assert.ok(text.includes(s), `axis-live-check: ${s}`);
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
  for (const s of ['AskUserQuestion', 'Never mention GitLab', '`axis-issue-creator` call, prompt lines only', '`Body file:`', 'never paste it again']) {
    assert.ok(skill.includes(s), `axis-new-issue: ${s}`);
  }
  assert.ok(!/gh issue create --/.test(skill), 'axis-new-issue leaves creating to the subagent');
  const agent = fs.readFileSync(path.join(claude, 'agents', 'axis-issue-creator.md'), 'utf8');
  for (const s of ['--assignee <assignee>', '--milestone', '--body-file <body file>', 'node .github/scripts/issue-fields.js', 'never change, add to, or guess', 'no `cd`, no chaining']) {
    assert.ok(agent.includes(s), `axis-issue-creator: ${s}`);
  }
});
