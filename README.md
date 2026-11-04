# NovelTracker

PERN-stack web application for tracking novels, built spec-driven.

## What this is

NovelTracker records novels. A user adds a novel entry with the following fields:

**Required:**

- Author
- Polish title
- Original title
- Year of publishing (4-digit year)
- Genre (one or more, from a predefined dropdown)

**Optional:**

- Picture (uploaded from local file system; JPEG/PNG/WebP/GIF, max 5 MB;
  a default book icon is used when absent)
- Description ("no description yet" when empty)
- Favourite flag

**Current scope:** only **creating a novel** is specified. Authentication
(login/logout), viewing/listing/filtering, editing, and deleting are **deferred**
— they will be added as separate features later. Everything below is the
process for that one feature.

## Technology Stack

| Component            | Technology                                     |
| -------------------- | ---------------------------------------------- |
| **Database**         | PostgreSQL                                     |
| **Backend**          | Express.js (Node.js)                           |
| **Frontend**         | React                                          |
| **Containerization** | Docker                                         |
| **CI/CD**            | Jenkins (triggered by pushes to external repo) |
| **E2E Testing**      | Playwright                                     |
| **API Testing**      | Postman/Newman                                 |

## Repository layout

```text
NovelTracker/
├── AGENTS.md        durable agent instructions (auto-loaded every session)
├── STATUS.md        live status: current stage + next action (resume here)
├── README.md        this file — human documentation + history
├── .kilo/           AI config: agents, commands, rules, permissions
├── spec/            the specifications (what the product must do)
│   ├── domains/<domain>/    requirements.md, data-model.md
│   └── features/<domain>/   *.feature, *.review.md, *.design.md
├── tools/notify/    per-stage email reports (Gmail SMTP)
├── app/             the runnable product
│   ├── server/      Express API (src/, migrations/)
│   ├── client/      React UI (Vite)
│   ├── tests/       Playwright (e2e/) + Postman/Newman (api/)
│   ├── docker/      Dockerfiles + docker-compose
│   └── jenkins/     Jenkinsfile pipeline

```

Two layers: **process at the root** (`.kilo/`, `spec/`, `AGENTS.md`, `STATUS.md`,
`README.md`) and **product under `app/`** (all code and infrastructure).

- **`.kilo/`** holds all AI config (agents, commands, rules, permissions) and
  must stay at the root — Kilo discovers it (and `AGENTS.md`) by walking up from
  the working directory.
- **`spec/`** has two parts:
  - `domains/<domain>/` — `requirements.md`, the numbered rules of record
    (`REQ-001`…, each written as one "When …, the system must …" EARS sentence),
    plus the shared `data-model.md`.
  - `features/<domain>/` — the frozen `*.feature` scenarios, each with its
    `*.review.md` verdict and `*.design.md` design.
- **`app/`** is an npm workspace with `server`, `client`, `tests`, `docker`, and
  `jenkins`; all application code and infrastructure live here.

## How to run locally

The repo is an npm **workspace** (monorepo): a single root `npm install`
installs `app/server`, `app/client`, and `app/tests` together (one shared
`node_modules/` and lockfile), and the commands below are root shortcuts into
those packages (`npm --workspace <path> run <script>`).

From the repository root: `npm install` → `cp .env.example .env` →
`npm run migrate` → `npm run dev:server` (:3000) + `npm run dev:client` (:5173);
`npm run test:api` (Newman) and `npm run test:e2e` (Playwright);
`docker compose -f app/docker/docker-compose.yml up --build`.

## Project status

The current stage, the exact next action, and the pipeline stage table live in
**`STATUS.md`** — the single source of truth, pointed to from the auto-loaded
`AGENTS.md`. Durable conventions live in `AGENTS.md`. This README is for humans:
what the project is, how to run it, how the pipeline works, and the history log.

## How the pipeline works (short version)

One feature at a time, one stage at a time, in a fixed order:

**analyse → critique → design → test → implement** (then, when built, review → document).

Each stage is run by its own agent through a slash command; each stage reads the
previous stage's output and produces the next:

