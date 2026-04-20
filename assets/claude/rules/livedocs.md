# Documentation discipline (livedocs)

This repository uses `livedocs` for living documentation under `docs/`. Every code change should ship with the corresponding doc update — do not leave that to the CI pipeline if you can do it while you have full context.

## When you edit source code

1. Read `docs/AUTHORING.md`. It is the authoring guide. Every rule below is subordinate to that file.
2. Identify the affected component(s). A "component" is whatever maps to a single doc under `docs/` — see `docs/AUTHORING.md` section 4.2 for the grouping rules.
3. For each affected component:
   - If its doc exists in `docs/`: update **only** the sections describing the behavior you changed. Do not rewrite unchanged prose. Do not reorder or restyle.
   - If its doc does not exist yet: skip it. Bootstrapping is `/docs-generate`'s job, not per-commit work.
   - If you changed enum values, error codes, state values, or shared constants: also update the matching reference doc in `docs/Reference/` and every inline mention in other docs.
4. Commit code and doc changes together — same commit (or at minimum same PR).

## What not to do

- Do not invent content the source does not support.
- Do not add `Further reading`, `See also`, `History`, `Migration notes`, `TODO`, or similar sections — forbidden by `docs/AUTHORING.md`.
- Do not use emojis in docs.
- Do not use Mermaid diagrams — ASCII diagrams only.
- Do not document trivial files (DI registration, `Program.cs`, `main`, bootstrap `index.ts`, generated code, tests).

## Relationship to the auto-docs CI step

If CI is configured, the auto-docs pipeline runs on every push. It will:
- Verify that your doc changes cover your code changes.
- Fill in any gaps you missed.
- Leave docs you already updated correctly untouched.

Your goal is to make that CI step a no-op by getting docs right locally.

## Scope of these instructions

These rules apply to source-code changes when `docs/` exists. If `docs/` is not set up, run `/docs-init` first (or skip entirely if documentation is not yet scoped for this repo).
