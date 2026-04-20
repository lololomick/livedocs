#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline/promises');

const pkg = require('../package.json');
const CURRENT_VERSION = pkg.version;
const MANIFEST_SCHEMA = 1;

const ASSETS = path.join(__dirname, '..', 'assets');
const CWD = process.cwd();
const KSE_DIR = path.join(CWD, '.github', 'kse-autodocs');
const MANIFEST_PATH = path.join(KSE_DIR, '.manifest.json');
const VERSION_PATH = path.join(KSE_DIR, '.version');

const REGION_BEGIN = '<!-- BEGIN kse-autodocs (managed section — do not edit) -->';
const REGION_END = '<!-- END kse-autodocs -->';

// --- CLI args ------------------------------------------------------------

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('-'));
const subcommand = positional[0] || 'install';
const flags = {
  claude: args.includes('--claude'),
  copilot: args.includes('--copilot'),
  both: args.includes('--both'),
  yes: args.includes('--yes') || args.includes('-y'),
  force: args.includes('--force') || args.includes('-f'),
  dryRun: args.includes('--dry-run') || args.includes('-n'),
  help: args.includes('--help') || args.includes('-h'),
  noColor: args.includes('--no-color') || !!process.env.NO_COLOR,
};

// --- colors --------------------------------------------------------------

const useColor = process.stdout.isTTY && !flags.noColor;
const c = (code) => (useColor ? `\x1b[${code}m` : '');
const col = {
  reset: c(0), bold: c(1), dim: c(2),
  red: c(31), green: c(32), yellow: c(33),
  blue: c(34), magenta: c(35), cyan: c(36), gray: c(90),
};

const BANNER = `
${col.cyan}██   ██ ███████ ███████${col.reset}
${col.cyan}██  ██  ██      ██     ${col.reset}
${col.cyan}█████   ███████ █████  ${col.reset}
${col.cyan}██  ██       ██ ██     ${col.reset}
${col.cyan}██   ██ ███████ ███████${col.reset}
${col.bold}kse-autodocs${col.reset} ${col.dim}v${CURRENT_VERSION}  ·  living docs for Claude Code + Copilot${col.reset}
`;

const HELP = `
kse-autodocs v${CURRENT_VERSION} — install Claude Code commands and / or GitHub
Copilot prompts for scaffolding and maintaining developer documentation.

Usage:
  npx kse-autodocs [options]           install into current repo (default)
  npx kse-autodocs uninstall [options] remove kse-autodocs files from repo

Options:
  --claude       Install Claude Code integration only
  --copilot      Install GitHub Copilot integration only
  --both         Install both (default)
  -y, --yes      Non-interactive. Managed files refresh, user-modified files skip.
  -f, --force    Overwrite every file, including user-modified ones.
  -n, --dry-run  Show what would change; do not touch any files.
  --no-color     Disable ANSI colors in output
  -h, --help     Show this help

Install tracking:
  Every file written by the installer is recorded in
  .github/kse-autodocs/.manifest.json with a SHA-256 content hash.
  On re-install the installer uses that hash to decide:
    · managed & unchanged   → updated silently on version bump
    · user-modified         → prompted (or skipped with --yes)
    · missing from shipping → removed as orphan
  On uninstall only files whose hashes still match are removed; any file
  the user has edited is kept. Pass --force to ignore these checks.

Special handling of .github/copilot-instructions.md:
  The file is user-owned but the installer manages a single region
  between markers so installer content and user content can coexist:

    ${REGION_BEGIN}
    (installer-managed section)
    ${REGION_END}

  Anything outside the markers is yours. Uninstall strips the region
  and keeps the rest of the file.
`;

if (flags.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

// --- hashing -------------------------------------------------------------

function hashBuffer(buf) {
  return 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');
}
function hashFile(abs) {
  return hashBuffer(fs.readFileSync(abs));
}
function hashString(s) {
  return hashBuffer(Buffer.from(s, 'utf8'));
}

// --- atomic write --------------------------------------------------------

function writeAtomic(absPath, contents) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const tmp = absPath + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, absPath);
}

function safeRead(p, enc = 'utf8') {
  try { return fs.readFileSync(p, enc); } catch { return null; }
}

// --- manifest ------------------------------------------------------------

function emptyManifest() {
  return {
    schema: MANIFEST_SCHEMA,
    pluginVersion: null,
    installedAt: null,
    updatedAt: null,
    files: {},
  };
}

function loadManifest() {
  const raw = safeRead(MANIFEST_PATH);
  if (!raw) return null;
  try {
    const m = JSON.parse(raw);
    if (!m.files) m.files = {};
    return m;
  } catch {
    console.warn(`${col.yellow}!${col.reset} manifest at ${path.relative(CWD, MANIFEST_PATH)} is corrupt — ignoring`);
    return null;
  }
}

function saveManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();
  if (!manifest.installedAt) manifest.installedAt = manifest.updatedAt;
  manifest.pluginVersion = CURRENT_VERSION;
  manifest.schema = MANIFEST_SCHEMA;
  writeAtomic(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  writeAtomic(VERSION_PATH, CURRENT_VERSION + '\n');
}

// --- asset plan ----------------------------------------------------------

function walkDir(absDir, cb, rel = '') {
  if (!fs.existsSync(absDir)) return;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const next = path.join(absDir, entry.name);
    const nextRel = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) walkDir(next, cb, nextRel);
    else cb(next, nextRel);
  }
}

function buildAssetPlan(targets) {
  const items = [];

  walkDir(path.join(ASSETS, 'shared'), (srcAbs, rel) => {
    items.push({
      src: srcAbs,
      dest: path.join(KSE_DIR, rel),
      relDest: path.relative(CWD, path.join(KSE_DIR, rel)),
      kind: 'managed',
      group: 'shared',
    });
  });

  if (targets.claude) {
    walkDir(path.join(ASSETS, 'claude', 'commands'), (srcAbs, rel) => {
      items.push({
        src: srcAbs,
        dest: path.join(CWD, '.claude', 'commands', rel),
        relDest: path.join('.claude', 'commands', rel),
        kind: 'managed',
        group: 'claude',
      });
    });
    items.push({
      src: path.join(ASSETS, 'claude', 'rules', 'kse-autodocs.md'),
      dest: path.join(CWD, '.claude', 'rules', 'kse-autodocs.md'),
      relDest: path.join('.claude', 'rules', 'kse-autodocs.md'),
      kind: 'managed',
      group: 'claude',
    });
  }

  if (targets.copilot) {
    walkDir(path.join(ASSETS, 'copilot', 'prompts'), (srcAbs, rel) => {
      items.push({
        src: srcAbs,
        dest: path.join(CWD, '.github', 'prompts', rel),
        relDest: path.join('.github', 'prompts', rel),
        kind: 'managed',
        group: 'copilot',
      });
    });
    items.push({
      src: path.join(ASSETS, 'copilot', 'copilot-instructions.md'),
      dest: path.join(CWD, '.github', 'copilot-instructions.md'),
      relDest: path.join('.github', 'copilot-instructions.md'),
      kind: 'region',
      group: 'copilot',
    });
  }

  return items;
}

// --- region helpers ------------------------------------------------------

function buildRegionContent(existing, incoming) {
  const body = incoming.replace(/\s+$/, '');
  const block = REGION_BEGIN + '\n' + body + '\n' + REGION_END;
  const regionHash = hashString(body);

  if (existing === null || existing === '') {
    return { newContent: block + '\n', regionHash };
  }

  const idxBegin = existing.indexOf(REGION_BEGIN);
  const idxEnd = existing.indexOf(REGION_END);

  if (idxBegin === -1 || idxEnd === -1 || idxEnd < idxBegin) {
    // No markers. If the entire disk file is our shipped content (e.g. a v0.4.x
    // install that copied the asset verbatim), replace it with the wrapped
    // version so no duplicate content appears after migration.
    if (existing.replace(/\s+$/, '') === body) {
      return { newContent: block + '\n', regionHash };
    }
    // Otherwise preserve the user's content: prepend our block.
    return { newContent: block + '\n\n' + existing, regionHash };
  }

  const before = existing.slice(0, idxBegin).replace(/\n+$/, '');
  const after = existing.slice(idxEnd + REGION_END.length).replace(/^\n+/, '');
  let out;
  if (!before && !after) out = block + '\n';
  else if (!before) out = block + '\n\n' + after;
  else if (!after) out = before + '\n\n' + block + '\n';
  else out = before + '\n\n' + block + '\n\n' + after;
  return { newContent: out, regionHash };
}

function extractRegionContent(fileContent) {
  const idxBegin = fileContent.indexOf(REGION_BEGIN);
  const idxEnd = fileContent.indexOf(REGION_END);
  if (idxBegin === -1 || idxEnd === -1 || idxEnd < idxBegin) return null;
  const inner = fileContent.slice(idxBegin + REGION_BEGIN.length, idxEnd);
  return inner.replace(/^\n+/, '').replace(/\s+$/, '');
}