| Stage     | Command                              | Agent              | Produces                                     |
| --------- | ------------------------------------ | ------------------ | -------------------------------------------- |
| analyse   | `/spec-analyse <description>`         | `spec-analyst`     | the numbered rules + the Gherkin scenarios   |
| critique  | `/spec-critique <domain>/<feature>`  | `spec-critic`      | a review file + verdict (gates design)       |
| design    | `/spec-design <domain>/<feature>`    | `spec-designer`   | the technical design + the shared data model |
| test      | `/spec-test <domain>/<feature>`      | `spec-test-author` | the tests (red)                              |
| implement | `/spec-implement <domain>/<feature>` | `spec-implementer` | the working code (green)                     |

Rules of the flow: specs are **frozen after analyse** (only the analyst changes
them, in `--revise` mode); no agent edits another stage's files; design only
proceeds on an `Approved for design` review; and **you control the pace** (one
stage, review, then the next). The automatic driver (`/spec-flow`) is
**suspended** as of 2026-10-27, so for now everything is manual.

> **Detailed walkthrough:** the full, example-based explanation of the flow (using
> the _create a novel_ feature) lives in `FLOW.md` — written for you only; no
> agent reads it. The agent roster and rules live in `AGENTS.md`; the real
> artifacts are under `spec/`.

---

## Progress log

> **Decisions log, not a changelog.** Only decisions, reversals, and conventions
> worth remembering — the _why_. Routine file changes are covered by git.

- 2026-10-09 — Project started with a spec-driven-development model. Chose to
  keep all Kilo config inside `.kilo/` as real files (not symlinks).
- 2026-10-12 — First spec gathered (auth) as Gherkin `.feature`; the analyst
  records its judgment calls in an assumptions block, and a `.feature` is
  **frozen** once reviewed (later edits only via the analyst in `--revise`).
- 2026-10-19 — Continuity validated: a fresh subagent with zero memory could
  reconstruct the project from files alone, so **durable files, not chat, are the
  source of truth**.
- 2026-10-22 — Stack changed MERN → **PERN** (PostgreSQL, not MongoDB); added
  Docker, Jenkins (CI on push to an external repo), Playwright (UI) and
  Postman/Newman (API); novel fields redefined.
- 2026-10-23 — Novel fields finalized: required (author, Polish + original title,
  4-digit year, one-or-more genre from a dropdown), optional (picture with a
  default icon, description with a placeholder). Emails are case-insensitive.
- 2026-10-23 — Adopted the layered spec model: `requirements.md` = numbered EARS
  **rules of record**; `.feature` = examples tracing to them via
  `@req:<domain>#REQ-nnn`; `ui/*.ui.md` = visual notes only, never the
  behavioural source of truth. Broad features were split into narrower
  per-feature files (auth → register + login-logout; novels CRUD →
  create/view/edit/delete).
- 2026-10-23 — Resolved all open spec questions: case-insensitive emails;
  author-surname filter = case-insensitive substring; genre from a predefined
  dropdown; picture JPEG/PNG/WebP/GIF ≤ 5 MB; valid year 1000–9999.
- 2026-10-23 — Removed the separate details view (the list shows all fields;
  description = ~10-word preview + "See more" pop-up). Isolation is **per entry,
  not per book**: the same book may exist in several users' collections.
- 2026-10-23 — Adopted a multi-agent pipeline (one agent per stage) instead of
  a single do-everything implementer.
- 2026-10-23 — Favourite-at-creation allowed: the create-novel critique blocker
  was resolved by adding the backing rule, not by disallowing the behaviour.
- 2026-10-23 — Design decisions: auth = `users` + `sessions` with hashed
  passwords and an httpOnly session cookie; novels = `novels` + a `novel_genres`
  join table (chosen over a Postgres array) with per-entry ownership scoping.
- 2026-10-23 — Scaffold chosen in **plain JavaScript (Node ESM)** with **raw SQL
  migrations via node-postgres (no ORM)**; the app is an npm workspace.
- 2026-10-23 — Continuity: one status snapshot is kept so any session can resume.
  It first lived in a root `STATUS.md`, then moved and was finally folded into
  `AGENTS.md`'s "Current status" (see 2026-10-26) — one state source, no drift.
- 2026-10-23 — Repo reorganized into **product under `app/`** vs **process at the
  root** (`.kilo/`, `spec/`, docs). `.kilo/` and `AGENTS.md` must stay at the root
  — Kilo discovers them by walking up from the working directory.
- 2026-10-26 — Consolidated to a single `.gitignore` (no nested
  `.kilo/.gitignore`).
