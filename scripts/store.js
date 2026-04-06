#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TYPES = ['lessons', 'decisions', 'conventions', 'knowledge'];
const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'data', 'default-config.json');

// --- Helpers ---

function slugify(str) {
  if (!str || typeof str !== 'string') return 'untitled';
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'untitled';
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (!m) continue;
    let val = m[2].trim();
    // Handle arrays: [tag1, tag2]
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    } else {
      val = val.replace(/^['"]|['"]$/g, '');
    }
    meta[m[1]] = val;
  }
  return { meta, body: match[2] };
}

function buildFrontmatter(meta) {
  const lines = ['---'];
  for (const [key, val] of Object.entries(meta)) {
    if (Array.isArray(val)) {
      lines.push(`${key}: [${val.join(', ')}]`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function getAuthor() {
  try {
    return execSync('git config user.name', { encoding: 'utf8', timeout: 2000 }).trim();
  } catch {
    return process.env.USER || 'unknown';
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// --- Project Root ---

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.team-brain'))) return dir;
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function brainDir(projectRoot) {
  return path.join(projectRoot, '.team-brain');
}

// --- Init ---

function init(projectRoot) {
  const dir = brainDir(projectRoot);
  if (fs.existsSync(dir)) {
    return { created: false, path: dir };
  }

  fs.mkdirSync(dir, { recursive: true });
  for (const type of TYPES) {
    fs.mkdirSync(path.join(dir, type), { recursive: true });
  }

  // Copy default config
  const defaultConfig = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(defaultConfig, null, 2));

  // Init contributors
  fs.writeFileSync(path.join(dir, '.contributors'), JSON.stringify({}, null, 2));

  // Init empty BRAIN.md
  fs.writeFileSync(path.join(dir, 'BRAIN.md'), '# Team Brain\n\nNo entries yet. Use `/team-brain learn`, `/team-brain decide`, or `/team-brain convention` to add knowledge.\n');

  return { created: true, path: dir };
}

// --- CRUD ---

function addEntry(projectRoot, type, title, body, author, tags) {
  if (!type || !TYPES.includes(type)) {
    throw new Error(`Invalid entry type "${type}". Must be one of: ${TYPES.join(', ')}`);
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Entry title is required and must be a non-empty string.');
  }

  const dir = brainDir(projectRoot);
  if (!fs.existsSync(dir)) init(projectRoot);

  const typeDir = path.join(dir, type);
  if (!fs.existsSync(typeDir)) fs.mkdirSync(typeDir, { recursive: true });

  const slug = slugify(title);
  const date = today();
  const resolvedAuthor = author || getAuthor();
  const resolvedTags = tags || [];

  let filename;
  if (type === 'decisions') {
    const num = getNextDecisionNumber(projectRoot);
    filename = `${String(num).padStart(3, '0')}-${slug}.md`;
  } else {
    filename = `${date}-${slug}.md`;
  }

  const meta = {
    title,
    type: type.replace(/s$/, ''), // lessons -> lesson
    author: resolvedAuthor,
    date,
    tags: resolvedTags,
    status: type === 'decisions' ? 'accepted' : 'active'
  };

  const content = buildFrontmatter(meta) + '\n\n' + body + '\n';
  const filepath = path.join(typeDir, filename);
  fs.writeFileSync(filepath, content);

  // Update contributors
  addContributor(projectRoot, resolvedAuthor, path.relative(dir, filepath));

  return { filepath, filename, meta };
}

function listEntries(projectRoot, type) {
  const dir = brainDir(projectRoot);
  if (!fs.existsSync(dir)) return [];

  const types = type ? [type] : TYPES;
  const entries = [];

  for (const t of types) {
    const typeDir = path.join(dir, t);
    if (!fs.existsSync(typeDir)) continue;

    for (const file of fs.readdirSync(typeDir)) {
      if (!file.endsWith('.md')) continue;
      const filepath = path.join(typeDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      const { meta, body } = parseFrontmatter(content);
      entries.push({ filepath, filename: file, type: t, meta, body });
    }
  }

  return entries.sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''));
}

function readEntry(filepath) {
  if (!filepath || typeof filepath !== 'string') {
    throw new Error('A valid file path is required to read an entry.');
  }
  if (!fs.existsSync(filepath)) {
    throw new Error(`Entry not found: ${filepath}`);
  }
  const content = fs.readFileSync(filepath, 'utf8');
  return parseFrontmatter(content);
}

function getNextDecisionNumber(projectRoot) {
  const decisionsDir = path.join(brainDir(projectRoot), 'decisions');
  if (!fs.existsSync(decisionsDir)) return 1;

  const files = fs.readdirSync(decisionsDir).filter(f => f.endsWith('.md'));
  let max = 0;
  for (const f of files) {
    const m = f.match(/^(\d+)-/);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  return max + 1;
}

// --- Contributors ---

function getContributors(projectRoot) {
  const filepath = path.join(brainDir(projectRoot), '.contributors');
  if (!fs.existsSync(filepath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return {};
  }
}

function addContributor(projectRoot, name, entryPath) {
  const contributors = getContributors(projectRoot);
  if (!contributors[name]) contributors[name] = [];
  contributors[name].push({ entry: entryPath, date: today() });
  fs.writeFileSync(path.join(brainDir(projectRoot), '.contributors'), JSON.stringify(contributors, null, 2));
}

// --- Config ---

function loadConfig(projectRoot) {
  const configPath = path.join(brainDir(projectRoot), 'config.json');
  if (!fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
  }
}

function saveConfig(projectRoot, config) {
  fs.writeFileSync(path.join(brainDir(projectRoot), 'config.json'), JSON.stringify(config, null, 2));
}

module.exports = {
  slugify, parseFrontmatter, buildFrontmatter, getAuthor, today,
  findProjectRoot, brainDir, init,
  addEntry, listEntries, readEntry, getNextDecisionNumber,
  getContributors, addContributor, loadConfig, saveConfig,
  TYPES
};

if (require.main === module) {
  const [,, cmd, ...args] = process.argv;
  const root = args[0] || findProjectRoot();

  switch (cmd) {
    case 'init':
      const result = init(root);
      console.log(result.created ? `Team Brain initialized at ${result.path}` : `Already exists at ${result.path}`);
      break;
    case 'add-entry': {
      const [, type, title, body, author, tagsStr] = args;
      if (!type || !title) {
        console.error('Usage: add-entry <root> <type> <title> [body] [author] [tags]');
        process.exit(1);
      }
      try {
        const tags = tagsStr ? tagsStr.split(',') : [];
        const entry = addEntry(root, type, title, body || '', author, tags);
        console.log(`Created: ${entry.filename}`);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
      break;
    }
    case 'list':
      const type = args[1] || null;
      const entries = listEntries(root, type);
      for (const e of entries) {
        console.log(`[${e.type}] ${e.meta.title || e.filename} (${e.meta.date || 'no date'}) by ${e.meta.author || 'unknown'}`);
      }
      if (entries.length === 0) console.log('No entries found.');
      break;
    case 'find-root':
      console.log(findProjectRoot());
      break;
    default:
      console.log('Commands: init [root], add-entry <root> <type> <title> [body] [author] [tags], list [root] [type], find-root');
  }
}