function stripRegion(fileContent) {
  const idxBegin = fileContent.indexOf(REGION_BEGIN);
  const idxEnd = fileContent.indexOf(REGION_END);
  if (idxBegin === -1 || idxEnd === -1 || idxEnd < idxBegin) return fileContent;
  const before = fileContent.slice(0, idxBegin).replace(/\n+$/, '');
  const after = fileContent.slice(idxEnd + REGION_END.length).replace(/^\n+/, '');
  if (!before && !after) return '';
  if (!before) return after.endsWith('\n') ? after : after + '\n';
  if (!after) return before + '\n';
  return before + '\n\n' + after + (after.endsWith('\n') ? '' : '\n');
}

// --- migration from old .version-only installs ---------------------------

function migrateFromVersionFile() {
  const old = safeRead(VERSION_PATH);
  if (!old) return null;

  const installedVersion = old.trim();
  const fullAssets = buildAssetPlan({ claude: true, copilot: true });
  const manifest = emptyManifest();
  manifest.pluginVersion = installedVersion;

  for (const a of fullAssets) {
    if (!fs.existsSync(a.dest)) continue;

    if (a.kind === 'managed') {
      const shippedHash = hashFile(a.src);
      const diskHash = hashFile(a.dest);
      manifest.files[a.relDest] = {
        kind: 'managed',
        managedHash: diskHash === shippedHash ? shippedHash : null,
        preExisted: diskHash !== shippedHash,
        firstWrittenAt: null,
        lastWrittenAt: null,
      };
    } else if (a.kind === 'region') {
      // Old installer never wrote markers, so the disk file has none. Treat as
      // preExisted=true with no known region — the install flow will inject
      // a fresh region.
      manifest.files[a.relDest] = {
        kind: 'region',
        regionHash: null,
        preExisted: true,
        firstWrittenAt: null,
        lastWrittenAt: null,
      };
    }
  }

  // Pick up a known-obsolete file from v0.4.x so orphan detection can remove it.
  const obsoleteSnippet = '.github/kse-autodocs/copilot-instructions-snippet.md';
  const obsoleteAbs = path.join(CWD, obsoleteSnippet);
  if (fs.existsSync(obsoleteAbs)) {
    const srcAbs = path.join(ASSETS, 'copilot', 'copilot-instructions.md');
    const srcHash = hashFile(srcAbs);
    const diskHash = hashFile(obsoleteAbs);
    manifest.files[obsoleteSnippet] = {
      kind: 'managed',
      managedHash: diskHash === srcHash ? diskHash : null,
      preExisted: diskHash !== srcHash,
      firstWrittenAt: null,
      lastWrittenAt: null,
    };
  }

  return manifest;
}

// --- decisions -----------------------------------------------------------

function decide(asset, manifest) {
  const entry = manifest.files[asset.relDest];
  const exists = fs.existsSync(asset.dest);

  if (asset.kind === 'managed') {
    const shipped = fs.readFileSync(asset.src);
    const shippedHash = hashBuffer(shipped);

    if (!exists) return { action: 'write-new', reason: 'new file', shippedHash };

    const diskHash = hashFile(asset.dest);

    // Content matches what we'd ship — nothing to do, just adopt it.
    if (diskHash === shippedHash) {
      if (!entry || entry.managedHash !== shippedHash) {
        return { action: 'adopt-unchanged', reason: 'matches shipped, adopting', shippedHash };
      }
      return { action: 'skip-unchanged', reason: 'already up-to-date', shippedHash };
    }

    // Content differs from shipped.
    if (entry && entry.managedHash && diskHash === entry.managedHash) {
      return { action: 'update-managed', reason: 'refreshing managed file', shippedHash };
    }
    if (entry && entry.preExisted) {
      return { action: 'overwrite-preexisting', reason: 'pre-existed at install time', shippedHash };
    }
    if (entry && entry.managedHash) {
      return { action: 'overwrite-user', reason: 'modified since last install', shippedHash };
    }
    return { action: 'overwrite-preexisting', reason: 'file present, origin unknown', shippedHash };
  }

  // region kind
  const incoming = fs.readFileSync(asset.src, 'utf8').replace(/\s+$/, '');
  const incomingHash = hashString(incoming);

  if (!exists) {
    return { action: 'inject-region', reason: 'new file with managed region', incoming, incomingHash };
  }

  const diskContent = fs.readFileSync(asset.dest, 'utf8');
  const currentRegion = extractRegionContent(diskContent);

  if (currentRegion === null) {
    return { action: 'inject-region', reason: 'no managed region found, injecting', incoming, incomingHash };
  }

  const currentRegionHash = hashString(currentRegion);

  if (currentRegionHash === incomingHash) {
    if (!entry || entry.regionHash !== incomingHash) {
      return { action: 'adopt-unchanged', reason: 'region matches shipped, adopting', incoming, incomingHash };
    }
    return { action: 'skip-unchanged', reason: 'region already up-to-date', incoming, incomingHash };
  }

  if (entry && entry.regionHash && currentRegionHash === entry.regionHash) {
    return { action: 'update-region', reason: 'refreshing managed region', incoming, incomingHash };
  }

  return { action: 'skip-user-region', reason: 'region modified by user', incoming, incomingHash };
}

