---
description: Scaffold the docs/ directory, authoring guide, template, changelog, and CI pipeline integration for automated documentation. Run once per repository.
---

# /docs-init

You are setting up automated documentation for this repository. This is a ONE-TIME initialization — it scaffolds the files the documentation pipeline and future `/docs-generate` runs depend on.

The bundled templates live at `.github/livedocs/` in this repository (placed there by the `npx @lololomick/livedocs` installer). Use the Read tool to access them; use the Write tool to deploy them into `docs/`.

## Step 1 — Detect existing state

Check what already exists. Do NOT overwrite anything; skip files that are already present.

Check for:
- `docs/` directory
- `docs/AUTHORING.md`
- `docs/TEMPLATE.md`
- `docs/CHANGELOG.md`
- `docs/Reference/` directory

Detect the CI platform:
- `azure-pipelines.yml` or `.azure-pipelines/*.yml` → Azure Pipelines
- `.github/workflows/*.yml` → GitHub Actions
- `.gitlab-ci.yml` → GitLab CI (not automated; point the user at the snippet file)
- None → skip CI integration and inform the user

Detect primary language(s) of the repository (see `AUTHORING.md` section 3 for the detection table once scaffolded).

If `.github/livedocs/` does not exist, tell the user to run `npx @lololomick/livedocs` at the repo root first. Then stop.

## Step 2 — Scaffold missing files

For each missing file, read the bundled template and write it to the user's repo:

| Source | Destination |
| --- | --- |
| `.github/livedocs/AUTHORING.md` | `docs/AUTHORING.md` |
| `.github/livedocs/TEMPLATE.md` | `docs/TEMPLATE.md` |
| `.github/livedocs/CHANGELOG.md` | `docs/CHANGELOG.md` |

Also create the empty directory `docs/Reference/`.

## Step 3 — Integrate with CI

### If Azure Pipelines

1. Open the existing `azure-pipelines.yml`.
2. Check for an existing step whose `displayName` contains `Auto-update documentation`. If present, skip.
3. If absent, append the content of `.github/livedocs/pipeline-snippet.azure-pipelines.yml` to the existing `steps:` section, before any artifact-publishing steps.
4. Do not touch unrelated steps.
5. Tell the user you modified `azure-pipelines.yml` and suggest they review the diff.

### If GitHub Actions

1. Check whether `.github/workflows/auto-docs.yml` already exists. If so, skip.
2. If not, copy `.github/livedocs/pipeline-snippet.github-actions.yml` to `.github/workflows/auto-docs.yml`.
3. Tell the user a new workflow was created.

### If GitLab CI

Do not modify `.gitlab-ci.yml` automatically. Print the path of the snippet files so the user can adapt them.

### If no CI detected

Skip this step. Tell the user they can add the snippet manually when they set up CI.

## Step 4 — Final report

Print this exact summary:

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

Detected language(s): {list from Step 1}

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

  Run /docs-generate to document your existing codebase. Progress is
  saved to docs/.docs-progress.json, so large repos can be bootstrapped
  across multiple sessions safely.
```

## Rules

- Never overwrite a file that already exists.
- Never touch `CHANGELOG.md` if the user already has a similarly-named file (`CHANGES.md`, `HISTORY.md`). Ask instead.
- Do not create `docs/.docs-progress.json` here — that is `/docs-generate`'s responsibility.
- Keep CI edits minimal and reversible. If editing a complex existing pipeline is risky, print the snippet and ask the user to paste it manually.
- Do not commit changes. The user commits when they are ready.
