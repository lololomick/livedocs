# Copilot instructions — documentation discipline (livedocs)

This repository uses `livedocs` for living documentation under `docs/`. Every code change should ship with the corresponding doc update — do not leave that to the CI pipeline if you can do it while you have full context.

## When you edit source code

1. Read `docs/AUTHORING.md`. It is the authoring guide. Every rule below is subordinate to that file.
2. Identify the affected component(s). A "component" is whatever maps to a single doc under `docs/` — see `docs/AUTHORING.md` section 4.2 for the grouping rules.
3. For each affected component:
   - If its doc exists in `docs/`: update **only** the sections describing the behavior you changed. Do not rewrite unchanged prose. Do not reorder or restyle.
   - If its doc does not exist yet: skip it. Bootstrapping is `/docs-generate`'s job, not per-commit work.
   - If you changed enum values, error codes, state values, or shared constants: also update the matching reference doc in `docs/Reference/` and every inline mention in other docs.
4. Commit code and doc changes together — same commit (or at minimum same PR).

## When you work on files under `docs/` directly

- Every component doc follows the template defined in `docs/TEMPLATE.md`.
- Folder structure under `docs/` mirrors the source layer structure.
- Shared enums, codes, and constants live in `docs/Reference/` — not duplicated across component docs.
- One doc per **component**, not per file. Large files get their own doc; small related files share one module-level doc.

## Style rules (summary — full rules in `docs/AUTHORING.md`)

- Plain technical prose. No marketing, no filler, no emojis, no sign-off. English.
- Operational section headings ("Startup sequence", "Error handling"), not structural ones ("Public API", "Dependencies").
- Full enumerations when listing states / codes / commands — never "X, Y, etc.".
- ASCII diagrams for architecture, not Mermaid.

## Forbidden sections

Never add any of these headings:

- `Further reading` / `See also` / `Related components`
- `History` / `Migration notes` / `Legacy lineage`
- `Public API` (as a table of signatures)
- `Dependencies` (as a table of injected types)
- `TODO` / `Known issues` / `Limitations`
- `License` / `Contributors`

## Progress tracking

When bootstrapping documentation for existing code via `/docs-generate`, honour `docs/.docs-progress.json`:

- Read it at the start of every session.
- Never re-document a component marked `done`.
- Update the file after every completed component, not at the end.
- Respect the `sessionCap` value. When reached, stop and tell the user to run the command again.

## Quality bar

Before finishing any doc, verify the checklist in `docs/AUTHORING.md` section 11. If any item fails, rewrite.

## Relationship to the auto-docs CI step

If CI is configured, the auto-docs pipeline runs on every push. It will verify that your doc changes cover your code changes, fill in any gaps you missed, and leave docs you already updated correctly untouched. Your goal is to make that CI step a no-op by getting docs right locally.
