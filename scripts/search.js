#!/usr/bin/env node
const store = require('./store');

function tokenize(query) {
  return query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
}

function scoreEntry(entry, tokens) {
  let score = 0;
  const title = (entry.meta.title || '').toLowerCase();
  const tags = Array.isArray(entry.meta.tags) ? entry.meta.tags.map(t => t.toLowerCase()) : [];
  const body = entry.body.toLowerCase();

  for (const token of tokens) {
    // Title match (3x weight)
    if (title.includes(token)) score += 3;

    // Tag match (2x weight)
    if (tags.some(t => t.includes(token) || token.includes(t))) score += 2;

    // Body match (1x weight)
    const bodyMatches = (body.match(new RegExp(escapeRegex(token), 'g')) || []).length;
    score += Math.min(bodyMatches, 3); // Cap at 3 body matches

    // Fuzzy: check if any word in title is within edit distance 2
    for (const word of title.split(/\s+/)) {
      if (word.length > 2 && token.length > 2 && fuzzyMatch(word, token)) {
        score += 1;
      }
    }
  }

  // Recency bonus (entries from last 7 days get +1)
  if (entry.meta.date) {
    const parsedDate = new Date(entry.meta.date);
    if (!isNaN(parsedDate.getTime())) {
      const age = (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (age < 7) score += 1;
    }
  }

  return score;
}

function fuzzyMatch(a, b) {
  // Simple substring containment check (fast approximation of fuzzy match)
  if (a.includes(b) || b.includes(a)) return true;
  // Check if strings share a common prefix of length >= 3
  let common = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) common++;
    else break;
  }
  return common >= 3;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSnippet(body, tokens, maxLen = 120) {
  const lower = body.toLowerCase();
  let bestPos = 0;

  // Find first occurrence of any token
  for (const token of tokens) {
    const pos = lower.indexOf(token);
    if (pos !== -1) {
      bestPos = Math.max(0, pos - 30);
      break;
    }
  }

  let snippet = body.slice(bestPos, bestPos + maxLen).replace(/\n/g, ' ').trim();
  if (bestPos > 0) snippet = '...' + snippet;
  if (bestPos + maxLen < body.length) snippet += '...';
  return snippet;
}

function search(query, projectRoot) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return recent(5, projectRoot);

  const entries = store.listEntries(projectRoot);
  const scored = entries.map(e => ({
    ...e,
    score: scoreEntry(e, tokens),
    snippet: getSnippet(e.body, tokens)
  })).filter(e => e.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

function recent(n, projectRoot) {
  const entries = store.listEntries(projectRoot);
  return entries.slice(0, n).map(e => ({
    ...e,
    score: 0,
    snippet: e.body.slice(0, 120).replace(/\n/g, ' ').trim() + (e.body.length > 120 ? '...' : '')
  }));
}

module.exports = { search, recent, tokenize };

if (require.main === module) {
  const [,, cmd, root, ...queryParts] = process.argv;
  const projectRoot = root || store.findProjectRoot();

  switch (cmd) {
    case 'search': {
      const query = queryParts.join(' ');
      const results = search(query, projectRoot);
      if (results.length === 0) {
        console.log('No matching entries found.');
      } else {
        for (const r of results) {
          const type = r.type.padEnd(12);
          console.log(`[${type}] ${r.meta.title || r.filename} (score: ${r.score})`);
          console.log(`           ${r.snippet}`);
          console.log('');
        }
      }
      break;
    }
    case 'recent': {
      const n = parseInt(queryParts[0]) || 5;
      const results = recent(n, projectRoot);
      for (const r of results) {
        console.log(`[${r.type}] ${r.meta.title || r.filename} — ${r.meta.date || ''}`);
      }
      break;
    }
    default:
      console.log('Commands: search <root> <query>, recent <root> [n]');
  }
}
