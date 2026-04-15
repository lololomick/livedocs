# kse-autodocs

Scaffolds and maintains developer documentation in a consistent, human-readable style. Installs slash commands for **Claude Code** and / or **GitHub Copilot** into your repo with a single command — no Claude Code required to install, no configuration files to edit. Language-agnostic: works with C#, TypeScript/JavaScript, Python, Rust, Go, Java, and more.

## What you get

Two slash commands, available in both Claude Code and GitHub Copilot Chat:

- **`/docs-init`** — scaffolds `docs/AUTHORING.md`, `docs/TEMPLATE.md`, `docs/CHANGELOG.md`, and a CI pipeline snippet that auto-updates docs and the changelog on every commit.
- **`/docs-generate`** — bootstraps documentation for your existing code. Processes components in parallel (Claude) or sequentially (Copilot), respects a per-session cap, and resumes across sessions via a persistent progress file so large projects can be documented safely over multiple runs.

After `/docs-init` has been run and CI is configured, documentation keeps itself up to date — every commit triggers a Copilot CLI step that checks whether the commit's doc updates cover the code changes, fills in any gaps, and appends a changelog entry. The CI step never rewrites docs that are already correct, so if you (or an AI working in your editor) kept docs in sync locally, CI becomes a no-op.

---

## Installation

Run one command inside your repo:

```
npx kse-autodocs@latest
```

You'll be asked whether to install the Claude integration, the Copilot integration, or both (default). That's it — no Claude Code, no global setup, no plugin marketplace.

If you have trouble with the interactive prompt, you can use flags to specify your choice directly:

### Flags

```
npx kse-autodocs@latest --both      # install both (same as the interactive default)
npx kse-autodocs@latest --claude    # install Claude Code commands only
npx kse-autodocs@latest --copilot   # install Copilot prompts only
npx kse-autodocs@latest --yes       # skip the prompt, install both
npx kse-autodocs@latest --force     # overwrite files that already exist
npx kse-autodocs@latest --help      # full help
```

Re-running the installer on an already-set-up repo is safe:

- If the installed version matches what's in the package, all files are left alone.
- If the package version is **newer** than what's in the repo, "library" files (shared templates, slash commands, Claude rule, Copilot prompts) are auto-refreshed to the new version.
- One file is treated as **user-owned** and never auto-overwritten: `.github/copilot-instructions.md`. On an upgrade the installer leaves it alone and drops a fresh reference at `.github/kse-autodocs/copilot-instructions-snippet.md` so you can merge changes manually.
- The installer never touches `CLAUDE.md` or `docs/` at all — Claude's always-on rule lives in `.claude/rules/kse-autodocs.md`, which Claude Code auto-loads alongside any existing `CLAUDE.md`.
- `--force` overwrites everything including user-owned files. Use sparingly.

The installed version is tracked in `.github/kse-autodocs/.version`.

### What gets written

Relative to the repo root where you run the command:

```
.github/
├── kse-autodocs/                           ← shared templates (always)
│   ├── AUTHORING.md
│   ├── TEMPLATE.md
│   ├── CHANGELOG.md
│   ├── pipeline-snippet.azure-pipelines.yml
│   ├── pipeline-snippet.github-actions.yml
│   └── copilot-instructions-snippet.md     ← reference copy for merging
├── copilot-instructions.md                 ← if Copilot selected (user-owned)
└── prompts/                                ← if Copilot selected
    ├── docs-init.prompt.md
    └── docs-generate.prompt.md

.claude/
├── commands/                               ← if Claude selected
│   ├── docs-init.md
│   └── docs-generate.md
└── rules/                                  ← if Claude selected
    └── kse-autodocs.md                     ← always-on rule (auto-loaded)
```

**Always-on instructions.** Both `.claude/rules/kse-autodocs.md` and `.github/copilot-instructions.md` are read by the respective AI on every prompt. They tell the assistant to keep docs in sync with code whenever it edits source files, using `docs/AUTHORING.md` as the source of truth.

