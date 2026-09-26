#!/usr/bin/env node
// Checks a release tag against the marketplace and prints its release notes.
// Usage: node .github/scripts/release-notes.js v1.0.0 > release-notes.md
// Fails (exit 1) if the tag does not match marketplace.json metadata.version,
// or if the root CHANGELOG.md has no section for that version.
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

// Returns the body of the "## [version]" section, or null if missing or empty.
function changelogSection(text, version) {
  const lines = text.split(/\r?\n/);
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = lines.findIndex((l) => new RegExp(`^## \\[${escaped}\\]`).test(l));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end === -1) end = lines.length;
  const body = lines.slice(start + 1, end).join('\n').trim();
  return body || null;
}

// Returns { notes } or { error }.
function releaseNotes(tag, dir = root) {
  const match = /^v(\d+\.\d+\.\d+)$/.exec(tag || '');
  if (!match) return { error: `Tag "${tag}" is not in the form vX.Y.Z.` };
  const version = match[1];

  const marketplace = JSON.parse(
    fs.readFileSync(path.join(dir, '.claude-plugin', 'marketplace.json'), 'utf8'),
  );
  const current = marketplace.metadata && marketplace.metadata.version;
  if (current !== version) {
    return { error: `Tag ${tag} does not match marketplace.json metadata.version (${current}).` };
  }

  const section = changelogSection(fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8'), version);
  if (!section) return { error: `CHANGELOG.md has no "## [${version}]" section with content.` };

  const plugins = (marketplace.plugins || [])
    .map((p) => `| ${p.name} | ${p.version} |`)
    .join('\n');
  const notes = `${section}\n\n## Plugins in this release\n\n| Plugin | Version |\n|--------|---------|\n${plugins}\n`;
  return { notes };
}

if (require.main === module) {
  const result = releaseNotes(process.argv[2]);
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  process.stdout.write(result.notes);
}

module.exports = { changelogSection, releaseNotes };
