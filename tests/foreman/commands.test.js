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
  const vcs = fs.readFileSync(path.join(plugin, 'reference', 'vcs-git.md'), 'utf8');
  const run = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  assert.match(vcs, /\*\*Start hash\*\* - isolates/);
  assert.match(vcs, /run `git stash create`/);
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
  const vcs = fs.readFileSync(path.join(plugin, 'reference', 'vcs-git.md'), 'utf8');
  assert.match(vcs, /^## Commit$/m);
  const commit = fs.readFileSync(path.join(plugin, 'reference', 'commit-git.md'), 'utf8'); // read only when committing (#105)
  assert.match(commit, /^## Commit$/m);
  assert.match(commit, /`git commit -m "<message>" -- <paths>`/);
  assert.match(fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8'), /follow "Commit": only the task's files/);
  assert.match(fs.readFileSync(path.join(commandsDir, 'close.md'), 'utf8'), /as in "Commit" in the vcs file/);
  const files = [path.join(plugin, 'reference', 'rules.md'), path.join(plugin, 'reference', 'vcs-git.md'), path.join(plugin, 'reference', 'commit-git.md'), path.join(plugin, 'agents', 'foreman-worker.md'),
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

// AskUserQuestion takes 1-4 questions with 2-4 options each (#41): no instruction may
// ask for more, and the shared rule covers long lists and single candidates.
test('AskUserQuestion limits: rule in rules.md, no instruction outside them', () => {
  const read = (...p) => fs.readFileSync(path.join(plugin, ...p), 'utf8');
  const rules = read('reference', 'rules.md');
  assert.match(rules, /at most 4 questions per call/);
  assert.match(rules, /2-4 options per question/);
  assert.match(rules, /only one candidate, add a second real choice/);
  const files = [...fs.readdirSync(commandsDir).map((f) => ['commands', f]), ...fs.readdirSync(path.join(plugin, 'reference')).map((f) => ['reference', f])];
  for (const f of files) {
    const text = read(...f);
    for (const m of text.matchAll(/\b(\d+)-(\d+) (?:focused )?questions\b/g)) assert.ok(Number(m[2]) <= 4, `${f.join('/')}: "${m[0]}"`);
    assert.doesNotMatch(text, /settings together in one `AskUserQuestion` call/, f.join('/'));
  }
  assert.match(read('reference', 'setup.md'), /at most 4 questions per call[^\n]*first call, then Worker model and CLAUDE\.md in the second/);
  const settings = read('commands', 'settings.md');
  assert.match(settings, /Fix rounds: the current value, the default, then `4`, `2`, `6`[^\n]*up to 4 options/);
  assert.match(settings, /When both are the same[^\n]*offer the current value and `—`/);
  assert.match(read('commands', 'interview.md'), /Ask 2-4 focused questions about the topic in one `AskUserQuestion` call/);
});

test('non-Latin feature names get a confirmed English slug; long PDFs are read in full', () => {
  const read = (...p) => fs.readFileSync(path.join(plugin, ...p), 'utf8');
  assert.match(read('reference', 'rules.md'), /non-Latin script[^\n]*English slug[^\n]*confirm it with the user[^\n]*original name stays the feature title/);
  for (const f of ['new.md', 'import.md']) assert.match(read('commands', f), /PDF over 10 pages[^\n]*`pages` in ranges of at most 20[^\n]*until the last page/, f);
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
    ['commands/interview.md', 'read `${CLAUDE_PLUGIN_ROOT}/commands/new.md`, the templates', '## 3. Interview rounds'],
    ['reference/setup.md', 'Before asking anything, read `${CLAUDE_PLUGIN_ROOT}/templates/INDEX.md`', 'Ask the settings in as few `AskUserQuestion` calls'],
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

const LIGHT = ['catalog.md', 'status.md', 'map.md']; // read no rules file (#103)

test('every command except catalog, status, and map starts by reading rules.md', () => {
  for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md') && !LIGHT.includes(f))) {
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
  const all = fs.readFileSync(path.join(plugin, 'reference', 'run-all.md'), 'utf8'); // read only with `all` (#103)
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
  const tasks = fs.readFileSync(path.join(plugin, 'reference', 'tasks.md'), 'utf8');
  const sec = tasks.slice(tasks.indexOf('## Test runs'), tasks.indexOf('## Sessions'));
  assert.match(sec, /header row `Tests`/);
  assert.match(sec, /\*\*Full tests\*\* \(contract Working Rule, missing = `close`\)/);
  assert.match(sec, /`\/foreman:close` always runs the contract's Tests in full/);
  assert.match(sec, /\*\*Baseline reuse\*\*: .*"Baseline reuse" in the vcs file \(git only; tfvc and none always run the baseline\)/);
  const git = fs.readFileSync(path.join(plugin, 'reference', 'vcs-git.md'), 'utf8');
  assert.match(git, /`git diff --stat <hash> -- \. ":!workbench"`/);
  assert.match(git, /no untracked file/);
  for (const v of ['tfvc', 'none']) {
    assert.match(fs.readFileSync(path.join(plugin, 'reference', `vcs-${v}.md`), 'utf8'), /## Baseline reuse\s+Never: always run the baseline tests\./, v);
  }
  const run = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  assert.equal((run.match(/"Test runs" in tasks\.md/g) || []).length >= 2, true, 'run.md points to Test runs for baseline and verify');
  assert.match(fs.readFileSync(path.join(plugin, 'reference', 'fix-rounds.md'), 'utf8'), /"Test runs" in tasks\.md/, 'fix rounds (read on demand, #105)');
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

// #26: per-VCS rules live in reference/vcs-<value>.md, so a git project's run loads no
// TFVC or no-VCS text.
test('version control split: vcs files share sections, rules.md and run.md hold no per-VCS detail', () => {
  const ref = path.join(plugin, 'reference');
  const read = (file) => fs.readFileSync(path.join(ref, file), 'utf8');
  const heads = (v) => read(`vcs-${v}.md`).match(/^## .+$/gm).filter((h) => h !== '## `tf` availability' && h !== '## Read-only files');
  assert.deepStrictEqual(heads('tfvc'), heads('git'));
  assert.deepStrictEqual(heads('none'), heads('git'));
  const rules = read('rules.md');
  const vc = read('version-control.md');
  const run = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  // Detection in version-control.md still names the TFVC markers ($tf, .tfignore).
  const tfvcOnly = /\\workbench|tf checkout|tf delete|tf add|\/stopafter|Visual Studio/;
  for (const [name, text] of [['rules.md', rules], ['version-control.md', vc], ['run.md', run], ['vcs-git.md', read('vcs-git.md')]]) {
    assert.doesNotMatch(text, tfvcOnly, name);
  }
  for (const [name, text] of [['rules.md', rules], ['version-control.md', vc]]) assert.doesNotMatch(text, /git commit -m|untracked-files=all/, name);
  assert.match(vc, /`\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/vcs-<value>\.md`/);
  assert.match(run, /then read `\$\{CLAUDE_PLUGIN_ROOT\}\/reference\/vcs-<value>\.md`/);
  for (const file of ['close.md', 'round.md', 'settings.md', 'new.md', 'import.md', 'interview.md', 'change.md', 'doctor.md']) {
    assert.match(fs.readFileSync(path.join(commandsDir, file), 'utf8'), /the vcs file/, file);
  }
  assert.match(read('setup.md'), /read the vcs file for the chosen value/);
});

// #26: test output in context and Activity is limited to failures; run reports suggest /clear.
test('run context: test output limited to failures, /clear suggested after every run', () => {
  const tasks = fs.readFileSync(path.join(plugin, 'reference', 'tasks.md'), 'utf8');
  assert.match(tasks, /\*\*Output\*\*: keep only what verification needs/);
  assert.match(tasks, /A failing run: the failing test names and their exact errors, nothing else/);
  const run = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  assert.match(run.slice(run.indexOf('## 8. Report')), /End with one line: `\/clear` before the next `\/foreman:run`/);
  assert.match(fs.readFileSync(path.join(plugin, 'reference', 'run-all.md'), 'utf8'), /End with the `\/clear` line of section 8/);
});

// #27: the worker's model comes from the task row, else INDEX, else sonnet, and is
// passed as the Agent tool's model (it overrides the agent's frontmatter; checked live).
test('worker model: setting, task override, passed to the Agent tool', () => {
  assert.strictEqual(manifest.userConfig.default_worker_model.default, 'sonnet');
  assert.ok(!('options' in manifest.userConfig.default_worker_model), 'no options on userConfig');
  const run = fs.readFileSync(path.join(commandsDir, 'run.md'), 'utf8');
  const delegate = run.slice(run.indexOf('## 4. Delegate'), run.indexOf('## 5. Verify'));
  assert.match(delegate, /the task header row `Worker model` when it is `sonnet`, `opus`, or `haiku`; else INDEX `- Worker model:`; missing or invalid = `sonnet`/);
  assert.match(delegate, /Pass it as the Agent tool's `model`/);
  assert.match(delegate, /Launch `foreman:foreman-worker` with that `model`/);
  assert.match(fs.readFileSync(path.join(plugin, 'agents', 'foreman-worker.md'), 'utf8'), /^model: sonnet$/m, 'frontmatter fallback stays');
  assert.match(fs.readFileSync(path.join(plugin, 'templates', 'INDEX.md'), 'utf8'), /^- Worker model: \{\{sonnet \| opus \| haiku\}\}$/m);
  assert.match(fs.readFileSync(path.join(plugin, 'templates', 'task.md'), 'utf8'), /^\| Worker model \| — \|$/m);
  const settings = fs.readFileSync(path.join(commandsDir, 'settings.md'), 'utf8');
  assert.match(settings, /^\| Behavior \| Worker model \(`worker-model`\) \| `sonnet`, `opus`, `haiku` \| `sonnet` \|/m);
  assert.match(settings, /\[worker-model sonnet\|opus\|haiku\]/);
  assert.match(fs.readFileSync(path.join(plugin, 'reference', 'setup.md'), 'utf8'), /^\| Worker model \(`sonnet` \/ `opus` \/ `haiku`\) \| Use the default \|/m);
});

// #102: command descriptions are in the context of every session: one short sentence each.
test('command descriptions are short', () => {
  let total = 0;
  for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'))) {
    const d = /^description: (.+)$/m.exec(fs.readFileSync(path.join(commandsDir, file), 'utf8'))[1].trim();
    assert.ok(d.length <= 70, `${file}: description has ${d.length} characters (max 70)`);
    // An unquoted ": " or " #" breaks the YAML frontmatter, and Claude Code then drops every field.
    assert.ok(/^["']/.test(d) || !/: | #/.test(d), `${file}: quote the description or avoid ": " and " #"`);
    total += d.length;
  }
  assert.ok(total <= 1100, `command descriptions total ${total} characters (max 1100)`);
});
