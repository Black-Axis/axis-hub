// Tests for plugins/foreman/hooks/workbench-guard.js (PreToolUse).
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..');
const hook = path.join(repo, 'plugins', 'foreman', 'hooks', 'workbench-guard.js');

function project({ index = true, workbench = true, deny } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-guard-'));
  if (workbench) fs.mkdirSync(path.join(dir, 'workbench', 'tracking'), { recursive: true });
  if (workbench && index) fs.writeFileSync(path.join(dir, 'workbench', 'INDEX.md'), '# Index\n');
  fs.mkdirSync(path.join(dir, 'src'));
  if (deny) {
    fs.mkdirSync(path.join(dir, '.claude'));
    fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({ permissions: { deny } }));
  }
  return dir;
}

function run(dir, toolName, toolInput, extra = {}) {
  const res = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: dir, permission_mode: 'default', tool_name: toolName, tool_input: toolInput, ...extra }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, HOME: dir, USERPROFILE: dir },
    encoding: 'utf8',
  });
  assert.strictEqual(res.status, 0, 'hook must always exit 0');
  return res.stdout ? JSON.parse(res.stdout).hookSpecificOutput.permissionDecision : null;
}

const wbFile = (dir) => path.join(dir, 'workbench', 'tracking', 'TRK-01-x.md');
const worker = { agent_id: 'a1', agent_type: 'foreman:foreman-worker' };

test('main agent: Edit and Write inside workbench/ are allowed', () => {
  const dir = project();
  assert.strictEqual(run(dir, 'Edit', { file_path: wbFile(dir), old_string: 'a', new_string: 'b' }), 'allow');
  assert.strictEqual(run(dir, 'Write', { file_path: path.join(dir, 'workbench', 'reports', 'REP-01-x.md'), content: 'x' }), 'allow');
  assert.strictEqual(run(dir, 'Write', { file_path: 'workbench/INDEX.md', content: 'x' }), 'allow', 'relative path');
});

test('main agent: files outside workbench/ get no decision', () => {
  const dir = project();
  assert.strictEqual(run(dir, 'Edit', { file_path: path.join(dir, 'src', 'app.js') }), null);
  assert.strictEqual(run(dir, 'Write', { file_path: path.join(dir, 'workbench', '..', 'src', 'x.js') }), null, '.. escape');
  assert.strictEqual(run(dir, 'Write', { file_path: path.join(dir, 'workbench-old', 'x.md') }), null, 'sibling prefix');
});

test('subagents: edits inside workbench/ are denied, others untouched', () => {
  const dir = project();
  assert.strictEqual(run(dir, 'Edit', { file_path: wbFile(dir) }, worker), 'deny');
  assert.strictEqual(run(dir, 'Write', { file_path: path.join(dir, 'workbench', 'reports', 'r.md') }, { agent_id: 'a2', agent_type: 'foreman:foreman-reporter' }), 'deny');
  assert.strictEqual(run(dir, 'Edit', { file_path: path.join(dir, 'src', 'app.js') }, worker), null);
  assert.strictEqual(run(dir, 'Bash', { command: 'mkdir -p workbench/x' }, worker), null, 'no shell decisions for subagents');
});

test('no decision in plan mode, without INDEX.md, or with a deny rule', () => {
  let dir = project();
  assert.strictEqual(run(dir, 'Edit', { file_path: wbFile(dir) }, { permission_mode: 'plan' }), null);
  dir = project({ index: false });
  assert.strictEqual(run(dir, 'Edit', { file_path: wbFile(dir) }), null, 'a workbench/ that is not foreman\'s');
  dir = project({ deny: ['Edit(workbench/**)'] });
  assert.strictEqual(run(dir, 'Edit', { file_path: wbFile(dir) }), null);
  dir = project({ deny: ['Write'] });
  assert.strictEqual(run(dir, 'Write', { file_path: wbFile(dir) }), null);
});

