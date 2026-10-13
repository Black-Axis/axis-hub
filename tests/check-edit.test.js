// Checks the PostToolUse hook .claude/hooks/check-edit.js: line endings against
// what git checks out, frontmatter that would not parse, silence otherwise.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const script = path.resolve(__dirname, '..', '.claude', 'hooks', 'check-edit.js');
const { eolOf, expectedEol, frontmatterProblems, check } = require(script);

test('eolOf and expectedEol', () => {
  assert.strictEqual(eolOf('a\r\nb\r\n'), 'crlf');
  assert.strictEqual(eolOf('a\nb\n'), 'lf');
  assert.strictEqual(eolOf('a\r\nb\n'), 'mixed');
  assert.strictEqual(eolOf('a'), null);
  assert.strictEqual(expectedEol('lf', '', 'true'), 'crlf');
  assert.strictEqual(expectedEol('lf', '', 'false'), 'lf');
  assert.strictEqual(expectedEol('lf', '', ''), 'lf');
  assert.strictEqual(expectedEol('lf', 'text eol=lf', 'true'), 'lf');
  assert.strictEqual(expectedEol('crlf', 'text eol=crlf', 'false'), 'crlf');
  assert.strictEqual(expectedEol('lf', '-text', 'true'), null);
  assert.strictEqual(expectedEol('mixed', '', 'true'), null);
});

test('frontmatterProblems: unquoted ": " or " #", silent for valid frontmatter', () => {
  assert.deepStrictEqual(frontmatterProblems('---\nname: x\ndescription: "a: b # c"\n---\nbody: here'), []);
  assert.deepStrictEqual(frontmatterProblems('---\nhooks:\n  PreToolUse:\n    - matcher: "Bash"\n---\n'), []);
  assert.deepStrictEqual(frontmatterProblems('no frontmatter: here'), []);
  assert.deepStrictEqual(frontmatterProblems('---\nname: x\ndescription: Runs checks: all of them\n---\n'), ['frontmatter line 3: description has an unquoted ": " or " #" - quote the value']);
  assert.match(frontmatterProblems('---\r\nargument-hint: [P-NN] [TASK-TT]\r\n---\r\n')[0] || '', /argument-hint starts with "\[" but is not one list or map/);
  assert.deepStrictEqual(frontmatterProblems('---\npaths: ["a/**", "b"]\nhint: <P-NN> [TASK-TT]\n---\n'), []);
  assert.match(frontmatterProblems('---\nnot a key\n---\n')[0] || '', /not "key: value"/);
});

test('check: warns on a CRLF file rewritten with LF, on mixed endings, on bad frontmatter; silent otherwise', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axis-check-edit-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...a], { cwd: dir, stdio: 'ignore' });
  try {
    git('init', '-q');
    git('config', 'core.autocrlf', 'true');
    fs.writeFileSync(path.join(dir, 'a.md'), '---\nname: a\n---\nline\n');
    fs.writeFileSync(path.join(dir, '.gitattributes'), 'lf.sh text eol=lf\n');
    fs.writeFileSync(path.join(dir, 'lf.sh'), 'echo\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'x');
    const file = (n) => path.join(dir, n);

    fs.writeFileSync(file('a.md'), '---\r\nname: a\r\n---\r\nline\r\n');
    assert.deepStrictEqual(check(file('a.md'), dir), [], 'CRLF as git checks it out: silent');
    fs.writeFileSync(file('a.md'), '---\nname: a\n---\nline\n');
    assert.match(check(file('a.md'), dir).join(), /a\.md: line endings are now LF, git checks it out with CRLF/);
    fs.writeFileSync(file('a.md'), '---\r\nname: a\n---\r\n');
    assert.match(check(file('a.md'), dir).join(), /mixed CRLF and LF/);
    fs.writeFileSync(file('a.md'), '---\r\ndescription: Runs: all\r\n---\r\n');
    assert.match(check(file('a.md'), dir).join(), /description has an unquoted/);
    assert.deepStrictEqual(check(file('lf.sh'), dir), [], 'eol=lf file in LF: silent');
    fs.writeFileSync(file('lf.sh'), 'echo\r\n');
    assert.match(check(file('lf.sh'), dir).join(), /now CRLF, git checks it out with LF/);
    fs.writeFileSync(file('new.md'), 'new\n');
    assert.deepStrictEqual(check(file('new.md'), dir), [], 'untracked file: no line ending warning');
    assert.deepStrictEqual(check(path.join(os.tmpdir(), 'outside.md'), dir), [], 'outside the project');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the script prints context only on a problem and survives bad input', () => {
  const run = (input, env = {}) => execFileSync('node', [script], { input, env: { ...process.env, ...env }, encoding: 'utf8' });
  for (const input of ['', 'not json', 'null', '{}', '{"tool_input":{"file_path":5}}']) assert.strictEqual(run(input), '', input);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axis-check-edit-'));
  try {
    fs.writeFileSync(path.join(dir, 'x.md'), '---\ndescription: a: b\n---\n');
    const out = JSON.parse(run(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(dir, 'x.md') } }), { CLAUDE_PROJECT_DIR: dir }));
    assert.strictEqual(out.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.match(out.hookSpecificOutput.additionalContext, /^check-edit: x\.md: frontmatter line 2: description has an unquoted/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('settings run the hook after Write, Edit, and MultiEdit', () => {
  const settings = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '.claude', 'settings.json'), 'utf8'));
  const post = (settings.hooks.PostToolUse || []).find((h) => h.hooks.some((x) => x.command.includes('check-edit.js')));
  assert.ok(post, 'PostToolUse entry for check-edit.js');
  assert.strictEqual(post.matcher, 'Write|Edit|MultiEdit');
});
