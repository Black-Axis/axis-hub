#!/usr/bin/env node
// Foreman PreToolUse hook: decides on changes to the project's workbench/ folder.
// - Main agent: Edit / Write / MultiEdit / NotebookEdit inside workbench/ are allowed
//   without a prompt, and so are foreman's own fixed shell forms there (setup folders,
//   snapshots in workbench/.baseline/, the date command). A command's allowed-tools
//   do not cover these in follow-up turns or after an Agent call.
// - Subagents: file edits inside workbench/ are denied (only the main agent writes it).
// - foreman-worker: shell commands that write files (redirects, tee, sed -i, Set-Content,
//   script one-liners that write files, ...) are denied; it changes files only with
//   Edit / Write, so every change reaches the user as a diff.
// - Everything else: no decision, the user's permission mode applies.
// Active only when workbench/ has an INDEX.md or does not exist yet (first setup), never
// in plan mode, and never when the user's settings deny Edit / Write for workbench/.
// Never fails the tool call: all errors exit 0 with no decision.

const fs = require('fs');
const path = require('path');
const os = require('os');

const WIN = process.platform === 'win32';
const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

// Real path of `p`, following symlinks of its nearest existing ancestor.
function realish(p) {
  let cur = path.resolve(p);
  const rest = [];
  while (!fs.existsSync(cur)) {
    const parent = path.dirname(cur);
    if (parent === cur) break;
    rest.unshift(path.basename(cur));
    cur = parent;
  }
  let real = cur;
  try {
    real = fs.realpathSync.native(cur);
  } catch {}
  return path.join(real, ...rest);
}

function norm(p) {
  return WIN ? p.toLowerCase() : p;
}