- 2026-10-26 — Docs split by audience: `AGENTS.md` = agent-facing (auto-loaded;
  holds "Current status" + flow rules); `README.md` = human-facing (what it is,
  how to run it, the pipeline walkthrough, this log). Status moved into
  `AGENTS.md` so agents cannot miss it.
- 2026-10-26 — Agent names carry no numeric prefixes; pipeline order is implied.
- 2026-10-26 — Dropped "Acceptance criteria" from requirements — it duplicated the
  scenarios. A requirement is now one EARS rule + "Why it matters"; concrete
  cases live only in `.feature`, and non-observable constraints belong in the
  design/data model.
- 2026-10-26 — Renamed the assumption tag `[DERIVED]` → `[INFERRED]` (plainer,
  same meaning). The tag vocabulary is a convention in the agent prompts, not
  enforced in code.
- 2026-10-27 — The automatic driver (orchestrator + `/spec-flow`) is now
  registered and available, but **opt-in** — we still default to manual,
  step-by-step control. Stages 6–7 (review, document) are not created, so the
  chain stops after implement.
- 2026-10-27 — Progress log redefined as a **decisions log** (this entry): record
  the _why_; git covers the _what_.
- 2026-10-27 — Added `APP_GUIDE.md` (repo root): a plain-language, owner-facing
  map of the running application — what each file under `app/` (server, client,
  tests, docker, jenkins) is and does, how a request flows, the port wiring, and
  the design choices in plain terms. Human-only; not read by the agents and not
  part of the spec workflow (a documented convention: agent-facing material stays
  in `AGENTS.md`).
- 2026-10-27 — Walkthrough rewritten to use **create a novel** as the leading
  example instead of the fictional `quotes` feature, and to name every file each
  stage creates (requirements, `.feature`, `.review.md`, `.design.md`, data model,
  the test files, the migration, the server routes/middleware, and the client
  page/form/controls). The example outputs are drawn from the real create-novel
  artifacts, so the walkthrough doubles as a pointer to the actual specs.
- 2026-10-27 — **Scope narrowed to one feature: creating a novel.** Deleted the
  whole `auth` domain (register, login-logout) and the `view-novels`,
  `edit-novel`, `delete-novel` features — their `.feature`, `.review.md`,
  `.design.md`, requirements, data model, UI note, and tests — because
  authentication (login/logout) and per-user ownership, viewing/filtering,
  editing, and deleting are deferred and will be re-added as new features later.
  - `create-novel` was **re-scoped to need no login**: removed the signed-in
    background, the "anonymous cannot add" scenario (REQ-012), and the
    `requireAuth`/session/`RequireAuth` parts of its design; success assertions
    changed from list-rendering to stored state (the collection view does not
    exist yet). It is now 20 scenarios.
  - `spec/domains/novels/requirements.md` trimmed to the create-side rules
    (REQ-001…REQ-011, REQ-037…REQ-039); removed ids are kept as stable, unused
    gaps and listed. `data-model.md` dropped the auth contract, `user_id`, the
    list/filter indexes, and the view/edit/delete parts. The UI note now covers
    creation only.
  - Docs updated (`AGENTS.md` status/specs, `README.md` "What this is" +
    walkthrough, tests `package.json`). Removed the auth tests/collections.
- 2026-10-27 — Docs: trimmed the README workflow walkthrough to a short
  "How the pipeline works" summary (stage/command/agent table + the flow rules)
  and moved the detailed, example-based version into a new **owner-only**
  `FLOW.md` (create-a-novel example: how agents are triggered, what each stage
  does and why, the gates/loops, the design-doc anatomy, and `/spec-flow`).
  `FLOW.md` is for the owner only — no agent reads it and the workflow does not
  depend on it.
- 2026-10-27 — Workflow improvements: (1) PAM reference demoted to provenance
  only — agents no longer primed with enterprise patterns that don't apply to
  NovelTracker's simple PERN stack; (2) state tracking consolidated — one
  `.status.md` per feature instead of multiple scattered files; (3) fixture
  generation added to spec-test-author responsibilities; (4) orchestrator
  improved to handle missing review/document stages gracefully; (5) permission
  delegation model clarified; (6) continuity simplified — stage agents print
  `[STATUS]`, orchestrator updates AGENTS.md once; (7) stack conventions made
  explicit in AGENTS.md. All improvements documented in updated FLOW.md.
