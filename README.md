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
npx kse-autodocs
```

You'll be asked whether to install the Claude integration, the Copilot integration, or both (default). That's it — no Claude Code, no global setup, no plugin marketplace.

### Flags

```
npx kse-autodocs --both      # install both (same as the interactive default)
npx kse-autodocs --claude    # install Claude Code commands only
npx kse-autodocs --copilot   # install Copilot prompts only
npx kse-autodocs --yes       # skip the prompt, install both
npx kse-autodocs --force     # overwrite files that already exist
npx kse-autodocs --help      # full help
```

Re-running the installer on an already-set-up repo is safe:

- If the installed version matches what's in the package, all files are left alone.
- If the package version is **newer** than what's in the repo, "library" files (shared templates, slash commands, Copilot prompts) are auto-refreshed to the new version.
- Two files are treated as **user-owned** and never auto-overwritten: `CLAUDE.md` and `.github/copilot-instructions.md`. On an upgrade the installer leaves them alone and prints a note pointing to the updated snippets in `.github/kse-autodocs/` so you can merge changes manually.
- `--force` overwrites everything including user-owned files. Use sparingly.

The installed version is tracked in `.github/kse-autodocs/.version`.

### What gets written

Relative to the repo root where you run the command:

```
.github/
├── kse-autodocs/                      ← shared templates (always)
│   ├── AUTHORING.md
│   ├── TEMPLATE.md
│   ├── CHANGELOG.md
│   ├── pipeline-snippet.azure-pipelines.yml
│   ├── pipeline-snippet.github-actions.yml
│   └── CLAUDE-snippet.md              ← reference copy of CLAUDE.md content
├── copilot-instructions.md           ← if Copilot selected (always-on rules)
└── prompts/                          ← if Copilot selected
    ├── docs-init.prompt.md
    └── docs-generate.prompt.md

.claude/
└── commands/                         ← if Claude selected
    ├── docs-init.md
    └── docs-generate.md

CLAUDE.md                              ← if Claude selected (always-on rules)
```

The `CLAUDE.md` at repo root and `.github/copilot-instructions.md` are **always-on instructions**: both AI assistants read them on every prompt. They tell the assistant to keep docs in sync with code whenever it edits source files, using `docs/AUTHORING.md` as the source of truth.

If `CLAUDE.md` already exists in your repo, the installer will skip it and point you at `.github/kse-autodocs/CLAUDE-snippet.md` so you can merge the instructions into your existing file manually.

Commit whichever of these you want teammates to use. The shared templates (`.github/kse-autodocs/`) are read by both `/docs-init` commands at runtime — commit them too.

---

## First-time use in a target repo

After running `npx kse-autodocs`:

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
│   └── install.js                          ← the `npx kse-autodocs` entry point
└── assets/
    ├── shared/                             ← templates deployed to .github/kse-autodocs/
    │   ├── AUTHORING.md
    │   ├── TEMPLATE.md
    │   ├── CHANGELOG.md
    │   ├── pipeline-snippet.azure-pipelines.yml
    │   └── pipeline-snippet.github-actions.yml
    ├── claude/
    │   └── commands/                       ← deployed to .claude/commands/
    │       ├── docs-init.md
    │       └── docs-generate.md
    └── copilot/
        ├── copilot-instructions.md         ← deployed to .github/copilot-instructions.md
        └── prompts/                        ← deployed to .github/prompts/
            ├── docs-init.prompt.md
            └── docs-generate.prompt.md
```

`assets/shared/` is the source of truth for the authoring guide and all scaffolded content. Update files there, publish a new version of this package, and users pick up the new version on the next `npx kse-autodocs --force`.

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

Re-run the installer with `--force` to pull the latest versions of the templates and commands into your repo:

```
npx kse-autodocs@latest --force
```

Existing `docs/AUTHORING.md` and other files inside `docs/` are **not** touched by the installer — they are only written by `/docs-init`, and only if they do not already exist. Teams can safely refresh the plugin without losing repo-level customizations.

To pull updated templates into an already-scaffolded `docs/` folder, delete the old file (`rm docs/AUTHORING.md`) and re-run `/docs-init`. Or update the file manually.

---

## Troubleshooting

**`/docs-init` says it cannot find the templates.**
The `.github/kse-autodocs/` folder is missing. Run `npx kse-autodocs` at the repo root.

**The CI step fails with authentication errors.**
Check that `COPILOT_PAT` is set in your CI secrets and has `repo` scope. The CI snippet passes it to the Copilot CLI via the `COPILOT_GITHUB_TOKEN` environment variable.

**The AI is re-documenting components already marked `done`.**
It is ignoring the progress file. This should not happen with the bundled commands — if it does, make sure you are using `/docs-generate` from this plugin and not a free-form prompt.

**I want to re-generate a specific doc from scratch.**
Delete its entry from `docs/.docs-progress.json` (or set its status to `pending`) and delete the doc file. The next `/docs-generate` will regenerate it.

**Copilot in VS Code does not see the `/docs-init` or `/docs-generate` commands.**
Make sure you ran `npx kse-autodocs` (or `npx kse-autodocs --copilot`) and that `.github/prompts/` was created. Reload VS Code — Copilot discovers prompt files on startup.
