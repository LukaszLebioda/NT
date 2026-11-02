# AGENTS.md — NovelTracker

> Durable project instructions for AI agents: stack, specs, agent roster, and the
> rules of the flow. **Resuming work? Read [`STATUS.md`](STATUS.md) first** — it is
> the single source of truth for the current stage and the exact next action.

## Pending decisions / conventions

Defaults already chosen (tell the agent to change any before building): UUID ids;
JSON error envelope with `snake_case` codes (`validation_error`,
`picture_invalid_type`, `picture_too_large`); plain JavaScript (Node ESM); raw SQL
migrations via `node-postgres` (no ORM). **Project settings live in the root
config `.kilo/kilo.json`** — a top-level `model`
(`kilo/deepseek/deepseek-v4.1-flash`, the default model for every agent) and an
`agent` block giving each stage its `steps` budget. Agent `.md` files carry only
description/mode/permission/prompt; change model or step limits in the config.

## Where the details live

- Rules: `.kilo/rules/core.md` · agents: `.kilo/agent/` · commands: `.kilo/command/`
- Requirements (rules of record): `spec/domains/<domain>/requirements.md`
- Scenarios: `spec/features/<domain>/*.feature` · reviews: `*.review.md`
- Designs: `spec/features/<domain>/*.design.md` · data models: `spec/domains/<domain>/data-model.md`
- How to run locally: `README.md` · narrative history: `README.md` progress log
- Stage emails: `tools/notify/` (Gmail SMTP; every stage emails a report — see
  `.kilo/rules/core.md` § Stage notifications)

## Stack conventions

- **Language:** Plain JavaScript (Node ESM), not TypeScript
- **Backend:** Express.js with raw SQL migrations (node-postgres, no ORM)
- **Frontend:** React with Vite
- **Database:** PostgreSQL with manual migrations
- **Package manager:** npm workspaces (monorepo: server, client, tests)
- **Error format:** JSON envelope with `snake_case` codes

## Project overview

NovelTracker is a web application for tracking novels. A user records a novel
entry with these fields:

**Required:** Author · Polish title · Original title · year of publishing
(4-digit) · one or more genres (from a predefined dropdown).
**Optional:** picture (JPEG/PNG/WebP/GIF, max 5 MB; a default book icon is used
when absent) · description ("no description yet" when empty) · favourite flag
(shown with an asterisk).

**Current scope (narrowed 2026-10-27):** only **creating** a novel is specified.
Authentication (login/logout) and per-user ownership, viewing/listing/filtering,
editing, and deleting are **deferred** and will be added later.

## Infrastructure & Testing

- **Containerization**: Docker (application runs in containers)
- **CI/CD**: Jenkins (automated builds triggered by pushes to external repo)
- **Testing**: 
  - Playwright (end-to-end UI tests)
  - Postman/Newman (API tests)

## Application layout (scaffolded)
- **npm workspace (monorepo):** the root `package.json` declares the workspaces
  `app/server`, `app/client`, `app/tests`. One `npm install` at the root installs
  all three (shared `node_modules/` + one `package-lock.json`), and the root
  scripts are `npm --workspace <path> run <script>` shortcuts into each package —
  run everything from the repo root.
- The runnable product lives under `app/`; the process/spec layer stays at the
  repo root (`.kilo/`, `spec/`, docs) because Kilo discovers `.kilo/` and
  `AGENTS.md` by walking up from the working directory.
- `app/server/` — Express API; `src/index.js` (app), `src/db.js` (`pg` Pool),
  `src/migrate.js`; SQL migrations in `app/server/migrations/` (raw SQL, no ORM).
- `app/client/` — React via Vite; `src/App.jsx`.
- `app/tests/` — `e2e/` (Playwright), `api/` (Postman collection run by Newman).
- `app/docker/`, `app/jenkins/` — infrastructure.
- No product features implemented yet; `GET /health` is the only endpoint.
  Conventions the scaffold assumes (error envelope, folder structure) must be
  confirmed before an agent invents more.

## Specs

Specs have two layers, all written from the user's plain-language input:

- **Rules:** `spec/domains/<domain>/requirements.md` — canonical numbered
  requirements (`REQ-001`, …) in EARS form. Source of truth for business rules.
- **Examples:** `spec/features/<domain>/<feature-slug>.feature` — executable
  Gherkin scenarios, each tagged `@req:<domain>#REQ-nnn` to the rule it proves.

