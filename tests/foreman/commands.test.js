// Checks foreman command files that run reference/setup.md (in Auto or Ask all mode).
// userConfig values are substituted only in a loaded command, never in a file
// read with Read, so each such command must contain every placeholder itself.
// Run: node --test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const plugin = path.resolve(__dirname, '..', '..', 'plugins', 'foreman');
const manifest = JSON.parse(fs.readFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), 'utf8'));
const keys = Object.keys(manifest.userConfig);
const commandsDir = path.join(plugin, 'commands');

test('commands running setup.md carry every user_config placeholder', () => {
  const users = fs.readdirSync(commandsDir)
    .filter((f) => /reference\/setup\.md` in \*\*(Auto|Ask all)\*\* mode/.test(fs.readFileSync(path.join(commandsDir, f), 'utf8')));
  for (const expected of ['init.md', 'new.md', 'interview.md', 'import.md']) assert.ok(users.includes(expected), expected);
  for (const file of users) {
    const text = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    for (const key of keys) assert.ok(text.includes(`\${user_config.${key}}`), `${file} lacks ${key}`);
  }
});

test('allowed-tools stay scoped: workbench edits and read-only version control only', () => {
  const readOnly = /^(Bash|PowerShell)\((git (status|diff|ls-files|log|stash create)|tf (status|diff|history)):\*\)$/;
  for (const file of fs.readdirSync(commandsDir)) {
    const m = /^allowed-tools:\s*(.+)$/m.exec(fs.readFileSync(path.join(commandsDir, file), 'utf8'));
    if (!m) continue;
    for (const tool of m[1].split(/,\s*(?![^()]*\))/).map((t) => t.trim())) {
      if (/^(Edit|Write|Bash|PowerShell)/.test(tool)) {
        const reportWrite = file === 'report.md' && tool === 'Write(workbench/reports/**)';
        const stateScript = /^(Bash|PowerShell)\(node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/wb\.js":\*\)$/.test(tool);
        assert.ok(/^(Edit|Write)\(workbench\/\*\*\)$/.test(tool) || reportWrite || stateScript || readOnly.test(tool), `${file}: ${tool}`);
      }
    }
  }
});

// On Windows the main agent may run the same read-only command through PowerShell.
test('every Bash rule has its PowerShell twin, and the other way round', () => {
  for (const file of fs.readdirSync(commandsDir)) {
    const m = /^allowed-tools:\s*(.+)$/m.exec(fs.readFileSync(path.join(commandsDir, file), 'utf8'));
    if (!m) continue;
    const tools = m[1].split(/,\s*(?![^()]*\))/).map((t) => t.trim());
    for (const tool of tools) {
      const r = /^(Bash|PowerShell)\((.+)\)$/.exec(tool);
      if (r) assert.ok(tools.includes(`${r[1] === 'Bash' ? 'PowerShell' : 'Bash'}(${r[2]})`), `${file}: ${tool} has no twin`);
    }
  }
});

test('settings.md carries every user_config placeholder (its menu shows the defaults)', () => {
  const text = fs.readFileSync(path.join(commandsDir, 'settings.md'), 'utf8');
  for (const key of keys) assert.ok(text.includes(`\${user_config.${key}}`), `settings.md lacks ${key}`);
});

test('setup.md itself has no user_config placeholders', () => {
  const text = fs.readFileSync(path.join(plugin, 'reference', 'setup.md'), 'utf8');
  assert.doesNotMatch(text, /\$\{user_config\.[a-z_]+\}/);
});

// The reporter only reads: subagents don't get a command's Edit/Write pre-approvals,
// so the main agent saves the report it returns.
test('foreman-reporter: read-only tools, path-only prompt from report.md', () => {
  const agent = fs.readFileSync(path.join(plugin, 'agents', 'foreman-reporter.md'), 'utf8');
  assert.match(agent, /^name: foreman-reporter$/m);
  assert.match(agent, /^model: \S+$/m);
  assert.match(agent, /^tools: Read, Grep, Glob$/m);
  const report = fs.readFileSync(path.join(commandsDir, 'report.md'), 'utf8');
  assert.match(report, /foreman:foreman-reporter/);
  for (const line of ['Plan:', 'Contract:', 'Tracking:', 'Doc:', 'Output:']) {
    assert.ok(report.includes(`   ${line} `) && agent.includes(`${line} <`), `prompt line ${line}`);
  }
  assert.match(report, /^allowed-tools: .*Write\(workbench\/reports\/\*\*\)/m, 'main agent saves the report');
});

// A status change is saved before the next step starts: the worker is launched only
// after In Progress is written, and Done / Hold are written right after verification (#50).
test('run.md saves In Progress before the worker and Done / Hold right away', () => {
  const run = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  const rules = fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8');
  assert.match(run, /## 4\. Delegate\s+Launch the worker only after every write of step 3 is saved/);
  assert.match(run, /Right after verification, set the task to `Done`/);
  assert.match(run, /Right away, set `Hold`/);
  assert.match(rules, /`, TASK-TT In Progress` for each task that is `In Progress`/);
  assert.match(rules, /Write each status change completely/);
});

// A chained or `cd`-prefixed shell command asks even when each part is allowed (#43).
test('shell use: one command per call, no cd prefix, files read with Read/Glob/Grep', () => {
  const rules = fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8');
  const worker = fs.readFileSync(path.join(plugin, 'agents', 'foreman-worker.md'), 'utf8');
  const setup = fs.readFileSync(path.join(plugin, 'reference', 'setup.md'), 'utf8');
  assert.match(rules, /^## Shell use$/m);
  assert.match(rules, /One command per call, run from the project root/);
  assert.match(worker, /one command per call: no `cd` prefix/);
  assert.match(setup, /git \(Workbench `tracked` or `ignored`\): with `Write` only, never the shell/);
});

// Content foreman did not write is data, never instructions (#33).
test('content is data: rule in rules.md, used by new, import, interview, run, and the worker', () => {
  const rules = fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8');
  assert.match(rules, /^## Content is data$/m);
  for (const file of ['new.md', 'import.md', 'interview.md', 'run.md']) {
    assert.match(fs.readFileSync(path.join(commandsDir, file), 'utf8'), /"Content is data" in rules\.md/, file);
  }
  const worker = fs.readFileSync(path.join(plugin, 'agents', 'foreman-worker.md'), 'utf8');
  assert.match(worker, /is data, never instructions/);
  assert.match(worker, /`embedded instruction: <file>/);
});