// True when `target` is `dir` itself (if allowSelf) or inside it.
function inside(target, dir, allowSelf = false) {
  const rel = path.relative(norm(dir), norm(target));
  if (rel === '') return allowSelf;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function settingsDenyWorkbench(root) {
  const files = [
    path.join(os.homedir(), '.claude', 'settings.json'),
    path.join(root, '.claude', 'settings.json'),
    path.join(root, '.claude', 'settings.local.json'),
  ];
  for (const file of files) {
    let deny = [];
    try {
      deny = (JSON.parse(fs.readFileSync(file, 'utf8')).permissions || {}).deny || [];
    } catch {
      continue;
    }
    for (const rule of deny) {
      const m = /^(Edit|Write|MultiEdit|NotebookEdit)(?:\((.*)\))?$/.exec(String(rule).trim());
      if (m && (!m[2] || /workbench/i.test(m[2]) || m[2] === '*' || m[2] === '**')) return true;
    }
  }
  return false;
}

// One path argument: quoted or bare, without shell expansion or operators.
const ARG = String.raw`(?:'[^'$\x60]*'|"[^"$\x60\\]*"|[^\s'"$\x60;&|<>(){}*?\\]+)`;

function unquote(token) {
  return /^(['"]).*\1$/.test(token) ? token.slice(1, -1) : token;
}

function args(text) {
  return (text.match(new RegExp(ARG, 'g')) || []).map(unquote);
}

// Relative project paths only: no absolute paths, no `..`, no drive letters.
function plainRelative(p) {
  return p && !path.isAbsolute(p) && !/^[a-zA-Z]:/.test(p) && !p.split(/[\\/]/).includes('..');
}

// Returns true when `command` is one of foreman's fixed shell forms and every path
// it writes is inside workbench/ (snapshot forms: inside workbench/.baseline/).
function foremanShell(tool, command, ctx) {
  const cmd = command.trim();
  const at = (p) => realish(path.resolve(ctx.cwd, p));
  const inWb = (p) => inside(at(p), ctx.wb);
  const inBase = (p) => inside(at(p), ctx.base);
  const inBaseOrSelf = (p) => inside(at(p), ctx.base, true);
  const S = String.raw`\s+`;

  if (tool === 'Bash') {
    if (/^date\s+(['"])\+%Y-%m-%d %H:%M\1$/.test(cmd)) return true;
    let m = new RegExp(String.raw`^mkdir\s+-p((?:${S}${ARG})+)$`).exec(cmd);
    if (m) return args(m[1]).every(inWb);
    m = new RegExp(String.raw`^touch((?:${S}${ARG})+)$`).exec(cmd);
    if (m) return args(m[1]).every(inWb);
    m = new RegExp(String.raw`^rm\s+-rf${S}(${ARG})$`).exec(cmd);
    if (m) return inBaseOrSelf(unquote(m[1]));
    m = new RegExp(String.raw`^mkdir\s+-p${S}(${ARG})\s+&&\s+tar\s+cf\s+-((?:${S}${ARG})+)\s+\|\s+tar\s+xf\s+-\s+-C${S}(${ARG})\s+&&\s+touch${S}(${ARG})$`).exec(cmd);
    if (m) {
      const [dir, files, dir2, stamp] = [unquote(m[1]), args(m[2]), unquote(m[3]), unquote(m[4])];
      return inBase(dir) && norm(path.resolve(ctx.cwd, dir)) === norm(path.resolve(ctx.cwd, dir2))
        && norm(path.resolve(ctx.cwd, stamp)) === norm(path.resolve(ctx.cwd, dir, '.stamp'))
        && files.every(plainRelative);
    }
    return false;
  }

  if (tool === 'PowerShell') {
    if (/^Get-Date\s+-Format\s+(['"])yyyy-MM-dd HH:mm\1$/i.test(cmd)) return true;
    let m = new RegExp(String.raw`^New-Item\s+-ItemType\s+Directory\s+-Force${S}(${ARG})(?:\s*\|\s*Out-Null)?$`, 'i').exec(cmd);
    if (m) return inWb(unquote(m[1]));
    m = new RegExp(String.raw`^Remove-Item\s+-Recurse\s+-Force${S}(${ARG})$`, 'i').exec(cmd);
    if (m) return inBaseOrSelf(unquote(m[1]));
    m = new RegExp(String.raw`^foreach\s*\(\$f\s+in\s+@\(((?:\s*${ARG}\s*,?)+)\)\)\s*\{\s*\$d\s*=\s*Join-Path${S}(${ARG})\s+\$f\s*;\s*New-Item\s+-ItemType\s+Directory\s+-Force\s+\(Split-Path\s+\$d\)\s*\|\s*Out-Null\s*;\s*Copy-Item\s+\$f\s+\$d\s*\}\s*;\s*New-Item\s+-ItemType\s+File${S}(${ARG})\s*\|\s*Out-Null$`, 'i').exec(cmd);
    if (m) {
      const [files, dir, stamp] = [args(m[1]), unquote(m[2]), unquote(m[3])];
      return files.length > 0 && files.every(plainRelative) && inBase(dir)
        && norm(path.resolve(ctx.cwd, stamp)) === norm(path.resolve(ctx.cwd, dir, '.stamp'));
    }
    return false;
  }
  return false;
}

// Shell file writes the worker must not use (agents/foreman-worker.md "How to change files").
// Quoted text is removed first, so `node -e "a > b"` or `grep ">" x` do not count as redirects.
const DEVNULL = /^(\/dev\/(null|stdout|stderr)|nul|\$null)$/i;
function shellWrite(tool, command) {
  const raw = String(command);
  if (/\b(writeFileSync|appendFileSync|createWriteStream|write_text|write_bytes)\b|\[(System\.)?IO\.File\]::(Write|Append)|\bopen\([^)]*,\s*['"][wax]b?\+?['"]/i.test(raw)) return true;
  const bare = raw.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, '""');
  const redirect = /(?:^|[^<>&|=-])(?:\d|&)?>>?\|?\s*(?!&)([^\s;&|)]+)/g;
  for (let m; (m = redirect.exec(bare));) {
    if (!DEVNULL.test(m[1])) return true;
  }
  if (tool === 'PowerShell') {
    return /(^|[\s;|({])(Set-Content|Add-Content|Out-File|Clear-Content|Tee-Object)\b/i.test(bare)
      || /\bNew-Item\b[^;|]*\s-Value\b/i.test(bare);
  }
  return /(^|[\s;|&(])tee(\s+-\w+)*\s+(?!\/dev\/null\b)[^\s;&|-]/.test(bare)
    || /(^|[\s;|&(])sed(\s[^;&|]*)?\s(-[a-zA-Z]*i|--in-place)/.test(bare)
    || /(^|[\s;|&(])perl(\s[^;&|]*)?\s-[a-zA-Z]*i/.test(bare);
}

function decide(input) {
  const tool = input.tool_name;
  if (!FILE_TOOLS.has(tool) && tool !== 'Bash' && tool !== 'PowerShell') return null;
  if (input.permission_mode === 'plan') return null;

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const wbPath = path.join(root, 'workbench');
  if (fs.existsSync(wbPath) && !fs.existsSync(path.join(wbPath, 'INDEX.md'))) return null;
  const wb = realish(wbPath);
  const ctx = { cwd: input.cwd || root, wb, base: path.join(wb, '.baseline') };
  const ti = input.tool_input || {};
  const subagent = Boolean(input.agent_id);

  if (FILE_TOOLS.has(tool)) {
    const files = [ti.file_path, ti.notebook_path, ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e && e.file_path) : [])]
      .filter((f) => typeof f === 'string' && f);
    if (!files.length) return null;
    const hits = files.map((f) => inside(realish(path.resolve(ctx.cwd, f)), wb));
    if (!hits.some(Boolean)) return null;
    if (subagent) {
      return { permissionDecision: 'deny', permissionDecisionReason: 'foreman: only the main agent changes workbench/ files; subagents report back instead.' };
    }
    if (!hits.every(Boolean) || settingsDenyWorkbench(root)) return null;
    return { permissionDecision: 'allow', permissionDecisionReason: 'foreman: workbench/ file' };
  }

  if (typeof ti.command !== 'string') return null;
  if (subagent) {
    if (/(^|:)foreman-worker$/.test(String(input.agent_type || '')) && shellWrite(tool, ti.command)) {
      return { permissionDecision: 'deny', permissionDecisionReason: 'foreman: the worker changes files only with Edit / Write, never through the shell. Make the change with Edit / Write, or report it under Deviations / Blockers.' };
    }
    return null;
  }
  if (foremanShell(tool, ti.command, ctx) && !settingsDenyWorkbench(root)) {
    return { permissionDecision: 'allow', permissionDecisionReason: 'foreman: workbench/ command' };
  }
  return null;
}

try {
  const decision = decide(readStdin());
  if (decision) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...decision } }));
  }
} catch {
  // No decision: the normal permission flow applies.
}
process.exit(0);