- 2026-10-27 — **Automatic driver suspended.** The `spec-orchestrator` agent and
  the `/spec-flow` command are parked in `.kilo/suspended-agents/` (reusing the
  original suspension convention), so Kilo no longer discovers them and the
  pipeline is **manual, one stage at a time**, for now. Reversible: move the two
  files back to `.kilo/agent/` and `.kilo/command/`. Docs updated (`AGENTS.md`,
  `.kilo/rules/core.md`, `FLOW.md`, `README.md`) to stop advertising `/spec-flow`.
- 2026-10-28 — **One model pinned across the pipeline.** Every stage agent
  (`spec-analyst`, `spec-critic`, `spec-designer`, `spec-test-author`,
  `spec-implementer`) and the suspended `spec-orchestrator` now declares
  `model: kilo/deepseek/deepseek-v4.1-flash` (provider `kilo`). Previously only
  the analyst was pinned (to GLM 5.3) while the rest inherited the dialog model,
  so runs could mix models; now the chain is deterministic regardless of the
  model selected in the Kilo dialog.
- 2026-10-28 — **Project settings centralised in `.kilo/kilo.json`.** The model
  and per-agent step budgets moved out of the agent `.md` frontmatter into the
  root config: a top-level `model` sets the default for every agent, and an
  `agent` block sets each stage's `steps` (analyst/critic 30, designer 40,
  test-author 60, implementer 80, orchestrator 100). The `.md` files now carry
  only description/mode/permission/prompt, so model/step changes are made in one
  file. Kilo merges config agent settings with the markdown agent by name.
- 2026-10-29 — **Status split out of `AGENTS.md` into `STATUS.md`.** `AGENTS.md`
  stays the durable, low-churn instruction file (auto-loaded every session) and
  now only points to `STATUS.md`; the mutable state (pipeline table, scope, next
  action, prerequisites) lives in the root `STATUS.md`. Reason: keep the
  auto-loaded file stable and follow the common convention of separating durable
  instructions from live state. References updated in `.kilo/rules/core.md`,
  `FLOW.md`, `.kilo/suspended-agents/spec-orchestrator.md`, and this README.
- 2026-10-29 — **Stage agents update `STATUS.md` automatically.** Each stage agent
  (`spec-analyst`, `spec-critic`, `spec-designer`, `spec-test-author`,
  `spec-implementer`) now has edit permission on `STATUS.md` and a handoff step:
  after writing its outputs it ticks its column and sets `## Next action` to the
  next command (or the blocker), before printing `[STATUS]`. Previously only the
  user/orchestrator wrote status, so manual runs left `STATUS.md` stale. `README.md`
  stays controller-owned. `.kilo/rules/core.md`, `AGENTS.md`, and `FLOW.md` updated.
- 2026-10-29 — **Removed UI notes.** Deleted `spec/domains/novels/ui/` (the
  `.ui.md` low-fidelity UI notes) and dropped that layer from the spec model.
  Specs are now two layers — domain `requirements.md` (rules) and feature
  `.feature` (examples) — plus `data-model.md` and the designer's `.design.md`.
  References cleaned from `.kilo/rules/core.md`, the `spec-critic`/`spec-designer`
  prompts, the `spec-critique`/`spec-design` commands, `AGENTS.md`, `FLOW.md`, and
  the spec docs (`data-model.md`, `create-novel.review.md`, `create-novel.design.md`).
- 2026-10-30 — **Per-stage email reports (Option A).** Added a self-contained
  `tools/notify/` feature (nodemailer over Gmail SMTP) that each stage agent calls
  after updating `STATUS.md`: it emails the agent, result, summary, files
  added/changed/deleted, and the next step. Config via `GMAIL_USER`,
  `GMAIL_APP_PASSWORD`, `MAIL_TO` in `.env`. Approval-gated actions (`npm install`,
  migrations, destructive git) are never run by an agent — it stops and emails
  `needs-approval` for the user to decide. No orchestrator; the user runs the next
  `/spec-*` command. Wired into `.kilo/rules/core.md`, the five agent prompts,
  `AGENTS.md`, `FLOW.md`, `.kilo/kilo.json`, `.env.example`, and the root workspace.