**No CLAUDE.md collision.** The Claude rule lives under `.claude/rules/`, which Claude Code auto-loads alongside any existing `CLAUDE.md` at the repo root — so the installer never touches your own `CLAUDE.md`.

**Copilot collision handling.** Copilot only reads `.github/copilot-instructions.md`, so if you already have one the installer skips it and drops a fresh reference at `.github/kse-autodocs/copilot-instructions-snippet.md` for manual merging.

Commit whichever of these you want teammates to use. The shared templates (`.github/kse-autodocs/`) are read by both `/docs-init` commands at runtime — commit them too.

---

## First-time use in a target repo

After running `npx kse-autodocs@latest`:

1. Open the repo in Claude Code or VS Code (with Copilot Chat).

2. Run:

   ```
   /docs-init
   ```

   This scaffolds `docs/AUTHORING.md`, `docs/TEMPLATE.md`, `docs/CHANGELOG.md`, and the empty `docs/Reference/` directory. It also detects your CI platform and adds the auto-doc step (Azure Pipelines → appends to `azure-pipelines.yml`; GitHub Actions → creates `.github/workflows/auto-docs.yml`).

3. **Configure the CI secret** — the `/docs-init` output reminds you how:
   - **Azure Pipelines:** add a pipeline variable `COPILOT_PAT` (type: secret) with a GitHub PAT that has `repo` scope.
   - **GitHub Actions:** add a repository secret `COPILOT_PAT` with the same value.

   Without this secret, the auto-doc step in CI will fail silently.

4. Bootstrap documentation for the existing codebase:

   ```
   /docs-generate
   ```

   For large projects, expect multiple sessions — progress is saved in `docs/.docs-progress.json` and each run picks up where the previous left off.

5. Commit the `docs/` folder (and any `.github/` changes) as a first "docs bootstrap" commit.

From this point on, every commit with source-code changes triggers CI to update affected docs and append a changelog entry automatically.

---

## Repository layout (of this plugin)

```
kse-autodocs/
├── README.md                               ← you are here
├── package.json
├── bin/
│   └── install.js                          ← the `npx kse-autodocs@latest` entry point
└── assets/
    ├── shared/                             ← templates deployed to .github/kse-autodocs/
    │   ├── AUTHORING.md
    │   ├── TEMPLATE.md
    │   ├── CHANGELOG.md
    │   ├── pipeline-snippet.azure-pipelines.yml
    │   └── pipeline-snippet.github-actions.yml
    ├── claude/
    │   ├── commands/                       ← deployed to .claude/commands/
    │   │   ├── docs-init.md
    │   │   └── docs-generate.md
    │   └── rules/
    │       └── kse-autodocs.md             ← deployed to .claude/rules/
    └── copilot/
        ├── copilot-instructions.md         ← deployed to .github/copilot-instructions.md
        └── prompts/                        ← deployed to .github/prompts/
            ├── docs-init.prompt.md
            └── docs-generate.prompt.md
```

`assets/shared/` is the source of truth for the authoring guide and all scaffolded content. Update files there, publish a new version of this package, and users pick up the new version on the next `npx kse-autodocs@latest --force`.

---

## Language support

The plugin detects the primary language(s) of your repository by probing for common project files (`*.csproj`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, `Gemfile`, `composer.json`, `Package.swift`, …). See `AUTHORING.md` section 3 for the full table.