function isConflict(d) {
  return d.action === 'overwrite-user'
    || d.action === 'overwrite-preexisting'
    || d.action === 'skip-user-region';
}

// --- plan rendering ------------------------------------------------------

const ACTION_META = {
  'write-new':             { symbol: '+', color: 'green',  label: 'new' },
  'update-managed':        { symbol: '↑', color: 'yellow', label: 'update' },
  'update-region':         { symbol: '↑', color: 'yellow', label: 'update region' },
  'inject-region':         { symbol: '+', color: 'green',  label: 'inject region' },
  'adopt-unchanged':       { symbol: '=', color: 'gray',   label: 'adopt (content matches)' },
  'overwrite-user':        { symbol: '!', color: 'red',    label: 'user-modified' },
  'overwrite-preexisting': { symbol: '!', color: 'red',    label: 'pre-existing' },
  'skip-unchanged':        { symbol: '=', color: 'gray',   label: 'unchanged' },
  'skip-user-region':      { symbol: '!', color: 'red',    label: 'region user-modified' },
  'remove':                { symbol: '✗', color: 'red',    label: 'remove' },
  'remove-region':         { symbol: '✗', color: 'red',    label: 'strip region' },
  'keep-user':             { symbol: '·', color: 'gray',   label: 'keep (user-modified)' },
  'already-gone':          { symbol: '·', color: 'gray',   label: 'already gone' },
};

function formatLine(rel, action, extra = '') {
  const m = ACTION_META[action] || { symbol: '?', color: 'gray', label: action };
  const sym = `${col[m.color] || ''}${m.symbol}${col.reset}`;
  const label = `${col.dim}(${m.label})${col.reset}`;
  const tail = extra ? ` ${col.dim}— ${extra}${col.reset}` : '';
  return `  ${sym} ${rel}  ${label}${tail}`;
}

// --- orphan detection ---------------------------------------------------

function detectOrphans(manifest) {
  const full = buildAssetPlan({ claude: true, copilot: true });
  const shipped = new Set(full.map((a) => a.relDest));
  const orphans = [];
  for (const [rel, entry] of Object.entries(manifest.files)) {
    if (shipped.has(rel)) continue;
    const abs = path.join(CWD, rel);
    if (!fs.existsSync(abs)) {
      orphans.push({ rel, entry, action: 'already-gone' });
      continue;
    }
    if (entry.kind === 'managed' && entry.managedHash) {
      const diskHash = hashFile(abs);
      orphans.push({
        rel,
        entry,
        action: diskHash === entry.managedHash ? 'remove' : 'keep-user',
      });
    } else if (entry.kind === 'region' && entry.regionHash) {
      const content = safeRead(abs) || '';
      const cur = extractRegionContent(content);
      if (cur !== null && hashString(cur) === entry.regionHash) {
        orphans.push({ rel, entry, action: 'remove-region' });
      } else {
        orphans.push({ rel, entry, action: 'keep-user' });
      }
    } else {
      orphans.push({ rel, entry, action: 'keep-user' });
    }
  }
  return orphans;
}

// --- interactive prompts -------------------------------------------------

async function prompt(question, def = '') {
  if (!process.stdin.isTTY) return def;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question(question)).trim();
  rl.close();
  return ans || def;
}

async function pickTargets() {
  if (flags.both) return { claude: true, copilot: true };
  if (flags.claude && flags.copilot) return { claude: true, copilot: true };
  if (flags.claude) return { claude: true, copilot: false };
  if (flags.copilot) return { claude: false, copilot: true };
  if (flags.yes || !process.stdin.isTTY) return { claude: true, copilot: true };

  console.log(`${col.bold}Target directory:${col.reset} ${CWD}\n`);
  console.log(`Which integrations do you want to install?`);
  console.log(`  ${col.cyan}1${col.reset}) Both Claude and Copilot  ${col.dim}(default)${col.reset}`);
  console.log(`  ${col.cyan}2${col.reset}) Claude only`);
  console.log(`  ${col.cyan}3${col.reset}) Copilot only`);
  const raw = (await prompt(`\n${col.bold}Choice${col.reset} [1]: `, '1'));
  switch (raw) {
    case '1': return { claude: true, copilot: true };
    case '2': return { claude: true, copilot: false };
    case '3': return { claude: false, copilot: true };
    default:
      console.error(`${col.red}Invalid choice:${col.reset} ${raw}`);
      process.exit(1);
  }
}

