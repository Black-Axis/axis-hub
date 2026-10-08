// foreman components beyond commands, agents, skills, and hooks: each subcommand of
// the state script (scripts/wb.js), as wb:<name>.
const fs = require('fs');
const path = require('path');

module.exports = (root) => {
  const m = fs.readFileSync(path.join(root, 'scripts', 'wb.js'), 'utf8').match(/const COMMANDS = \{([^}]*)\}/);
  return (m ? m[1].match(/'?([\w-]+)'?\s*:/g) : []).map((k) => `wb:${k.replace(/['\s:]/g, '')}`);
};