test('first setup: workbench/ does not exist yet', () => {
  const dir = project({ workbench: false });
  assert.strictEqual(run(dir, 'Bash', { command: 'mkdir -p workbench/plans workbench/tracking' }), 'allow');
  assert.strictEqual(run(dir, 'Write', { file_path: path.join(dir, 'workbench', 'INDEX.md') }), 'allow');
});

test('Bash: foreman forms inside workbench/ are allowed', () => {
  const dir = project();
  for (const command of [
    'mkdir -p workbench/plans workbench/contracts',
    'touch workbench/plans/.gitkeep',
    "date '+%Y-%m-%d %H:%M'",
    'mkdir -p workbench/.baseline/P-01/TASK-02 && tar cf - src/app.js "src/my file.js" | tar xf - -C workbench/.baseline/P-01/TASK-02 && touch workbench/.baseline/P-01/TASK-02/.stamp',
    'rm -rf workbench/.baseline/P-01/TASK-02',
    'rm -rf workbench/.baseline',
  ]) assert.strictEqual(run(dir, 'Bash', { command }), 'allow', command);
});

test('Bash: anything else gets no decision', () => {
  const dir = project();
  for (const command of [
    'mkdir -p src/new',
    'mkdir -p workbench/x && rm -rf src',
    'mkdir -p workbench/x; rm -rf src',
    'rm -rf workbench',
    'rm -rf workbench/tracking',
    'rm -rf workbench/.baseline/../tracking',
    'touch workbench/$(whoami)',
    'mkdir -p workbench/.baseline/P-01/TASK-02 && tar cf - ../secret | tar xf - -C workbench/.baseline/P-01/TASK-02 && touch workbench/.baseline/P-01/TASK-02/.stamp',
    'mkdir -p workbench/.baseline/P-01/TASK-02 && tar cf - src/app.js | tar xf - -C src && touch workbench/.baseline/P-01/TASK-02/.stamp',
    'npm test',
    'date -s "2020-01-01"',
  ]) assert.strictEqual(run(dir, 'Bash', { command }), null, command);
});

test('PowerShell: foreman forms inside workbench/ are allowed, others not', () => {
  const dir = project();
  for (const command of [
    "New-Item -ItemType Directory -Force 'workbench/plans' | Out-Null",
    "Get-Date -Format 'yyyy-MM-dd HH:mm'",
    "Remove-Item -Recurse -Force 'workbench/.baseline/P-01/TASK-02'",
    "foreach ($f in @('src/app.js', 'src/routes/notes.js')) { $d = Join-Path 'workbench/.baseline/P-01/TASK-02' $f; New-Item -ItemType Directory -Force (Split-Path $d) | Out-Null; Copy-Item $f $d }; New-Item -ItemType File 'workbench/.baseline/P-01/TASK-02/.stamp' | Out-Null",
  ]) assert.strictEqual(run(dir, 'PowerShell', { command }), 'allow', command);
  for (const command of [
    "New-Item -ItemType Directory -Force 'src/x'",
    "Remove-Item -Recurse -Force 'workbench/tracking'",
    "foreach ($f in @('../secret.txt')) { $d = Join-Path 'workbench/.baseline/P-01/TASK-02' $f; New-Item -ItemType Directory -Force (Split-Path $d) | Out-Null; Copy-Item $f $d }; New-Item -ItemType File 'workbench/.baseline/P-01/TASK-02/.stamp' | Out-Null",
    "Set-Content workbench/INDEX.md 'x'",
  ]) assert.strictEqual(run(dir, 'PowerShell', { command }), null, command);
});