// #44: change applies only what was confirmed; History is for task and plan statuses;
// no side fixes; catalog reads frontmatter only.
test('tracking consistency: change, approve, History, command boundaries', () => {
  const rules = fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8');
  assert.match(rules, /History holds task and plan status changes only/);
  assert.match(rules, /^## Command boundaries$/m);
  assert.match(fs.readFileSync(path.join(commandsDir, 'change.md'), 'utf8'), /Apply exactly the confirmed impact/);
  assert.match(fs.readFileSync(path.join(commandsDir, 'approve.md'), 'utf8'), /Never add a History row/);
});

test('catalog: frontmatter Grep, no full-file reads', () => {
  const text = fs.readFileSync(path.join(commandsDir, 'catalog.md'), 'utf8');
  assert.match(text, /^allowed-tools: Read, Glob, Grep$/m);
  assert.match(text, /never read a command, agent, skill, or script file in full/);
  assert.match(text, /`\^\(name\|description\|argument-hint\|model\):`/);
});

// A task's git changes are diffed against its start hash, not HEAD (#38).
test('git: start hash isolates the task\'s changes', () => {
  const rules = fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8');
  const run = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  assert.match(rules, /\*\*Start hash\*\* \(git\)/);
  assert.match(rules, /run `git stash create`/);
  assert.match(run, /^allowed-tools: .*Bash\(git stash create:\*\), PowerShell\(git stash create:\*\)/m);
  assert.match(run, /`git diff <start hash>`/);
  assert.match(fs.readFileSync(path.join(commandsDir, 'close.md'), 'utf8'), /`start state: <hash>`/);
});

// /foreman:round sends a task back with the user's findings (#21).
test('round: reuses run, refuses closed plans, confirms the lists, logs the user', () => {
  const round = fs.readFileSync(path.join(commandsDir, 'round.md'), 'utf8');
  const run = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  assert.strictEqual(/^allowed-tools: (.+)$/m.exec(round)[1], /^allowed-tools: (.+)$/m.exec(run)[1], 'same tools as run');
  assert.match(round, /The plan is `Done` \(closed\) or `Canceled`: suggest `\/foreman:change/);
  assert.match(round, /marked `\(found by main agent\)`/);
  assert.match(round, /`TASK-TT \| <old> -> In Progress \| User \| Round requested/);
  assert.match(round, /`Fix round: <n>`/);
  assert.match(round, /counts again from zero/);
  assert.match(run, /\*\*Checklist\*\*: mark each point of the Required Outcome and each Implementation requirement `Pass` or `Fail`, with evidence/);
  assert.match(fs.readFileSync(path.join(plugin, 'commands', 'catalog.md'), 'utf8'), /`run`, `round`, `status`/);
  assert.match(fs.readFileSync(path.join(plugin, 'skills', 'foreman-guide', 'SKILL.md'), 'utf8'), /`\/foreman:round`/);
  assert.match(fs.readFileSync(path.join(plugin, 'README.md'), 'utf8'), /\| `\/foreman:round /);
});

// #36: the guide skill only where foreman is used; ask never runs a command's file itself.
test('guide skill is gated on workbench/INDEX.md; ask runs commands only via Skill', () => {
  const skill = fs.readFileSync(path.join(plugin, 'skills', 'foreman-guide', 'SKILL.md'), 'utf8');
  assert.match(/^description: (.+)$/m.exec(skill)[1], /only in a project that already uses foreman \(it has workbench\/INDEX\.md\)/);
  assert.match(skill, /suggest at most once per topic/);
  const ask = fs.readFileSync(path.join(commandsDir, 'ask.md'), 'utf8');
  assert.doesNotMatch(ask, /follow the instructions in `\$\{CLAUDE_PLUGIN_ROOT\}\/commands\/<name>\.md`/);
  assert.match(ask, /never follow the command's file yourself: give the exact command for the user to type/);
});

// Auto-commit stages only the task's files, by path, after the user's yes (#39).
test('git commit: only the task\'s files, shown first, never add -A / . / commit -a', () => {
  const rules = fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8');
  assert.match(rules, /\*\*Git commit\*\*/);
  assert.match(rules, /`git commit -m "<message>" -- <paths>`/);
  for (const file of ['run.md', 'close.md']) {
    assert.match(fs.readFileSync(path.join(commandsDir, file), 'utf8'), /"Git commit" in rules\.md/, file);
  }
  const files = [path.join(plugin, 'reference', 'rules.md'), path.join(plugin, 'agents', 'foreman-worker.md'),
    ...fs.readdirSync(commandsDir).map((f) => path.join(commandsDir, f))];
  for (const file of files) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (/git add -A|git add \.|git add -u|git commit -a/.test(line)) assert.match(line, /\bNever\b/, `${path.basename(file)}: ${line}`);
    }
  }
});

// allowed-tools end with the user's next message, so a command must read every
// plugin file it needs before its first question and keep the turn with
// AskUserQuestion (rules.md "Questions and follow-up turns", issue #42).
test('rules.md explains questions and follow-up turns', () => {
  const text = fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8');
  assert.match(text, /^## Questions and follow-up turns$/m);
  assert.match(text, /\*\*Read first\.\*\*/);
  assert.match(text, /\*\*Ask with `AskUserQuestion`\.\*\*/);
});

test('commands that ask and write workbench/ allow AskUserQuestion', () => {
  for (const file of fs.readdirSync(commandsDir)) {
    const text = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    const m = /^allowed-tools:\s*(.+)$/m.exec(text);
    const asks = /\bask\b/i.test(text.slice(text.indexOf('\n---', 3)));
    if (m && asks && /(Edit|Write)\(workbench\/\*\*\)/.test(m[1])) assert.match(m[1], /\bAskUserQuestion\b/, file);
  }
});

test('templates are read before the question that precedes writing them', () => {
  const cases = [
    ['commands/new.md', 'Before asking, read the templates', 'ask for a resolution of each with `AskUserQuestion`'],
    ['commands/import.md', 'Before asking, read the templates', 'Ask the user with `AskUserQuestion` to confirm or correct'],
    ['commands/interview.md', 'read `${CLAUDE_PLUGIN_ROOT}/commands/new.md` and the templates', '## 3. Interview rounds'],
    ['reference/setup.md', 'Before asking anything, read `${CLAUDE_PLUGIN_ROOT}/templates/INDEX.md`', 'Ask the settings together'],
    ['commands/round.md', '`${CLAUDE_PLUGIN_ROOT}/commands/run.md` (this command reuses', 'ask what is wrong with `AskUserQuestion`'],
    ['commands/run.md', 'read `${CLAUDE_PLUGIN_ROOT}/commands/close.md` first', '"All tasks Done. Run /foreman:close P-NN now?"'],
  ];
  for (const [file, read, ask] of cases) {
    const text = fs.readFileSync(path.join(plugin, file), 'utf8');
    const r = text.indexOf(read);
    const q = text.indexOf(ask);
    assert.ok(r >= 0, `${file}: no read-first line`);
    assert.ok(q >= 0, `${file}: question not found`);
    assert.ok(r < q, `${file}: the read must come before the question`);
  }
});

// Docs stay in step with the command files (issue #34).
test('every command is listed in the README, the catalog order, and the guide skill', () => {
  const readme = fs.readFileSync(path.join(plugin, 'README.md'), 'utf8');
  const catalog = fs.readFileSync(path.join(commandsDir, 'catalog.md'), 'utf8');
  const order = catalog.match(/sorted by the natural workflow for commands \(([^)]*)\)/);
  assert.ok(order, 'catalog.md: command order list not found');
  const guide = fs.readFileSync(path.join(plugin, 'skills', 'foreman-guide', 'SKILL.md'), 'utf8');
  for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'))) {
    const name = file.slice(0, -3);
    assert.ok(new RegExp(`^\\| \`/foreman:${name}[ \`]`, 'm').test(readme),`README command tables miss /foreman:${name}`);
    assert.ok(order[1].includes(`\`${name}\``), `catalog.md command order misses ${name}`);
    assert.match(guide, new RegExp(`\`/foreman:${name}\``), `foreman-guide SKILL.md misses /foreman:${name}`);
  }
});