async function resolveConflicts(conflicts) {
  if (conflicts.length === 0) return;

  if (flags.force) {
    for (const c of conflicts) c.resolution = 'overwrite';
    return;
  }
  if (flags.yes || flags.dryRun || !process.stdin.isTTY) {
    for (const c of conflicts) c.resolution = 'keep';
    return;
  }

  console.log(`\n${col.yellow}${conflicts.length} file(s) need your attention:${col.reset}`);
  for (const c of conflicts) {
    console.log(formatLine(c.asset.relDest, c.action, c.reason));
  }
  console.log(`\n  ${col.cyan}o${col.reset}) overwrite all`);
  console.log(`  ${col.cyan}k${col.reset}) keep all ${col.dim}(default)${col.reset}`);
  console.log(`  ${col.cyan}r${col.reset}) review each`);
  console.log(`  ${col.cyan}a${col.reset}) abort`);
  const ans = (await prompt(`\n${col.bold}Choose${col.reset} [k]: `, 'k')).toLowerCase();

  if (ans === 'a') {
    console.log(`\n${col.dim}Aborted. Nothing written.${col.reset}`);
    process.exit(0);
  } else if (ans === 'o') {
    for (const c of conflicts) c.resolution = 'overwrite';
  } else if (ans === 'r') {
    for (const c of conflicts) {
      const a = (await prompt(
        `  ${col.yellow}!${col.reset} ${c.asset.relDest} — overwrite? [y/N]: `, 'n'
      )).toLowerCase();
      c.resolution = (a === 'y' || a === 'yes') ? 'overwrite' : 'keep';
    }
  } else {
    for (const c of conflicts) c.resolution = 'keep';
  }
}

// --- execute decisions ---------------------------------------------------

function executeDecision(d, manifest, stats) {
  const { asset } = d;
  const rel = asset.relDest;
  const now = new Date().toISOString();
  const prev = manifest.files[rel] || {};
  const firstWrittenAt = prev.firstWrittenAt || now;

  switch (d.action) {
    case 'write-new':
    case 'update-managed': {
      const buf = fs.readFileSync(asset.src);
      writeAtomic(asset.dest, buf);
      manifest.files[rel] = {
        kind: 'managed',
        managedHash: d.shippedHash,
        preExisted: prev.preExisted || false,
        firstWrittenAt,
        lastWrittenAt: now,
      };
      if (d.action === 'write-new') {
        console.log(`  ${col.green}+${col.reset} ${rel}`);
        stats.written++;
      } else {
        console.log(`  ${col.yellow}↑${col.reset} ${rel} ${col.dim}(updated)${col.reset}`);
        stats.updated++;
      }
      return;
    }
    case 'adopt-unchanged': {
      // Nothing changes on disk; just record that we own it now.
      if (asset.kind === 'managed') {
        manifest.files[rel] = {
          kind: 'managed',
          managedHash: d.shippedHash,
          preExisted: prev.preExisted || false,
          firstWrittenAt,
          lastWrittenAt: prev.lastWrittenAt || now,
        };
      } else {
        manifest.files[rel] = {
          kind: 'region',
          regionHash: d.incomingHash,
          preExisted: prev.preExisted || false,
          firstWrittenAt,
          lastWrittenAt: prev.lastWrittenAt || now,
        };
      }
      stats.skipped++;
      return;
    }
    case 'overwrite-user':
    case 'overwrite-preexisting': {
      if (d.resolution !== 'overwrite') {
        console.log(`  ${col.dim}· ${rel} (kept)${col.reset}`);
        stats.skipped++;
        return;
      }
      const buf = fs.readFileSync(asset.src);
      writeAtomic(asset.dest, buf);
      manifest.files[rel] = {
        kind: 'managed',
        managedHash: d.shippedHash,
        preExisted: d.action === 'overwrite-preexisting' ? true : (prev.preExisted || false),
        firstWrittenAt,
        lastWrittenAt: now,
      };
      console.log(`  ${col.red}!${col.reset} ${rel} ${col.dim}(overwritten)${col.reset}`);
      stats.updated++;
      return;
    }
    case 'inject-region':
    case 'update-region': {
      const existing = fs.existsSync(asset.dest) ? fs.readFileSync(asset.dest, 'utf8') : null;
      const { newContent, regionHash } = buildRegionContent(existing, d.incoming);
      writeAtomic(asset.dest, newContent);
      manifest.files[rel] = {
        kind: 'region',
        regionHash,
        preExisted: existing !== null && (prev.preExisted !== false),
        firstWrittenAt,
        lastWrittenAt: now,
      };
      if (d.action === 'inject-region') {
        console.log(`  ${col.green}+${col.reset} ${rel} ${col.dim}(managed region injected)${col.reset}`);
        stats.written++;
      } else {
        console.log(`  ${col.yellow}↑${col.reset} ${rel} ${col.dim}(region refreshed)${col.reset}`);
        stats.updated++;
      }
      return;
    }
    case 'skip-user-region': {
      if (d.resolution === 'overwrite') {
        const existing = fs.readFileSync(asset.dest, 'utf8');
        const { newContent, regionHash } = buildRegionContent(existing, d.incoming);
        writeAtomic(asset.dest, newContent);
        manifest.files[rel] = {
          kind: 'region',
          regionHash,
          preExisted: prev.preExisted !== false,
          firstWrittenAt,
          lastWrittenAt: now,
        };
        console.log(`  ${col.red}!${col.reset} ${rel} ${col.dim}(region overwritten)${col.reset}`);
        stats.updated++;
      } else {
        console.log(`  ${col.dim}· ${rel} (region kept)${col.reset}`);
        stats.skipped++;
      }
      return;
    }
    case 'skip-unchanged': {
      stats.skipped++;
      return;
    }
  }
}