// The worker changes files only with Edit / Write (#31).
test('foreman-worker: shell file writes are denied, normal commands are not', () => {
  const dir = project();
  for (const command of [
    'echo x > src/app.js',
    'npm test >> log.txt',
    'cat <<EOF > src/new.js',
    'npm test 2>&1 | tee out.log',
    "sed -i 's/a/b/' src/app.js",
    'sed --in-place -e s/a/b/ src/app.js',
    "perl -pi -e 's/a/b/' src/app.js",
    'node -e "require(\'fs\').writeFileSync(\'x\', \'y\')"',
    'python -c "open(\'x.txt\', \'w\').write(\'y\')"',
    'npm test > "out file.txt"',
  ]) assert.strictEqual(run(dir, 'Bash', { command }, worker), 'deny', command);
  for (const command of [
    "Set-Content src/app.js 'x'",
    "'x' | Out-File src/app.js",
    "Add-Content -Path src/app.js -Value 'x'",
    "npm test | Tee-Object -FilePath out.log",
    "New-Item -ItemType File src/x.js -Value 'x'",
    "[IO.File]::WriteAllText('src/x.js', 'x')",
    'npm test > out.log',
  ]) assert.strictEqual(run(dir, 'PowerShell', { command }, worker), 'deny', command);
  for (const command of [
    'npm test',
    'npm test 2>&1',
    'npm test 2>/dev/null',
    'npm test > /dev/null 2>&1',
    'npm test 2>&1 | tail -20',
    'node -e "console.log(1 > 0)"',
    'grep -n ">" src/app.js',
    "sed -n '1,5p' src/app.js",
    'perl -ne "print" src/app.js',
    'rm src/old.js',
    'npm test | tee',
  ]) assert.strictEqual(run(dir, 'Bash', { command }, worker), null, command);
  for (const command of ['npm test *> $null', 'npm test | Out-Null', 'Get-Content src/app.js', 'Remove-Item src/old.js']) {
    assert.strictEqual(run(dir, 'PowerShell', { command }, worker), null, command);
  }
});

test('shell writes: only the worker is denied, not the main agent or other subagents', () => {
  const dir = project();
  assert.strictEqual(run(dir, 'Bash', { command: 'echo x > src/app.js' }), null, 'main agent');
  assert.strictEqual(run(dir, 'Bash', { command: 'echo x > src/app.js' }, { agent_id: 'a3', agent_type: 'Explore' }), null, 'other subagent');
  assert.strictEqual(run(dir, 'Bash', { command: 'echo x > src/app.js' }, { agent_id: 'a4', agent_type: 'foreman-worker' }), 'deny', 'without plugin prefix');
});

// After the main agent's first Agent call, allowed-tools no longer cover these (#63).
test('main agent: single read-only version control commands are allowed', () => {
  const dir = project();
  for (const [tool, command] of [
    ['Bash', 'git status --porcelain'],
    ['Bash', 'git diff 261e993d -- src/app.js'],
    ['Bash', 'git diff HEAD --stat -- "src/my file.js"'],
    ['Bash', 'git log -1 --format=%H'],
    ['Bash', 'git ls-files workbench'],
    ['Bash', 'git stash create'],
    ['Bash', 'tf status'],
    ['PowerShell', 'git diff 261e993d --stat'],
    ['PowerShell', 'tf diff /format:unified src/app.js'],
    ['PowerShell', 'tf.exe history /noprompt src'],
  ]) assert.strictEqual(run(dir, tool, { command }), 'allow', command);
});

test('read-only version control: anything else gets no decision', () => {
  const dir = project();
  for (const command of [
    'git status; rm -rf src',
    'git diff && npm test',
    'git diff | tee out.txt',
    'git diff > out.patch',
    'git diff --output=out.patch',
    'git log $(whoami)',
    'git diff `whoami`',
    'git commit -m x',
    'git checkout -- src/app.js',
    'git stash',
    'git stash pop',
    'git -c core.pager=x diff',
    'cd src && git status',
  ]) assert.strictEqual(run(dir, 'Bash', { command }), null, command);
  assert.strictEqual(run(dir, 'PowerShell', { command: 'git diff; Remove-Item src -Recurse' }), null);
  assert.strictEqual(run(dir, 'Bash', { command: 'git status' }, worker), null, 'subagent');
  assert.strictEqual(run(dir, 'Bash', { command: 'git status' }, { permission_mode: 'plan' }), null, 'plan mode');
  assert.strictEqual(run(project({ workbench: false }), 'Bash', { command: 'git status' }), null, 'not a foreman project');
  assert.strictEqual(run(project({ index: false }), 'Bash', { command: 'git status' }), null, 'workbench/ without INDEX.md');
});

