---
description: Bootstrap or resume documentation for the existing codebase. Processes components in parallel, respects a session cap, and can be re-run across multiple chats to cover a large project.
---

# /docs-generate

You are generating developer documentation for this repository's existing code. Your job is to follow `docs/AUTHORING.md` exactly and to **manage your own progress across sessions** so large repos can be bootstrapped safely over multiple runs.

## Step 1 — Preconditions

1. Verify that `docs/AUTHORING.md` and `docs/TEMPLATE.md` exist in the user's repo. If either is missing, STOP and tell the user to run `/docs-init` first. Do not proceed.
2. Read `docs/AUTHORING.md` fully. Internalize it. Every rule in this command is subordinate to that file — when in doubt, do what AUTHORING.md says.
3. Read `docs/TEMPLATE.md`. Use it as the structural template for every new doc.

## Step 2 — Load or create the progress file

The progress file is `docs/.docs-progress.json`. Its format is defined in `AUTHORING.md` section 9.1.

### If the file exists

Read it. You will resume from it.

### If the file does NOT exist

You are starting a fresh bootstrap:

1. Detect primary language(s) per `AUTHORING.md` section 3.
2. Enumerate all components in the repository per `AUTHORING.md` section 4.2. This is the single most important step — get the grouping right before writing anything.
   - Walk the source tree layer by layer.
   - Group files into components: one large file → one component; one interface + implementation → one component; a folder of small related files → one component.
   - Skip trivial files (DI registration, `Program.cs`, `main`, `index.ts` bootstraps, generated code, tests).
   - Identify which enum / constant / code files belong in a shared reference doc under `docs/Reference/`.
3. Create `docs/.docs-progress.json` with `sessionCap: 5` and one entry per planned component, all set to `status: pending`. Reference docs are entries too.
4. Write the file before proceeding.

Suggested order of documentation:

1. Reference docs (shared enums / codes / constants).
2. Lowest-level infrastructure (threading, logging, data access).
3. Services / orchestration.
4. Domain / business logic.
5. UI / presentation layers, if any.

Reorder within the progress file so the earlier-needed docs come first.

## Step 3 — Pick the next batch

1. Read `docs/.docs-progress.json`.
2. Pick the next `sessionCap` components with `status: pending`, in order. If fewer remain, pick them all.
3. If nothing is `pending` and no items are `in_progress`: everything is already documented. Print a brief success message and stop.

## Step 4 — Process the batch in parallel

For each component in the batch:

1. Update its entry in `docs/.docs-progress.json` to `status: in_progress` and write the file.
2. Spawn a **subagent** via the `Task` tool (`subagent_type: general-purpose`) with a self-contained prompt. Run all subagents for the batch **in parallel** — send one message containing one `Task` tool call per component.

Each subagent's prompt must include:

- The path(s) of the source file(s) the subagent is documenting.
- The target output path (e.g. `docs/Domain/TransportController.md`).
- The absolute rule: *Read `docs/AUTHORING.md` and `docs/TEMPLATE.md` first and follow them exactly.*
- A reminder to respect section 5 (document structure) and section 11 (quality bar) of AUTHORING.md.
- An instruction to write the final doc directly to the target path and return a one-sentence confirmation.

Example subagent prompt:

```
Document the component "{Component name}" at {target doc path}.

Source files:
- {path/to/file1}
- {path/to/file2}

Before writing:
1. Read docs/AUTHORING.md end-to-end. Follow every rule.
2. Read docs/TEMPLATE.md. Use it as your structural template.
3. If any enum values, error codes, or shared constants are referenced by this component, check docs/Reference/ to see whether they already live there; if not, leave a note in your return summary so the orchestrator can create a reference doc.

Produce the doc at {target doc path}. Return a short summary of what you wrote.
```

After each subagent returns:

1. Verify the output file exists.
2. Update that component's entry in `docs/.docs-progress.json` to `status: done` with `completedAt` timestamp. Write the file.

If a subagent fails to produce a valid doc, leave the entry as `in_progress` so it can be retried, and include a note in the final report.

## Step 5 — Respect the session cap — stop cleanly

After the batch is processed, check the progress file.

### If pending components remain

1. Do **not** pick another batch. You are done for this session.
2. Print the stopping message EXACTLY in this format:

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

Replace `{N}`, `{M}`, and paths with real values. Do not paraphrase the message — the user relies on this exact shape to know the command is resumable.

### If no components remain

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Documentation complete — all components documented
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: {N} components documented across {M} sessions.

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

If at any point during a session you notice your context is becoming heavy (many large file reads accumulated, tool results are consistently large, you have been running for a long time), finish the component currently in progress, update the progress file, and execute the Step 5 stopping protocol **before** starting the next component. Never start a component you cannot finish in the current session.

## Rules

- Always follow `docs/AUTHORING.md`. This command never overrides it.
- Always update `docs/.docs-progress.json` after each component completes. Never batch updates.
- Never create a doc outside the paths listed in the progress file without adding it to the progress file first.
- Never skip a component silently. If one cannot be documented, record the reason in its progress entry and continue.
- Do not commit changes. The user commits when they are ready.
- The orchestrator (this command) does NOT read component source files itself. Only subagents do. This keeps the orchestrator's context free for coordination.
