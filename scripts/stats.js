#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const store = require('./store');

function getStats(projectRoot) {
  if (!projectRoot || typeof projectRoot !== 'string') {
    throw new Error('A valid project root path is required.');
  }
  const entries = store.listEntries(projectRoot);
  const contributors = store.getContributors(projectRoot);
  const brainPath = path.join(store.brainDir(projectRoot), 'BRAIN.md');

  // Count by type
  const counts = {};
  for (const type of store.TYPES) {
    counts[type] = entries.filter(e => e.type === type).length;
  }

  // Brain.md info
  let brainLines = 0;
  let brainExists = false;
  if (fs.existsSync(brainPath)) {
    brainExists = true;
    brainLines = fs.readFileSync(brainPath, 'utf8').split('\n').length;
  }

  // Latest entry
  const latest = entries.length > 0 ? entries[0] : null;

  // Contributor stats
  const contributorStats = {};
  for (const [name, contribs] of Object.entries(contributors)) {
    contributorStats[name] = contribs.length;
  }

  return {
    total: entries.length,
    counts,
    contributors: contributorStats,
    contributorCount: Object.keys(contributors).length,
    brainExists,
    brainLines,
    latestEntry: latest ? { title: latest.meta.title, date: latest.meta.date, type: latest.type } : null
  };
}

function formatStats(stats) {
  const lines = [];
  lines.push('');
  lines.push('╔════════════════════════════════════════════╗');
  lines.push('║         TEAM BRAIN — Status                ║');
  lines.push('╠════════════════════════════════════════════╣');
  lines.push(`║  Total Entries:    ${String(stats.total).padEnd(24)}║`);
  lines.push(`║  Conventions:      ${String(stats.counts.conventions || 0).padEnd(24)}║`);
  lines.push(`║  Decisions:        ${String(stats.counts.decisions || 0).padEnd(24)}║`);
  lines.push(`║  Lessons:          ${String(stats.counts.lessons || 0).padEnd(24)}║`);
  lines.push(`║  Knowledge:        ${String(stats.counts.knowledge || 0).padEnd(24)}║`);
  lines.push('╠════════════════════════════════════════════╣');
  lines.push(`║  Contributors:     ${String(stats.contributorCount).padEnd(24)}║`);

  if (Object.keys(stats.contributors).length > 0) {
    for (const [name, count] of Object.entries(stats.contributors)) {
      const displayName = name.length > 18 ? name.slice(0, 17) + '…' : name.padEnd(18);
      lines.push(`║    ${displayName} ${String(count).padStart(3)} entries     ║`);
    }
  }

  lines.push('╠════════════════════════════════════════════╣');
  lines.push(`║  BRAIN.md:         ${stats.brainExists ? `${stats.brainLines} lines` : 'not generated'}${''.padEnd(Math.max(0, 24 - (stats.brainExists ? `${stats.brainLines} lines`.length : 13)))}║`);

  if (stats.brainLines > 160) {
    lines.push(`║  ⚠ Approaching 180 line limit!             ║`);
  }

  if (stats.latestEntry) {
    lines.push('╠════════════════════════════════════════════╣');
    const title = stats.latestEntry.title || 'untitled';
    lines.push(`║  Latest: ${title.slice(0, 33).padEnd(33)}║`);
    lines.push(`║          ${stats.latestEntry.date || ''} (${stats.latestEntry.type})${''.padEnd(Math.max(0, 22 - (stats.latestEntry.date || '').length - stats.latestEntry.type.length))}║`);
  }

  lines.push('╚════════════════════════════════════════════╝');
  lines.push('');
  return lines.join('\n');
}

module.exports = { getStats, formatStats };

if (require.main === module) {
  const root = process.argv[2] || store.findProjectRoot();
  const stats = getStats(root);
  console.log(formatStats(stats));
}