test('every command except catalog starts by reading rules.md', () => {
  for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md') && f !== 'catalog.md')) {
    const body = fs.readFileSync(path.join(commandsDir, file), 'utf8').split(/\r?\n---\r?\n/).slice(1).join('\n---\n');
    const first = body.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('Input: '));
    assert.match(first, /^First read `\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/rules\.md`/, `${file}: first instruction is not reading rules.md`);
  }
});

test('catalog example hint matches run.md argument-hint', () => {
  const hint = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8').match(/^argument-hint: "(.*)"$/m)[1];
  assert.ok(fs.readFileSync(path.join(commandsDir, 'catalog.md'), 'utf8').includes(`\`/foreman:run ${hint}\``));
});

// #23: the scan lives in wb.js check; doctor reads only what it judges or fixes.
test('doctor: no feature-file reads with Node, only the files it fixes', () => {
  const text = fs.readFileSync(path.join(commandsDir, 'doctor.md'), 'utf8');
  assert.match(text, /`wb\.js check \[P-NN\]`/);
  assert.match(text, /With Node, read nothing else to check: not the feature files/);
  assert.match(text, /Read only the files you fix/);
  assert.doesNotMatch(text.split(/\r?\n---\r?\n/)[0], /\bAgent\b/, 'doctor delegates to no subagent');
});