A `.feature` file is frozen once analysed; only the `spec-analyst` agent, in
revise mode, may edit it afterwards.

**Novels domain** (20 scenarios):
- `create-novel.feature` — create a novel (20 scenarios)

**Deferred (not yet specified):** authentication (login/logout) and per-user
ownership; viewing/listing/filtering; editing; deleting. Their previous specs and
requirements were removed on 2026-10-27 and will return as new features.

**Resolved decisions** (no open `@todo` remain):
- Genre is one or more values from a predefined dropdown. Current list:
  Fantasy, Science Fiction, Horror, Thriller, Mystery, Crime, Romance,
  Historical, Adventure, Literary, Drama, Poetry, Non-fiction, Biography,
  Other (revisable).
- Picture uploads: JPEG/PNG/WebP/GIF, max 5 MB.
- A novel can be marked as a favourite at creation.
- A valid 4-digit year is between 1000 and 9999.

## Agents

AI agents live in `.kilo/agent/`, ordered by pipeline stage. Order:
analyse → critique → design → test → implement → review → document.

1. `spec-analyst` — requirements + Gherkin (owns `requirements.md` and
   `.feature`, revise mode for changes).
2. `spec-critic` — reviews a feature's scenarios and their backing
   requirements; always writes `spec/features/<domain>/<feature-slug>.review.md`
   (Blocking issues, Warnings, Edge cases missed, Coverage gaps, Suggested
   scenarios; verdict `Approved for design` / `Changes required`); the review
   file gates design.
3. `spec-architect` — turns an `Approved for design` feature into
   `.design.md` (API contract, PostgreSQL data model, UI plan, test plan) and
   maintains `spec/domains/<domain>/data-model.md`.
4. `spec-test-author` — writes tests: Playwright (UI) under `app/tests/e2e/`,
   Newman/Postman (API) under `app/tests/api/`; red phase.
5. `spec-implementer` — scaffolds and writes `app/server/` (Express +
   PostgreSQL), `app/client/` (React), `app/docker/`, `app/jenkins/` until tests
   pass.

Stages 6 (review) and 7 (document) are not created yet.

Commands live in `.kilo/command/`: `spec-analyse`, `spec-critique`,
`spec-design`, `spec-test`, `spec-implement`. Each is a thin wrapper that runs
its agent with the argument you pass.

**Design docs:** `spec/features/<domain>/<feature-slug>.design.md`. **Shared
data model:** `spec/domains/<domain>/data-model.md` (novels:
`novels`/`novel_genres`). **Review files:**
`spec/features/<domain>/<feature-slug>.review.md`.

**Automatic driver (suspended):** the `spec-orchestrator` agent (`/spec-flow`)
is **suspended as of 2026-10-27** — parked in `.kilo/suspended-agents/` and not
registered. We run the pipeline **manually, one stage at a time** for now. Do not
recreate `/spec-flow` or the orchestrator unless the user asks; to reactivate,
move `.kilo/suspended-agents/spec-orchestrator.md` back to `.kilo/agent/` and
`.kilo/suspended-agents/spec-flow.md` back to `.kilo/command/`. Stages 6 (review)
and 7 (document) are not created yet, so the chain stops after implementation.

## Key rules of the flow

1. **Specs are frozen after analyse** — only the analyst (via `--revise`) may
   change a `.feature` file.
2. **Each stage reads the previous stage's outputs** — the chain is:
   `.feature` → `.review.md` → `.design.md` → tests → code.
3. **No agent edits another agent's domain:**
   - Analyst: owns `requirements.md` + `.feature`
   - Critic: only reads, writes `.review.md`
   - Architect: only reads specs, writes `.design.md` + `data-model.md`
   - Test-author: only writes `app/tests/`, never `app/server/` or `app/client/`
   - Implementer: only writes `app/`, never `spec/`
4. **The user controls the pace** — one stage at a time, review the output, then
   run the next.
5. **Continuity** — each stage agent ticks its column and sets the next action in
   `STATUS.md` before finishing; the user keeps the `README.md` log. Never leave
   status only in chat.

## Local tooling note

- Known Kilo 7.8.8 bug: the write-time config validator crashes ("No context
  found for instance") on Markdown config files — even the documented example.
  Harmless noise unless agents fail to register after a session restart.

Note: this file grows as the repository takes shape.
