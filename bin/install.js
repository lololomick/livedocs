#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');

const pkg = require('../package.json');
const CURRENT_VERSION = pkg.version;

const ASSETS = path.join(__dirname, '..', 'assets');
const CWD = process.cwd();
const MARKER = path.join(CWD, '.github', 'kse-autodocs', '.version');

const args = process.argv.slice(2);
const flags = {
  claude: args.includes('--claude'),
  copilot: args.includes('--copilot'),
  both: args.includes('--both'),
  yes: args.includes('--yes') || args.includes('-y'),
  force: args.includes('--force') || args.includes('-f'),
  help: args.includes('--help') || args.includes('-h'),
  noColor: args.includes('--no-color') || process.env.NO_COLOR,
};

const useColor = process.stdout.isTTY && !flags.noColor;
const c = (code) => (useColor ? `\x1b[${code}m` : '');
const col = {
  reset: c(0),
  bold: c(1),
  dim: c(2),
  red: c(31),
  green: c(32),
  yellow: c(33),
  blue: c(34),
  magenta: c(35),
  cyan: c(36),
  gray: c(90),
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
  npx kse-autodocs [options]

Options:
  --claude       Install Claude Code integration only
  --copilot      Install GitHub Copilot integration only
  --both         Install both (this is also the default)
  -y, --yes      Skip the interactive prompt (implies --both)
  -f, --force    Overwrite ALL files, even user-owned ones
  --no-color     Disable ANSI colors in output
  -h, --help     Show this help

What gets written (relative to the current working directory):

  .github/kse-autodocs/            shared templates (always)
  .claude/commands/*.md           Claude slash commands          (--claude)
  CLAUDE.md                       Claude repo-wide instructions  (--claude)
  .github/copilot-instructions.md Copilot repo-wide instructions (--copilot)
  .github/prompts/*.prompt.md     Copilot prompt files           (--copilot)

Auto-update behavior:
  The installer tracks the version it last wrote to this repo in
  .github/kse-autodocs/.version. On a version bump it automatically
  refreshes "library" files (templates, slash commands, Copilot prompts).
  Two files are treated as user-owned and are never auto-overwritten —
  CLAUDE.md and .github/copilot-instructions.md. Use --force to
  overwrite those.
`;

if (flags.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

function parseVer(v) {
  return (v || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
}
function isNewer(a, b) {
  const A = parseVer(a);
  const B = parseVer(b);
  for (let i = 0; i < 3; i++) {
    if (A[i] > B[i]) return true;
    if (A[i] < B[i]) return false;
  }
  return false;
}
function readInstalledVersion() {
  try {
    return fs.readFileSync(MARKER, 'utf8').trim();
  } catch {
    return null;
  }
}
function writeInstalledVersion() {
  fs.mkdirSync(path.dirname(MARKER), { recursive: true });
  fs.writeFileSync(MARKER, CURRENT_VERSION + '\n');
}

async function pickTargets() {
  if (flags.both) return { claude: true, copilot: true };
  if (flags.claude && flags.copilot) return { claude: true, copilot: true };
  if (flags.claude) return { claude: true, copilot: false };
  if (flags.copilot) return { claude: false, copilot: true };
  if (flags.yes || !process.stdin.isTTY) return { claude: true, copilot: true };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`${col.bold}Target directory:${col.reset} ${CWD}\n`);
  console.log(`Which integrations do you want to install?`);
  console.log(`  ${col.cyan}1${col.reset}) Both Claude and Copilot  ${col.dim}(default)${col.reset}`);
  console.log(`  ${col.cyan}2${col.reset}) Claude only`);
  console.log(`  ${col.cyan}3${col.reset}) Copilot only`);
  const raw = (await rl.question(`\n${col.bold}Choice${col.reset} [1]: `)).trim() || '1';
  rl.close();
  switch (raw) {
    case '1':
      return { claude: true, copilot: true };
    case '2':
      return { claude: true, copilot: false };
    case '3':
      return { claude: false, copilot: true };
    default:
      console.error(`${col.red}Invalid choice:${col.reset} ${raw}`);
      process.exit(1);
  }
}

const stats = { written: 0, updated: 0, skipped: 0 };

function copyFile(src, dest, opts = {}) {
  const userOwned = opts.userOwned === true;
  const rel = path.relative(CWD, dest);
  const exists = fs.existsSync(dest);

  const allowOverwrite = flags.force || (exists && !userOwned && upgrading);

  if (exists && !allowOverwrite) {
    console.log(`  ${col.dim}- ${rel}  (exists, skipped)${col.reset}`);
    stats.skipped++;
    return { written: false, existed: true };
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);

  if (exists) {
    console.log(`  ${col.yellow}↑${col.reset} ${rel} ${col.dim}(updated)${col.reset}`);
    stats.updated++;
  } else {
    console.log(`  ${col.green}+${col.reset} ${rel}`);
    stats.written++;
  }
  return { written: true, existed: exists };
}

function copyDir(srcDir, destDir, opts = {}) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDir(src, dest, opts);
    else copyFile(src, dest, opts);
  }
}

let upgrading = false;

async function main() {
  process.stdout.write(BANNER + '\n');

  const installedVer = readInstalledVersion();
  upgrading = installedVer && isNewer(CURRENT_VERSION, installedVer);
  const firstInstall = !installedVer;

  if (upgrading) {
    console.log(
      `${col.yellow}▲${col.reset} Upgrading: ${col.bold}${installedVer}${col.reset} → ${col.bold}${CURRENT_VERSION}${col.reset} ${col.dim}(library files will be refreshed)${col.reset}\n`
    );
  } else if (installedVer && !flags.force) {
    console.log(
      `${col.green}●${col.reset} Already on ${col.bold}v${CURRENT_VERSION}${col.reset}. Existing files will be kept. ${col.dim}Use --force to overwrite.${col.reset}\n`
    );
  } else if (firstInstall) {
    console.log(`${col.green}●${col.reset} First install in this repo.\n`);
  }

  const targets = await pickTargets();

  console.log(`\n${col.bold}Shared templates${col.reset} ${col.dim}→ .github/kse-autodocs/${col.reset}`);
  copyDir(path.join(ASSETS, 'shared'), path.join(CWD, '.github', 'kse-autodocs'));

  let claudeMdSkipped = false;
  if (targets.claude) {
    console.log(`\n${col.bold}Claude Code${col.reset} ${col.dim}→ .claude/commands/ and CLAUDE.md${col.reset}`);
    copyDir(path.join(ASSETS, 'claude', 'commands'), path.join(CWD, '.claude', 'commands'));
    const res = copyFile(
      path.join(ASSETS, 'claude', 'CLAUDE.md'),
      path.join(CWD, 'CLAUDE.md'),
      { userOwned: true }
    );
    claudeMdSkipped = !res.written && res.existed;
    copyFile(
      path.join(ASSETS, 'claude', 'CLAUDE.md'),
      path.join(CWD, '.github', 'kse-autodocs', 'CLAUDE-snippet.md')
    );
  }

  let copilotInstructionsSkipped = false;
  if (targets.copilot) {
    console.log(`\n${col.bold}GitHub Copilot${col.reset} ${col.dim}→ .github/${col.reset}`);
    const res = copyFile(
      path.join(ASSETS, 'copilot', 'copilot-instructions.md'),
      path.join(CWD, '.github', 'copilot-instructions.md'),
      { userOwned: true }
    );
    copilotInstructionsSkipped = !res.written && res.existed;
    copyDir(path.join(ASSETS, 'copilot', 'prompts'), path.join(CWD, '.github', 'prompts'));
    copyFile(
      path.join(ASSETS, 'copilot', 'copilot-instructions.md'),
      path.join(CWD, '.github', 'kse-autodocs', 'copilot-instructions-snippet.md')
    );
  }

  writeInstalledVersion();

  const bar = '━'.repeat(56);
  console.log(`\n${col.cyan}${bar}${col.reset}`);
  console.log(
    `${col.green}✓${col.reset} kse-autodocs ${col.bold}v${CURRENT_VERSION}${col.reset} installed  ` +
      `${col.dim}(${stats.written} new, ${stats.updated} updated, ${stats.skipped} skipped)${col.reset}`
  );
  console.log(`${col.cyan}${bar}${col.reset}\n`);

  console.log(
    `${col.bold}Next:${col.reset} run ${col.cyan}/docs-init${col.reset} in Claude Code${
      targets.copilot ? ' or Copilot Chat' : ''
    }`
  );
  console.log(`      to scaffold ${col.cyan}docs/AUTHORING.md${col.reset} and wire up CI.\n`);

  const showMergeHints = firstInstall || upgrading;
  if (claudeMdSkipped && showMergeHints) {
    console.log(
      `${col.yellow}NOTE:${col.reset} ${col.bold}CLAUDE.md${col.reset} already exists and was NOT overwritten.`
    );
    console.log(
      `      Merge updated instructions from ${col.cyan}.github/kse-autodocs/CLAUDE-snippet.md${col.reset}`
    );
    console.log(`      into your CLAUDE.md so Claude picks them up on every prompt.\n`);
  }
  if (copilotInstructionsSkipped && showMergeHints) {
    console.log(
      `${col.yellow}NOTE:${col.reset} ${col.bold}.github/copilot-instructions.md${col.reset} already exists and was NOT overwritten.`
    );
    console.log(
      `      Merge updated instructions from ${col.cyan}.github/kse-autodocs/copilot-instructions-snippet.md${col.reset}`
    );
    console.log(`      into your file so Copilot picks them up on every prompt.\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
