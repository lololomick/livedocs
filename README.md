<div align="center">

# livedocs

**Living documentation for Claude Code and GitHub Copilot — that keeps itself in sync with your code.**

[![npm version](https://img.shields.io/npm/v/@lololomick/livedocs?style=for-the-badge&color=blue&label=npm)](https://www.npmjs.com/package/@lololomick/livedocs)
[![npm downloads](https://img.shields.io/npm/dw/@lololomick/livedocs?style=for-the-badge&color=green&label=downloads)](https://www.npmjs.com/package/@lololomick/livedocs)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)](./LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=for-the-badge)](https://nodejs.org)

[Install](#installation) · [Quick start](#quick-start) · [Highlights](#highlights) · [How it works](#how-it-works) · [Updating](#updating) · [Uninstalling](#uninstalling) · [Troubleshooting](#troubleshooting)

</div>

---

**livedocs** installs two slash commands — `/docs-init` and `/docs-generate` — that work in both **Claude Code** and **GitHub Copilot Chat**. It scaffolds a structured `docs/` folder, wires up a CI step, and keeps your documentation in sync with your code on every commit.

- **No Claude Code needed to install.** No global setup, no plugin marketplace, no config files to edit.
- **Language-agnostic.** C#, TypeScript/JavaScript, Python, Rust, Go, Java, PHP, Ruby, Swift.
- **Safe re-install.** Every file the installer writes is tracked by SHA-256 hash; your edits are detected and never overwritten silently.
- **Coexists with your existing Copilot instructions.** A managed region inside `copilot-instructions.md` keeps installer content and your content side-by-side.

---

## Installation

Run one command inside your repo:

```bash
npx @lololomick/livedocs@latest
```

That's it — you'll be asked whether to install the Claude integration, the Copilot integration, or both (default).

### Flags

```bash
npx @lololomick/livedocs@latest --both      # install both (also the default)
npx @lololomick/livedocs@latest --claude    # install Claude Code commands only
npx @lololomick/livedocs@latest --copilot   # install Copilot prompts only
npx @lololomick/livedocs@latest --yes       # non-interactive (keep user-modified files)
npx @lololomick/livedocs@latest --force     # overwrite every file, including user-modified
npx @lololomick/livedocs@latest --dry-run   # show what would change without touching anything
npx @lololomick/livedocs@latest --help      # full help
```

## Quick start

After installing, open your repo in Claude Code or VS Code (with Copilot Chat) and run:

```
/docs-init
```

This scaffolds `docs/AUTHORING.md`, `docs/TEMPLATE.md`, `docs/CHANGELOG.md`, the empty `docs/Reference/` directory, and detects your CI platform. It appends the auto-doc step to Azure Pipelines or creates `.github/workflows/auto-docs.yml` for GitHub Actions.

Then configure the CI secret (the `/docs-init` output reminds you how):

- **Azure Pipelines** — add a pipeline variable `COPILOT_PAT` (type: secret) with a GitHub PAT that has `repo` scope.
- **GitHub Actions** — add a repository secret `COPILOT_PAT` with the same value.

Finally, bootstrap docs for your existing code:

```
/docs-generate
```

Large projects expect multiple sessions — progress is saved in `docs/.docs-progress.json`, so each run picks up where the last left off.

From here on, every commit with source-code changes triggers CI to update affected docs and append a changelog entry automatically.

---

## Highlights

- **`/docs-init`** — scaffolds the docs folder structure and wires up CI in a single command.
- **`/docs-generate`** — bootstraps documentation for your existing codebase. Processes components in parallel (Claude) or sequentially (Copilot), respects a per-session cap, and resumes across sessions via a persistent progress file.
- **Auto-sync via CI** — after `/docs-init`, every commit triggers a Copilot CLI step that checks whether your doc updates cover your code changes, fills in any gaps, and appends a changelog entry. If your local AI already kept docs in sync, CI becomes a no-op.
- **Per-file hash tracking** — the installer records a SHA-256 of every file it writes in `.github/livedocs/.manifest.json`, so re-installs refresh only what hasn't been manually edited.
- **Managed regions** — `.github/copilot-instructions.md` uses marker comments so installer content and your own instructions can coexist in the same file.
- **Resumable progress** — `docs/.docs-progress.json` tracks every planned component, letting large projects be documented incrementally across sessions without ever repeating work.

---

## How it works

### Install tracking

Re-running the installer on an already-set-up repo is safe. Every file written by the installer is recorded in `.github/livedocs/.manifest.json` with a SHA-256 content hash. On re-install that hash tells livedocs-managed files apart from yours:

| State | Behavior |
| --- | --- |
| **Managed & unchanged** | Silently refreshed on a version bump. |
| **User-modified** | Prompted (or kept as-is with `--yes`, or overwritten with `--force`). |
| **Pre-existed before install** | Treated as user-owned; prompted before overwrite. |
| **No longer shipped** | Removed as an orphan if the hash still matches what we wrote, otherwise kept. |

### Managed region in `copilot-instructions.md`

Copilot reads only one path for repo instructions. To avoid stomping on your own content, livedocs maintains a marker block inside the file:

```
<!-- BEGIN livedocs (managed section — do not edit) -->
(installer content)
<!-- END livedocs -->
```

Anything outside the markers is yours. On updates only the block between the markers changes. On uninstall the block is stripped and the rest of the file is kept.

### File layout

Relative to the repo root:

```
.github/
├── livedocs/                               ← shared templates + install manifest
│   ├── .manifest.json                      ← per-file hashes (installer bookkeeping)
│   ├── .version                            ← plugin version (human-readable)
│   ├── AUTHORING.md
│   ├── TEMPLATE.md
│   ├── CHANGELOG.md
│   ├── pipeline-snippet.azure-pipelines.yml
│   └── pipeline-snippet.github-actions.yml
├── copilot-instructions.md                 ← if Copilot selected (user-owned, managed region inside)
└── prompts/                                ← if Copilot selected
    ├── docs-init.prompt.md
    └── docs-generate.prompt.md

.claude/
├── commands/                               ← if Claude selected
│   ├── docs-init.md
│   └── docs-generate.md
└── rules/                                  ← if Claude selected
    └── livedocs.md                         ← always-on rule (auto-loaded)
```

**Always-on instructions.** The Claude rule in `.claude/rules/livedocs.md` and the managed region inside `.github/copilot-instructions.md` are read by the respective AI on every prompt. They tell the assistant to keep docs in sync with code whenever it edits source files, using `docs/AUTHORING.md` as the source of truth.

**No CLAUDE.md collision.** Claude Code auto-loads every file under `.claude/rules/`, so livedocs never touches your own `CLAUDE.md`.

---

## Language support

livedocs detects the primary language(s) of your repository by probing for common project files:

| Language | Probe files |
| --- | --- |
| C# / .NET | `*.csproj`, `*.sln` |
| TypeScript | `package.json` + `tsconfig.json` |
| JavaScript | `package.json` alone |
| Python | `pyproject.toml`, `requirements.txt` |
| Rust | `Cargo.toml` |
| Go | `go.mod` |
| Java / Kotlin | `pom.xml`, `build.gradle` |
| Ruby | `Gemfile` |
| PHP | `composer.json` |
| Swift | `Package.swift` |

Multi-language repositories (e.g. C# backend + TypeScript frontend) are handled by documenting each tree under its own top-level folder in `docs/`.

---

## Style rules

Full rules in `AUTHORING.md` (copied to `docs/AUTHORING.md` by `/docs-init`). The essentials:

- Docs are for **humans**, not for AI. Readable prose, not type dumps.
- **Full enumerations** — never "X, Y, etc.".
- **Operational section headings** ("Startup sequence", "Error handling"), not structural ones ("Public API", "Dependencies").
- **ASCII diagrams**, not Mermaid.
- **No** `Further reading`, `History`, `TODO`, or boilerplate sections.
- **Shared enums and codes** live in `docs/Reference/`, not duplicated across component docs.

---

## Updating

Re-run the installer. It hashes every file against the manifest and refreshes only what's outdated:

```bash
npx @lololomick/livedocs@latest
```

Managed files you haven't touched are refreshed silently. Files you've edited trigger an interactive prompt: *overwrite all / keep all / review each / abort*. The managed region inside `.github/copilot-instructions.md` is refreshed in place — your own instructions around the block are untouched.

Force-overwrite everything including user-modified files:

```bash
npx @lololomick/livedocs@latest --force
```

Preview changes without touching anything:

```bash
npx @lololomick/livedocs@latest --dry-run
```

Existing files inside `docs/` are **never** touched by the installer — they're only written by `/docs-init`, and only if they don't already exist. To pull updated templates into an already-scaffolded `docs/` folder, delete the old file and re-run `/docs-init`.

---

## Uninstalling

```bash
npx @lololomick/livedocs@latest uninstall
```

The uninstaller reads the manifest and only removes files whose hash still matches what it wrote. Anything you've edited is kept. Shown as a plan before confirmation.

**Never removed** (you decide what to do with them):

- `CLAUDE.md` — not written by the installer in the first place.
- `docs/` — your repo's documentation.
- Any managed file you've edited since install — surfaced in the summary so you can delete them by hand.

Flags:

```bash
npx @lololomick/livedocs@latest uninstall --yes      # skip confirmation (CI scripts)
npx @lololomick/livedocs@latest uninstall --force    # remove user-modified files too
npx @lololomick/livedocs@latest uninstall --dry-run  # preview without removing
```

---

## Troubleshooting

<details>
<summary><strong><code>/docs-init</code> says it cannot find the templates.</strong></summary>

The `.github/livedocs/` folder is missing. Run `npx @lololomick/livedocs@latest` at the repo root.
</details>

<details>
<summary><strong>The CI step fails with authentication errors.</strong></summary>

Check that `COPILOT_PAT` is set in your CI secrets and has `repo` scope. The CI snippet passes it to the Copilot CLI via the `COPILOT_GITHUB_TOKEN` environment variable.
</details>

<details>
<summary><strong>The AI is re-documenting components already marked <code>done</code>.</strong></summary>

It's ignoring the progress file. This shouldn't happen with the bundled commands — make sure you're using `/docs-generate` from this plugin and not a free-form prompt.
</details>

<details>
<summary><strong>I want to re-generate a specific doc from scratch.</strong></summary>

Delete its entry from `docs/.docs-progress.json` (or set its status to `pending`) and delete the doc file. The next `/docs-generate` will regenerate it.
</details>

<details>
<summary><strong>Copilot in VS Code does not see <code>/docs-init</code> or <code>/docs-generate</code>.</strong></summary>

Make sure you ran `npx @lololomick/livedocs@latest` (or `--copilot`) and that `.github/prompts/` was created. Reload VS Code — Copilot discovers prompt files on startup.
</details>

<details>
<summary><strong>npm error "No matching version found".</strong></summary>

Try `npm cache clean --force` then re-run. This clears the local npm cache, which can fail to recognize newly published versions.
</details>

---

## Repository layout

```
livedocs/
├── README.md
├── package.json
├── bin/
│   └── install.js                          ← the npx entry point
└── assets/
    ├── shared/                             ← templates deployed to .github/livedocs/
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
    │       └── livedocs.md                 ← deployed to .claude/rules/
    └── copilot/
        ├── copilot-instructions.md         ← deployed (as managed region)
        └── prompts/                        ← deployed to .github/prompts/
            ├── docs-init.prompt.md
            └── docs-generate.prompt.md
```

`assets/shared/` is the source of truth for the authoring guide and all scaffolded content. Update files there, publish a new version, and users pick them up on the next `npx @lololomick/livedocs@latest`.

---

## Star history

<a href="https://www.star-history.com/#lololomick/livedocs&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=lololomick/livedocs&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=lololomick/livedocs&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=lololomick/livedocs&type=Date" />
 </picture>
</a>