function cleanupEmptyDirs() {
  const candidates = [
    '.claude/commands',
    '.claude/rules',
    '.claude',
    '.github/prompts',
  ];
  for (const rel of candidates) {
    const abs = path.join(CWD, rel);
    try {
      if (fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
    } catch { /* not a dir or not empty */ }
  }
}

// --- install flow --------------------------------------------------------

async function runInstall() {
  process.stdout.write(BANNER + '\n');

  let manifest = loadManifest();
  let migrated = false;
  if (!manifest) {
    manifest = migrateFromVersionFile();
    if (manifest) {
      migrated = true;
      console.log(`${col.yellow}▲${col.reset} Migrating a pre-0.5 install (hashing existing files into the new manifest)\n`);
    } else {
      manifest = emptyManifest();
    }
  }

  const firstInstall = !migrated && manifest.installedAt === null;
  const previousVersion = manifest.pluginVersion;
  const sameVersion = previousVersion === CURRENT_VERSION;
  const upgrading = previousVersion && previousVersion !== CURRENT_VERSION;

  if (firstInstall) {
    console.log(`${col.green}●${col.reset} First install in this repo.\n`);
  } else if (upgrading) {
    console.log(`${col.yellow}▲${col.reset} Upgrading: ${col.bold}${previousVersion}${col.reset} → ${col.bold}${CURRENT_VERSION}${col.reset}\n`);
  } else if (sameVersion && !migrated) {
    console.log(`${col.green}●${col.reset} Already on ${col.bold}v${CURRENT_VERSION}${col.reset} — re-validating file state.\n`);
  }

  const targets = await pickTargets();
  const assetPlan = buildAssetPlan(targets);

  const decisions = assetPlan.map((a) => ({ asset: a, ...decide(a, manifest) }));
  const conflicts = decisions.filter(isConflict);

  await resolveConflicts(conflicts);

  const orphans = detectOrphans(manifest);

  if (flags.dryRun) {
    console.log(`${col.bold}Plan${col.reset} ${col.dim}(--dry-run)${col.reset}\n`);
    const groupTitle = { shared: 'Shared templates', claude: 'Claude Code', copilot: 'GitHub Copilot' };
    for (const g of ['shared', 'claude', 'copilot']) {
      const inGroup = decisions.filter((d) => d.asset.group === g);
      if (inGroup.length === 0) continue;
      console.log(`\n  ${col.dim}${groupTitle[g]}${col.reset}`);
      for (const d of inGroup) console.log(formatLine(d.asset.relDest, d.action, d.reason));
    }
    if (orphans.length > 0) {
      console.log(`\n  ${col.dim}Orphans (previously installed, no longer shipped)${col.reset}`);
      for (const o of orphans) console.log(formatLine(o.rel, o.action));
    }
    console.log(`\n${col.dim}No changes made. Re-run without --dry-run to apply.${col.reset}\n`);
    return;
  }

  const stats = { written: 0, updated: 0, skipped: 0, removed: 0 };
  const groupTitle = { shared: 'Shared templates', claude: 'Claude Code', copilot: 'GitHub Copilot' };
  const groupDest = {
    shared: '.github/kse-autodocs/',
    claude: '.claude/',
    copilot: '.github/',
  };

  for (const g of ['shared', 'claude', 'copilot']) {
    const inGroup = decisions.filter((d) => d.asset.group === g);
    if (inGroup.length === 0) continue;
    console.log(`\n${col.bold}${groupTitle[g]}${col.reset} ${col.dim}→ ${groupDest[g]}${col.reset}`);
    for (const d of inGroup) executeDecision(d, manifest, stats);
  }

  if (orphans.length > 0) {
    console.log(`\n${col.bold}Cleanup${col.reset} ${col.dim}(files no longer shipped)${col.reset}`);
    for (const o of orphans) {
      const abs = path.join(CWD, o.rel);
      if (o.action === 'remove') {
        try {
          fs.rmSync(abs, { force: true });
          delete manifest.files[o.rel];
          console.log(`  ${col.red}✗${col.reset} ${o.rel}`);
          stats.removed++;
        } catch (err) {
          console.log(`  ${col.yellow}!${col.reset} ${o.rel} ${col.dim}(${err.message})${col.reset}`);
        }
      } else if (o.action === 'remove-region') {
        try {
          const content = fs.readFileSync(abs, 'utf8');
          const stripped = stripRegion(content);
          if (stripped.trim() === '') fs.rmSync(abs, { force: true });
          else writeAtomic(abs, stripped);
          delete manifest.files[o.rel];
          console.log(`  ${col.red}✗${col.reset} ${o.rel} ${col.dim}(region stripped)${col.reset}`);
          stats.removed++;
        } catch (err) {
          console.log(`  ${col.yellow}!${col.reset} ${o.rel} ${col.dim}(${err.message})${col.reset}`);
        }
      } else if (o.action === 'already-gone') {
        delete manifest.files[o.rel];
      } else if (o.action === 'keep-user') {
        console.log(`  ${col.dim}· ${o.rel} (user-modified, kept)${col.reset}`);
      }
    }
  }

  cleanupEmptyDirs();
  saveManifest(manifest);

  const bar = '━'.repeat(56);
  console.log(`\n${col.cyan}${bar}${col.reset}`);
  console.log(
    `${col.green}✓${col.reset} kse-autodocs ${col.bold}v${CURRENT_VERSION}${col.reset} installed  ` +
      `${col.dim}(${stats.written} new, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.removed} removed)${col.reset}`
  );
  console.log(`${col.cyan}${bar}${col.reset}\n`);

  if (firstInstall || upgrading) {
    console.log(
      `${col.bold}Next:${col.reset} run ${col.cyan}/docs-init${col.reset} in Claude Code${
        targets.copilot ? ' or Copilot Chat' : ''
      }`
    );
    console.log(`      to scaffold ${col.cyan}docs/AUTHORING.md${col.reset} and wire up CI.\n`);
  }
}

// --- uninstall flow ------------------------------------------------------

async function runUninstall() {
  process.stdout.write(BANNER + '\n');

  let manifest = loadManifest();
  if (!manifest) {
    manifest = migrateFromVersionFile();
    if (manifest) console.log(`${col.yellow}▲${col.reset} Reading pre-0.5 install state\n`);
  }

  if (!manifest || Object.keys(manifest.files).length === 0) {
    console.log(`${col.dim}Nothing to uninstall — no kse-autodocs manifest found in ${CWD}${col.reset}`);
    return;
  }

  const plan = [];
  for (const [rel, entry] of Object.entries(manifest.files)) {
    const abs = path.join(CWD, rel);
    if (!fs.existsSync(abs)) {
      plan.push({ rel, entry, action: 'already-gone' });
      continue;
    }
    if (entry.kind === 'managed') {
      if (!entry.managedHash) {
        plan.push({ rel, entry, action: 'keep-user' });
        continue;
      }
      const diskHash = hashFile(abs);
      plan.push({
        rel,
        entry,
        action: diskHash === entry.managedHash ? 'remove' : 'keep-user',
      });
    } else if (entry.kind === 'region') {
      const content = fs.readFileSync(abs, 'utf8');
      const cur = extractRegionContent(content);
      if (cur === null) {
        plan.push({ rel, entry, action: 'keep-user' });
      } else if (entry.regionHash && hashString(cur) === entry.regionHash) {
        plan.push({ rel, entry, action: 'remove-region' });
      } else {
        plan.push({ rel, entry, action: 'keep-user' });
      }
    }
  }

  if (flags.force) {
    for (const p of plan) {
      if (p.action === 'keep-user') {
        p.action = p.entry.kind === 'region' ? 'remove-region' : 'remove';
      }
    }
  }

  const willRemove = plan.filter((p) => p.action === 'remove' || p.action === 'remove-region');
  const willKeep = plan.filter((p) => p.action === 'keep-user');

  if (flags.dryRun) {
    console.log(`${col.bold}Plan${col.reset} ${col.dim}(--dry-run)${col.reset}\n`);
    for (const p of plan) console.log(formatLine(p.rel, p.action));
    console.log(`\n${col.dim}--dry-run: no changes made.${col.reset}`);
    return;
  }

  if (willRemove.length === 0) {
    console.log(`${col.bold}Plan${col.reset}\n`);
    for (const p of plan) console.log(formatLine(p.rel, p.action));
    console.log(`\n${col.dim}Nothing to remove — all managed files are user-modified or already gone.${col.reset}`);
    console.log(`${col.dim}Pass --force to remove user-modified files too.${col.reset}`);
    return;
  }

  if (!flags.yes) {
    if (!process.stdin.isTTY) {
      console.log(`${col.red}Refusing to uninstall without a TTY.${col.reset} Pass ${col.cyan}--yes${col.reset} to confirm non-interactively.\n`);
      process.exit(1);
    }
    console.log(`${col.bold}Plan${col.reset}\n`);
    for (const p of plan) console.log(formatLine(p.rel, p.action));
    const ans = (await prompt(`\n${col.bold}Proceed?${col.reset} [y/N]: `, 'n')).toLowerCase();
    if (ans !== 'y' && ans !== 'yes') {
      console.log(`\n${col.dim}Cancelled. Nothing removed.${col.reset}`);
      return;
    }
    console.log();
  }

  let removed = 0;
  for (const p of plan) {
    const abs = path.join(CWD, p.rel);
    if (p.action === 'remove') {
      try {
        fs.rmSync(abs, { force: true });
        delete manifest.files[p.rel];
        console.log(`  ${col.red}✗${col.reset} ${p.rel}`);
        removed++;
      } catch (err) {
        console.log(`  ${col.yellow}!${col.reset} ${p.rel} ${col.dim}(${err.message})${col.reset}`);
      }
    } else if (p.action === 'remove-region') {
      try {
        const content = fs.readFileSync(abs, 'utf8');
        const stripped = stripRegion(content);
        if (stripped.trim() === '') {
          fs.rmSync(abs, { force: true });
          console.log(`  ${col.red}✗${col.reset} ${p.rel} ${col.dim}(region stripped, file was only ours → removed)${col.reset}`);
        } else {
          writeAtomic(abs, stripped);
          console.log(`  ${col.red}✗${col.reset} ${p.rel} ${col.dim}(region stripped, user content kept)${col.reset}`);
        }
        delete manifest.files[p.rel];
        removed++;
      } catch (err) {
        console.log(`  ${col.yellow}!${col.reset} ${p.rel} ${col.dim}(${err.message})${col.reset}`);
      }
    } else if (p.action === 'already-gone') {
      delete manifest.files[p.rel];
    }
  }

  cleanupEmptyDirs();

  const remainingManaged = Object.keys(manifest.files).length;
  if (remainingManaged === 0) {
    try { fs.rmSync(KSE_DIR, { recursive: true, force: true }); } catch {}
    console.log(`  ${col.dim}✗ .github/kse-autodocs/ (manifest + templates removed)${col.reset}`);
  } else {
    saveManifest(manifest);
  }

  try {
    const gh = path.join(CWD, '.github');
    if (fs.readdirSync(gh).length === 0) {
      fs.rmdirSync(gh);
      console.log(`  ${col.dim}✗ .github/ (empty, removed)${col.reset}`);
    }
  } catch { /* not empty or missing */ }

  const bar = '━'.repeat(56);
  console.log(`\n${col.cyan}${bar}${col.reset}`);
  console.log(`${col.green}✓${col.reset} kse-autodocs uninstalled  ${col.dim}(${removed} removed, ${willKeep.length} kept)${col.reset}`);
  console.log(`${col.cyan}${bar}${col.reset}\n`);

  if (willKeep.length > 0) {
    console.log(`${col.yellow}NOTE:${col.reset} ${willKeep.length} file(s) were kept because they have your edits:`);
    for (const p of willKeep) console.log(`  ${col.dim}· ${p.rel}${col.reset}`);
    console.log(`      Use ${col.cyan}--force${col.reset} to remove these too.\n`);
  }
}

// --- entrypoint ----------------------------------------------------------

async function run() {
  if (subcommand === 'uninstall' || subcommand === 'remove') {
    await runUninstall();
  } else if (subcommand === 'install') {
    await runInstall();
  } else {
    console.error(`${col.red}Unknown command:${col.reset} ${subcommand}`);
    console.error(`Run ${col.cyan}npx kse-autodocs --help${col.reset} for usage.`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
