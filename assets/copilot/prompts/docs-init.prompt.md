---
mode: agent
description: Scaffold the docs/ directory, authoring guide, template, changelog, and CI pipeline integration for automated documentation. Run once per repository.
---

# /docs-init

Set up automated documentation for this repository. This is a one-time initialization.

## Step 1 — Detect existing state

Check the user's repository for:

- `docs/` directory
- `docs/AUTHORING.md`
- `docs/TEMPLATE.md`
- `docs/CHANGELOG.md`
- `docs/Reference/` directory

Detect the CI platform:

- `azure-pipelines.yml` → Azure Pipelines
- `.github/workflows/*.yml` → GitHub Actions
- `.gitlab-ci.yml` → GitLab CI (manual adaptation required)
- none → skip CI integration

Detect primary language(s) of the repository by probing for:
`*.sln` / `*.csproj` (C#), `package.json` + `tsconfig.json` (TypeScript), `package.json` alone (JavaScript), `pyproject.toml` / `requirements.txt` (Python), `Cargo.toml` (Rust), `go.mod` (Go), `pom.xml` / `build.gradle` (Java / Kotlin), `Gemfile` (Ruby), `composer.json` (PHP), `Package.swift` (Swift).

## Step 2 — Scaffold missing files

The bundled templates are located at `.github/livedocs/` in this repository (placed there by the `npx @lololomick/livedocs` installer).

For each missing file, copy the corresponding template into the user's `docs/` directory:

| Source | Destination |
| --- | --- |
| `.github/livedocs/AUTHORING.md` | `docs/AUTHORING.md` |
| `.github/livedocs/TEMPLATE.md` | `docs/TEMPLATE.md` |
| `.github/livedocs/CHANGELOG.md` | `docs/CHANGELOG.md` |

Also create the empty directory `docs/Reference/`.

If `.github/livedocs/` does not exist, tell the user to run `npx @lololomick/livedocs` at the repo root first. Then stop.

Never overwrite an existing file. Skip any that already exist.

## Step 3 — Integrate with CI

### Azure Pipelines

1. Open `azure-pipelines.yml`.
2. Check for an existing step whose `displayName` contains `Auto-update documentation`. If present, skip.
3. If absent, append the content of `.github/livedocs/pipeline-snippet.azure-pipelines.yml` to the `steps:` section, before any artifact-publishing steps.
4. Do not touch unrelated steps.

### GitHub Actions

1. Check whether `.github/workflows/auto-docs.yml` exists. If so, skip.
2. If not, copy `.github/livedocs/pipeline-snippet.github-actions.yml` to `.github/workflows/auto-docs.yml`.

### GitLab CI

Do not modify `.gitlab-ci.yml` automatically. Point the user at the snippet files so they can adapt them manually.

### No CI detected

Skip. Tell the user they can add the snippet manually when they set up CI.

## Step 4 — Final report

Print this exact summary when done:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Documentation scaffolding complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Created / verified:
  ✓ docs/AUTHORING.md
  ✓ docs/TEMPLATE.md
  ✓ docs/CHANGELOG.md
  ✓ docs/Reference/
  ✓ {CI file path}   (or "skipped — no CI detected")

Detected language(s): {list}

▶ NEXT: configure the CI secret

  The auto-documentation pipeline calls the Copilot CLI, which needs a
  GitHub Personal Access Token. Set this ONCE in your CI platform:

  • Azure Pipelines:
      Add a pipeline variable named COPILOT_PAT (type: secret).
      Value: a GitHub PAT with 'repo' scope.

  • GitHub Actions:
      Settings → Secrets and variables → Actions → New repository secret.
      Name: COPILOT_PAT
      Value: a GitHub PAT with 'repo' scope.

  Without this secret set, the auto-doc step in CI will fail silently.

▶ NEXT: bootstrap the docs for existing code

  Run /docs-generate to document your existing codebase. Progress is saved
  to docs/.docs-progress.json, so large repos can be bootstrapped across
  multiple sessions safely.
```

## Rules

- Never overwrite an existing file.
- Keep CI edits minimal and reversible. If editing a complex existing pipeline is risky, print the snippet and ask the user to paste it manually.
- Do not create `docs/.docs-progress.json` here — that is `/docs-generate`'s job.
- Do not commit changes. The user commits.
