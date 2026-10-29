# Always-on rules — NovelTracker

## Start of every session — check permissions

At the start of every conversation or when resuming work, read
`.kilo/kilo.json` to understand what permissions you have. Do not ask
permission for actions that are already set to "allow" in kilo.json.

## Continuity — any session must be able to continue

Durable files, not the chat, are the source of truth. Chat history is **not**
shared between sessions or VS Code windows, so another agent may resume with
zero memory of this conversation.

- **Start of every session/task:** `AGENTS.md` is auto-loaded and points to
  `STATUS.md`; **`STATUS.md` is the single source of truth** for the stage and the
  next action. Read it first.
- **Stage agents** (analyst, critic, architect, test-author, implementer): before
  finishing, update the root `STATUS.md` — tick your stage's column for the
  feature and set `## Next action` to the next command (or to the blocker) — then
  print your `[STATUS]` line. Do NOT edit `README.md`; the history log is owned by
  the user/orchestrator.
- **User:** append to `README.md`'s progress log only for decisions/reversals, not
  routine progress; correct `STATUS.md` if a stage left it wrong.
- **Never leave a decision, blocker, convention, or next step only in chat.**
  If it matters to continuing the work, write it to a durable file.
- Keep `STATUS.md` short and unambiguous: a fresh agent with no history must be
  able to resume from it alone.

## Documentation sync — start of every task

Before doing anything else, check that `STATUS.md`, the specs,
and the README still match reality, and update them first when needed:

- `STATUS.md` — pipeline stage table + the exact next action.
- `AGENTS.md` — update when the project's stack, structure, conventions, or
  domain mapping change.
- `README.md` — the progress log is a **decisions log**, not a changelog: record
  the *why* (decisions, reversals, conventions); git already tracks the *what*.

## Origin: PAM (provenance only)

This project's spec-driven, multi-agent workflow is **derived from** PAM
(`PAM/`), but PAM is an **enterprise NestJS / Turborepo / TypeScript** codebase
and NovelTracker is a **plain-JS / Express / raw-SQL** project. PAM is therefore
a **historical reference, not a pattern to copy**:

- Do **not** consult `PAM/` during normal feature work — its conventions do not
  apply to this stack.
- Consult it only when the user explicitly asks about the workflow's origin.
- Never introduce PAM machinery (or any new file) without proposing it — with the
  exact text — and getting approval first.

## Spec-driven workflow — user provides requirements

The workflow for analysing feature specifications:

1. **User provides feature description** — The user describes features in plain
   language in the chat dialogue. The agent does NOT invent or create feature
   descriptions.
2. **Agent may ask questions** — The agent can ask clarifying questions or
   suggest improvements if requirements are unclear or incomplete.
3. **spec-analyst converts to Gherkin** — Once requirements are clear, the
   spec-analyst agent converts them into executable Gherkin scenarios in
   `spec/features/<domain>/<feature-slug>.feature`.
4. **User reviews and approves** — The user reviews the generated spec file
   before it becomes frozen. Once frozen, changes go only through spec-analyst
   in revise mode.

### Two documentation layers (both come from the user)

The user's plain-language input is the single source for BOTH documents; the
difference is form and timing, not origin:

- **`spec/domains/<domain>/requirements.md`** — the canonical, numbered list of
  rules (`REQ-001`, `REQ-002`, …) in EARS form ("When …, the system must …").
  Written down once per domain and kept stable; it is the source of truth for
  business rules. Each rule is one sentence plus a short "Why it matters" line —
  **no acceptance criteria**: the concrete cases, boundaries, and error paths
  live in the `.feature` scenarios (one rule maps to one or more scenarios).
- **`spec/features/<domain>/<feature-slug>.feature`** — executable Gherkin
  examples of those rules. Many examples may prove one rule. Each scenario
  carries `@req:<domain>#REQ-nnn` pointing back at the rule it proves.

Flow: user describes → the analyst writes/updates the numbered requirements →
the analyst writes Gherkin examples that trace to those numbers → the user
reviews and freezes the `.feature`. Requirements are never invented by the
agent; they are the user's intent recorded in canonical form.

## Automatic driver ("foreman" / orchestrator) — SUSPENDED

The `spec-orchestrator` agent and the `/spec-flow` command are **suspended as of
2026-10-27**: parked in `.kilo/suspended-agents/` and therefore **not
registered** — Kilo only discovers `.kilo/agent/*.md` and `.kilo/command/*.md`.
The user wants to run everything **manually for now**, one stage at a time, so
the workflow is exactly: run each stage with its own command (`/spec-analyse`,
`/spec-critique`, `/spec-design`, `/spec-test`, `/spec-implement`), review the
output, then run the next.

Do **not** propose reactivating the orchestrator or recreate `/spec-flow`
unless the user asks. To reactivate, move `.kilo/suspended-agents/spec-orchestrator.md`
back to `.kilo/agent/` and `.kilo/suspended-agents/spec-flow.md` back to
`.kilo/command/`. Stages 6 (review) and 7 (document) are not created yet, so the
chain stops after implementation.

## Live rules — update them as we talk

Rules are not static. During any interaction, watch for anything that should
change how we work and propose a rule update:

- A new convention, decision, or constraint the user states → propose adding
  or amending a rule in `.kilo/rules/core.md`.
- A recurring correction or an instruction the agent keeps getting wrong →
  propose a rule so it sticks for future sessions.
- A rule that no longer matches how we actually work → propose removing or
  rewriting it.

The agent always proposes the change (showing the exact text) and applies it
only after the user approves. Rules live in `.kilo/rules/` (always-on) and
`.kilo/agent/` (per-agent); permission settings live in `.kilo/kilo.json`.

## Design inputs — docs and wireframes

External design material is an input to the spec-driven loop, never the
behavioral source of truth:

- **Written requirements / specification documents** are analyse-stage inputs.
  The user provides them (or places them under `spec/domains/<domain>/`) and
  the spec-analyst converts them into `.feature` scenarios. The frozen
  `.feature` remains the source of truth.
- **UI designs and wireframes** (e.g. Figma, low-fidelity sketches) are
  implementation inputs for the `app/client/` UI and may inform the wording of
  UI-facing scenarios. When kept in-repo they live under
  `spec/domains/<domain>/ui/`. Visual layout is never the behavioral source of
  truth — the Gherkin scenarios are.

Never treat a design document or wireframe as a requirement that overrides a
frozen `.feature`: when they disagree, the `.feature` wins until it is revised
through the spec-analyst.

## Done means documented

A task is not complete until `STATUS.md` and the README
progress log are up to date. Judge "needs update?" once before starting the task
and again before declaring it done. In particular, the "Next action" in
`STATUS.md` must always reflect the true next step for whoever resumes.