test('read-only version control: deny and ask rules in settings are respected', () => {
  let dir = project({ deny: ['Bash(git log:*)'] });
  assert.strictEqual(run(dir, 'Bash', { command: 'git log -1' }), null);
  assert.strictEqual(run(dir, 'Bash', { command: 'git status' }), 'allow', 'other commands still allowed');
  dir = project({ deny: ['Bash'] });
  assert.strictEqual(run(dir, 'Bash', { command: 'git status' }), null);
  assert.strictEqual(run(dir, 'PowerShell', { command: 'git status' }), 'allow', 'other tool');
  dir = project();
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({ permissions: { ask: ['PowerShell(git diff:*)'] } }));
  assert.strictEqual(run(dir, 'PowerShell', { command: 'git diff' }), null);
});

// foreman's state script (#32): allowed for the main agent, also after the worker ran.
test('state script: node "<plugin>/scripts/wb.js" is allowed for the main agent only', () => {
  const dir = project();
  const wb = path.join(repo, 'plugins', 'foreman', 'scripts', 'wb.js');
  const fwd = wb.replace(/\\/g, '/');
  for (const [tool, command] of [
    ['Bash', `node "${fwd}" overview`],
    ['Bash', `node "${fwd}" status P-01 TASK-02 In Progress --by "Main agent" --reason "/foreman:run" --note "worker running"`],
    ['Bash', `node '${wb}' ready P-01`],
    ['PowerShell', `node "${fwd}" next-number`],
    ['Bash', `node "${fwd}" status P-01 TASK-02 Done --by "Main agent" --reason "verified; ran npm test | tail"`],
  ]) assert.strictEqual(run(dir, tool, { command }), 'allow', command);
  if (process.platform === 'win32') {
    const gitBash = fwd.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
    assert.strictEqual(run(dir, 'Bash', { command: `node "${gitBash}" overview` }), 'allow', 'Git Bash path');
    // Installed plugin on Windows: ${CLAUDE_PLUGIN_ROOT} with backslashes (#93).
    for (const tool of ['Bash', 'PowerShell']) {
      assert.strictEqual(run(dir, tool, { command: `node "${wb}" status P-01 TASK-02 Done --by "Main agent" --reason "verified"` }), 'allow', `${tool} backslash path`);
    }
    assert.strictEqual(run(dir, 'PowerShell', { command: `node ${wb} overview` }), 'allow', 'unquoted backslash path');
  }
  for (const command of [
    `node "${fwd}" overview; rm -rf src`,
    `node "${fwd}" overview > out.txt`,
    `node "${fwd}" status P-01 Done --reason "$(whoami)"`,
    `node "${path.join(dir, 'wb.js').replace(/\\/g, '/')}" overview`,
    `node "${path.join(dir, 'wb.js').replace(/\//g, '\\')}" overview`,
    `node "${wb}" overview --reason "a\\b"`,
    `node "${wb}\\..\\..\\hooks\\session-start.js" overview`,
    'node scripts/wb.js overview',
    `node -e "x" "${fwd}"`,
  ]) assert.strictEqual(run(dir, 'Bash', { command }), null, command);
  assert.strictEqual(run(dir, 'Bash', { command: `node "${fwd}" overview` }, worker), null, 'subagent');
  assert.strictEqual(run(project({ deny: ['Edit(workbench/**)'] }), 'Bash', { command: `node "${fwd}" overview` }), null, 'workbench edits denied');
});

test('other tools and broken input get no decision', () => {
  const dir = project();
  assert.strictEqual(run(dir, 'Read', { file_path: wbFile(dir) }), null);
  const res = spawnSync(process.execPath, [hook], { input: 'not json', encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert.strictEqual(res.stdout, '');
});

test('hooks.json runs the guard on file and shell tools', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(repo, 'plugins', 'foreman', 'hooks', 'hooks.json'), 'utf8')).hooks;
  const entry = hooks.PreToolUse[0];
  assert.strictEqual(entry.matcher, 'Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell');
  assert.match(entry.hooks[0].command, /hooks\/workbench-guard\.js"; exit 0$/);
});
