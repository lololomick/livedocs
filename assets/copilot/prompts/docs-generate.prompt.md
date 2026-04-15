---
mode: agent
description: Bootstrap or resume documentation for the existing codebase. Respects a session cap and can be re-run across multiple chats to cover a large project.
---

# /docs-generate

Generate developer documentation for this repository's existing code. Follow `docs/AUTHORING.md` exactly and manage progress across sessions using `docs/.docs-progress.json`.

## Step 1 — Preconditions

1. Verify `docs/AUTHORING.md` and `docs/TEMPLATE.md` exist. If either is missing, STOP and tell the user to run `/docs-init` first.
2. Read `docs/AUTHORING.md` fully. Internalize it. Every rule in this prompt is subordinate to that file.
3. Read `docs/TEMPLATE.md` and use it as the structural template for every new doc.

## Step 2 — Load or create the progress file

Progress file: `docs/.docs-progress.json`. Format defined in AUTHORING.md section 9.1.

### If the file exists

Read it. You will resume from it.

### If the file does NOT exist

Start a fresh bootstrap:

1. Detect primary language(s) per AUTHORING.md section 3.
2. Enumerate all components in the repository per AUTHORING.md section 4.2. Do this carefully — the grouping decision is the single most important part of bootstrapping.
   - Walk the source tree layer by layer.
   - Group files: one large file = one component; interface + implementation = one component; folder of small related files = one component.
   - Skip trivial files (DI registration, `Program.cs`, `main`, `index.ts` bootstraps, generated code, tests).
   - Identify which enums / constants / codes belong in `docs/Reference/`.
3. Create `docs/.docs-progress.json` with `sessionCap: 5` and one entry per planned component, all `status: pending`.
4. Reorder the entries so reference docs come first, then low-level infrastructure, then services, then domain, then UI.
5. Write the file before proceeding.

## Step 3 — Pick the next batch

1. Read `docs/.docs-progress.json`.
2. Take the next `sessionCap` components with `status: pending`. Take fewer if fewer remain.
3. If nothing is pending and nothing is in progress: everything is documented. Print a success message and stop.

## Step 4 — Process the batch

For each component in the batch, in order:

1. Update the component's status in `docs/.docs-progress.json` to `in_progress`. Write the file.
2. Read the source file(s) of the component.
3. Write the doc at the target path, following AUTHORING.md and TEMPLATE.md exactly.
4. Verify the file was written.
5. Update the component's status to `done` with a `completedAt` timestamp. Write the file.

Do not batch the progress updates. Update after every component. If you are interrupted, nothing is lost.

If you cannot document a component (e.g. source file missing, unreadable): leave its status as `in_progress`, add a `note` field with the reason, and continue with the next component.

## Step 5 — Respect the session cap

After the batch is processed:

### If pending components remain

Print this EXACT message (do not paraphrase — the user relies on this shape):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠  DOCUMENTATION NOT COMPLETE — session cap reached
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Completed this session ({N} components):
  ✓ {path/to/doc1.md}
  ✓ {path/to/doc2.md}
  ...

Remaining: {M} components
Next up:
  → {path/to/next1.md}
  → {path/to/next2.md}
  → {path/to/next3.md}
  … and {M-3} more

▶ To continue, start a NEW chat and run /docs-generate again.
  Progress is saved in docs/.docs-progress.json — no work will be repeated.
```

Then stop. Do NOT start another batch.

### If no pending components remain

Print:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Documentation complete — all components documented
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: {N} components documented.

From this point on, docs will be kept up to date automatically by
the CI pipeline on every commit (see docs/AUTHORING.md section 8.1).

KEEP docs/.docs-progress.json — do NOT delete it. It records which
components are already documented and which were intentionally
skipped. When you add new components later, /docs-generate reads
this file and only processes what's new. Deleting it forces a fresh
re-enumeration that may re-decide what to skip differently and miss
the audit trail.
```

## Step 6 — Early stop for context pressure

If at any point during the session you notice your context is becoming heavy (many large file reads accumulated, consistently large tool results, or you have been running for a long time), finish the component currently in progress, update the progress file, and execute the Step 5 stopping protocol **before** starting the next component. Never start a component you cannot finish in the current session.

## Rules

- Always follow `docs/AUTHORING.md`. This prompt never overrides it.
- Always update `docs/.docs-progress.json` after each component completes. Never batch updates.
- Never create a doc outside the paths listed in the progress file without adding it to the progress file first.
- Never skip a component silently — record the reason in its progress entry.
- Do not commit changes. The user commits.