Multi-language repositories (e.g. C# backend + TypeScript frontend) are handled by documenting each tree under its own top-level folder in `docs/`.

---

## Session cap and resumable progress

Documentation of a large codebase does not always fit in one AI session. The plugin handles this with:

- **A persistent progress file** (`docs/.docs-progress.json`) tracking every planned component and its status (`pending`, `in_progress`, `done`).
- **A session cap** (default: 5 components per run) that forces the agent to stop at a safe boundary.
- **A clear stopping message** that tells the user to run `/docs-generate` again in a new chat. Progress is never lost.

AI tokens are spent predictably, large projects are bootstrapped incrementally, and no work is ever repeated.

---

## Style rules (summary)

Full rules in `AUTHORING.md` (copied to `docs/AUTHORING.md` by `/docs-init`). The essentials:

- Docs are for **humans**, not for AI. Readable prose, not type dumps.
- **Full enumerations** — never "X, Y, etc.".
- **Operational section headings** ("Startup sequence", "Error handling"), not structural ones ("Public API", "Dependencies").
- **ASCII diagrams**, not Mermaid.
- **No** `Further reading`, `History`, `TODO`, or boilerplate sections.
- **Shared enums and codes** live in `docs/Reference/`, not duplicated across component docs.

---

## Updating the plugin

Just re-run the installer — it auto-detects version changes and refreshes only what's outdated:

```
npx kse-autodocs@latest
```

Library files (templates, slash commands, Claude rule, Copilot prompts) refresh automatically on a version bump. `.github/copilot-instructions.md` is user-owned and left alone; compare it against the fresh copy at `.github/kse-autodocs/copilot-instructions-snippet.md` and merge by hand.

Pass `--force` to overwrite everything including user-owned files:

```
npx kse-autodocs@latest --force
```

Existing `docs/AUTHORING.md` and other files inside `docs/` are **not** touched by the installer — they are only written by `/docs-init`, and only if they do not already exist. Teams can safely refresh the plugin without losing repo-level customizations.

To pull updated templates into an already-scaffolded `docs/` folder, delete the old file (`rm docs/AUTHORING.md`) and re-run `/docs-init`. Or update the file manually.

---


## Uninstalling

To remove kse-autodocs from a repo:

```
npx kse-autodocs@latest uninstall
```

Shows what will be removed, asks for confirmation, then deletes:

- `.claude/commands/docs-init.md` and `.claude/commands/docs-generate.md`
- `.claude/rules/kse-autodocs.md`
- `.github/prompts/docs-init.prompt.md` and `.github/prompts/docs-generate.prompt.md`
- `.github/kse-autodocs/` (the whole folder)
- Any parent directories that become empty (e.g. `.claude/`)

**Never removed** (you decide what to do with them):

- `CLAUDE.md` — not written by the installer in the first place
- `.github/copilot-instructions.md` — Copilot's only instruction file, treated as user-owned
- `docs/` — your repo's documentation

Pass `--yes` to skip the confirmation prompt (e.g. for CI scripts).

---

## Troubleshooting

**`/docs-init` says it cannot find the templates.**
The `.github/kse-autodocs/` folder is missing. Run `npx kse-autodocs@latest` at the repo root.

**The CI step fails with authentication errors.**
Check that `COPILOT_PAT` is set in your CI secrets and has `repo` scope. The CI snippet passes it to the Copilot CLI via the `COPILOT_GITHUB_TOKEN` environment variable.

**The AI is re-documenting components already marked `done`.**
It is ignoring the progress file. This should not happen with the bundled commands — if it does, make sure you are using `/docs-generate` from this plugin and not a free-form prompt.

**I want to re-generate a specific doc from scratch.**
Delete its entry from `docs/.docs-progress.json` (or set its status to `pending`) and delete the doc file. The next `/docs-generate` will regenerate it.

**Copilot in VS Code does not see the `/docs-init` or `/docs-generate` commands.**
Make sure you ran `npx kse-autodocs@latest` (or `npx kse-autodocs@latest --copilot`) and that `.github/prompts/` was created. Reload VS Code — Copilot discovers prompt files on startup.

**npm error "No matching version found"**
Try running `npm cache clean --force` then re-running the install command. This clears the local npm cache, which can get into a bad state and fail to recognize newly published versions.