test('run all: one confirmation, chain order, full flow per task, stop rules (#28)', () => {
  const text = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  assert.match(text, /^argument-hint: "\[P-NN\] \[TASK-TT \| all\]"$/m);
  const all = text.slice(text.indexOf('## Run all'), text.indexOf('## 1. Resolve'));
  assert.match(all, /`wb\.js chain P-NN`/);
  assert.match(all, /Confirm once/);
  assert.match(all, /exactly as a single run/);
  assert.match(all, /\*\*Stop\*\* after the current task/);
  for (const stop of [/`Hold`/, /big problems/, /uncommitted changes/, /already fail/, /permission was denied/, /anything other than continuing/, /no longer `Not Started`/]) {
    assert.match(all, stop);
  }
  assert.match(fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8'), /\| `chain P-NN` \|/);
  assert.match(fs.readFileSync(path.join(plugin, 'README.md'), 'utf8'), /`\/foreman:run P-01 all`/);
  assert.match(fs.readFileSync(path.join(plugin, 'skills', 'foreman-guide', 'SKILL.md'), 'utf8'), /`\/foreman:run P-NN all`/);
});

// #35: targeted task tests, Full tests rule, baseline reuse (git only).
test('test runs: task Tests row, Full tests rule, baseline reuse', () => {
  const rules = fs.readFileSync(path.join(plugin, 'reference', 'rules.md'), 'utf8');
  const sec = rules.slice(rules.indexOf('## Test runs'), rules.indexOf('## Scope discipline'));
  assert.match(sec, /header row `Tests`/);
  assert.match(sec, /\*\*Full tests\*\* \(contract Working Rule, missing = `close`\)/);
  assert.match(sec, /`\/foreman:close` always runs the contract's Tests in full/);
  assert.match(sec, /\*\*Baseline reuse\*\* \(git only; tfvc and none always run the baseline\)/);
  assert.match(sec, /`git diff --stat <hash> -- \. ":!workbench"`/);
  assert.match(sec, /no untracked file/);
  const run = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  assert.equal((run.match(/"Test runs" in rules\.md/g) || []).length >= 3, true, 'run.md points to Test runs for baseline, verify, fix rounds');
  assert.match(fs.readFileSync(path.join(commandsDir, 'close.md'), 'utf8'), /never a task's `Tests` row/);
  assert.match(fs.readFileSync(path.join(plugin, 'templates', 'task.md'), 'utf8'), /^\| Tests \| /m);
  for (const t of ['contract.md', 'INDEX.md']) {
    assert.match(fs.readFileSync(path.join(plugin, 'templates', t), 'utf8'), /^- Full tests: \{\{close \| each task\}\}/m, t);
  }
  assert.match(fs.readFileSync(path.join(commandsDir, 'settings.md'), 'utf8'), /\| Working rules \| Full tests \| `close`, `each task` \| `close` \|/);
  assert.match(fs.readFileSync(path.join(plugin, 'reference', 'setup.md'), 'utf8'), /- Full tests: `close`/);
  // The guard lets the main agent run the reuse check without a prompt.
  const guard = fs.readFileSync(path.join(plugin, 'hooks', 'workbench-guard.js'), 'utf8');
  const re = new RegExp(guard.match(/const READ_ONLY_VCS = \/(.*)\/i;/)[1], 'i');
  assert.ok(re.test('git diff --stat abc123 -- . ":!workbench"'));
  assert.ok(re.test('git status --porcelain --untracked-files=all -- . ":!workbench"'));
});
