# FLOW.md — The Complete Pipeline Walkthrough

> **Owner-only reference.** This file explains the spec-driven workflow from your
> plain English instruction through implementation — how agents are triggered,
> what files are created, and why. No agent reads this file; the workflow does not
> depend on it.

## Your Starting Point: Plain English Instruction

Everything begins with you describing a feature in natural language. You provide:

- **What the user wants to do** (the goal)
- **What data is involved** (fields, formats, constraints)
- **What rules apply** (required/optional, validation, limits)

**Example (the create-novel feature):**

> "I want users to add novels to their collection. Required fields: Author, Polish
> title, Original title, Year (4-digit), Genre (one or more from a dropdown).
> Optional: Picture (JPEG/PNG/WebP/GIF, max 2 MB), Description, Favourite flag.
> When no picture is uploaded, show a default book icon. When description is empty,
> show 'no description yet'."

You can:

- Chat with the agent to clarify details
- Provide written specs or design docs as input (they get converted to .feature)
- Share wireframes/mockups (they inform UI but never override behavior)

The spec-analyst agent asks clarifying questions if anything is ambiguous. **You
answer those questions — agents never invent requirements.**

---

## Stage 1: Analyse (Requirements + Scenarios)

**Command:** `/spec-analyse <your plain English description>`

**Agent:** `spec-analyst` (`.kilo/agent/spec-analyst.md`) — reached via
`.kilo/command/spec-analyse.md`, whose frontmatter says `agent: spec-analyst`.

**How this step runs:** Kilo finds `.kilo/command/spec-analyse.md`, reads its
`agent:` field, loads `.kilo/agent/spec-analyst.md` as the agent's system prompt
(its workflow, rules, and required `[STATUS]` line live there), and replaces
`$ARGUMENTS` with your text. Before it works, a fixed context is injected:
**`AGENTS.md`** (project conventions), **`.kilo/rules/core.md`**
(always-on working rules), **`.kilo/kilo.json`** (which tools are allowed /
denied / ask). The agent runs in an **isolated context** — it never sees this
chat, only `$ARGUMENTS` and the files on disk, which is why durable files are the
source of truth.

**Permissions (declared in the agent file):** may edit `spec/features/**` and
`spec/domains/**/requirements.md`; must not touch application code or other
agents' specs.

**Reads (in addition to the injected `AGENTS.md` + `core.md`):**
- the feature description you typed (becomes `$ARGUMENTS`),
- `spec/domains/<domain>/requirements.md` — if the domain already has rules,
- any `spec/domains/<domain>/ui/*.ui.md` (for wording only).

**Writes:** `spec/domains/<domain>/requirements.md` **first**, then
`spec/features/<domain>/<feature-slug>.feature`.

**Status:** `[STATUS] <domain>/<feature-slug> analysed done` — the machine-readable
line your next command keys off.

**Feeds the next step:** `/spec-critique <domain>/<feature-slug>` — the analyst
ticks `analysed` and sets this as `STATUS.md`'s Next action.

**What it does:**

1. Reads your description
2. Asks clarifying questions if needed (actors, edge cases, error states)
3. Determines the **domain** (e.g., `novels`) and **feature slug** (e.g., `create-novel`)
4. **Writes the requirements first** → `spec/domains/<domain>/requirements.md`
5. **Then writes the Gherkin scenarios** → `spec/features/<domain>/<feature-slug>.feature`
6. Prints `[STATUS] <domain>/<feature-slug> analysed done`

### Files Created

#### 1. `spec/domains/<domain>/requirements.md`

The **canonical numbered list of business rules** — the source of truth.

**Structure:**

- Each rule has a stable id: `REQ-001`, `REQ-002`, etc.
- Each rule is one EARS sentence: "When …, the system must …"
- Each rule has a "Why it matters" line
- **NO acceptance criteria** — concrete examples live in scenarios

**Example (from create-novel):**

```markdown
### REQ-001 — Create a novel | must | draft

**Requirement:** When a user provides an author, a Polish title, an original
title, a 4-digit year, and one or more genres from the allowed list, the system
must create the novel entry.

**Why it matters:** Recording complete metadata lets users track their books
accurately.

### REQ-002 — Author is required | must | draft

**Requirement:** If the author is missing, the system must reject the creation
and report that the author is required.

**Why it matters:** Without an author, the novel record is incomplete.
```

#### 2. `spec/features/<domain>/<feature-slug>.feature`

The **executable Gherkin scenarios** — concrete examples proving the rules.

**Structure:**

- `Feature:` block stating user intent
- `Background:` (optional) — shared setup
- `Scenario:` blocks in Given/When/Then form
- Each scenario tagged `@req:<domain>#REQ-nnn` to trace back to requirements
- Leading `# Analyst assumptions:` comment documenting decisions

**Example (from create-novel.feature, abbreviated):**

```gherkin
# Analyst assumptions:
# [INFERRED] Required fields must all be provided and non-empty.
# [DECIDED] Genre is chosen from a predefined dropdown, not freeform text.
# [DECIDED] Picture uploads: JPEG/PNG/WebP/GIF, max 5 MB.
# [SCOPE-OUT] Authentication deferred; creating needs no sign-in.

Feature: Create a novel
  As a user of NovelTracker,
  I want to add novels to my collection,
  So that I can keep track of the books I own and read.

  Background:
    Given the novel collection is empty

  @req:novels#REQ-001
  Scenario: Successfully create a novel with all required fields
    When I create a novel with:
      | Field          | Value                    |
      | Author         | J.R.R. Tolkien           |
      | Polish title   | Władca Pierścieni        |
      | Original title | The Lord of the Rings    |
      | Year           | 1954                     |
      | Genre          | Fantasy                  |
    Then the novel is created successfully
    And the novel appears in the collection

  @req:novels#REQ-002
  Scenario: Cannot create without author
    When I create a novel with:
      | Field          | Value                 |
      | Author         | (missing)             |
      | Polish title   | Hobbit                |
      | Original title | The Hobbit            |
      | Year           | 1937                  |
      | Genre          | Fantasy               |
    Then the system rejects the creation
    And reports "Author is required"
```

**20 scenarios total** covering success, validation errors, edge cases, picture
uploads, multiple genres, etc.

### Key Rules

- `.feature` files are **frozen** after this stage
- Only the spec-analyst (in `--revise` mode) can edit them later
- Requirement ids are stable — never reused
- Each scenario must trace to at least one `REQ-nnn`

---

## Stage 2: Critique (Review + Gate)

**Command:** `/spec-critique <domain>/<feature-slug>`

**Agent:** `spec-critic` (`.kilo/agent/spec-critic.md`) — reached via
`.kilo/command/spec-critique.md`, whose frontmatter says `agent: spec-critic`.

**How this step runs:** Kilo finds `.kilo/command/spec-critique.md`, reads its
`agent:` field, loads `.kilo/agent/spec-critic.md` as the agent's system prompt,
and replaces `$ARGUMENTS` with `<domain>/<feature-slug>`. Injected before it works:
**`AGENTS.md`**, **`.kilo/rules/core.md`**, **`.kilo/kilo.json`**. Isolated
context — no chat history, only `$ARGUMENTS` and the files on disk.

**Permissions (declared in the agent file):** may write only
`spec/features/**/*.review.md`; `.feature` is explicitly **denied** (findings go
in the review file, never in an edit to the spec).

**Reads (in addition to the injected `AGENTS.md` + `core.md`):**
- `spec/features/<domain>/<feature-slug>.feature`,
- `spec/domains/<domain>/requirements.md` (the rules of record),
- any `spec/domains/<domain>/ui/*.ui.md` (visual notes),
- sibling features in the same domain when relevant.

**Writes:** `spec/features/<domain>/<feature-slug>.review.md` — **always**,
whatever the verdict.

**Status:** `critiqued done` (verdict `Approved for design`) or
`critiqued blocked: spec-change-required` (verdict `Changes required`) — the
`blocked: spec-change-required` token is what signals a revise cycle is needed.

**Feeds the next step:** on `done` → `/spec-design <domain>/<feature-slug>`; on
`blocked: spec-change-required` → `/spec-analyse <domain>/<feature-slug> --revise`
with the corrections, then re-run `/spec-critique` until `Approved for design`.
The critic records the verdict by ticking `critiqued` and setting the
corresponding Next action in `STATUS.md`.

**What it does:**

1. Reads the `.feature`, the `requirements.md`, sibling features, and any UI notes
2. Checks:
   - **Coverage** — every scenario has valid `@req` tags; every requirement is proven
   - **Orphans** — no scenario proving a rule that doesn't exist
   - **Contradictions** — scenarios vs. requirements or each other
   - **Edge cases** — empty states, errors, boundary values, duplicates
   - **Testability** — concrete, observable steps (no vague wording)
   - **Assumptions** — heavy use of `[INFERRED]`, any `@todo` left
3. **Always** produces a review file
4. Prints `[STATUS]` line:
   - `critiqued done` when verdict is `Approved for design`
   - `critiqued blocked: spec-change-required` when changes needed

### File Created

#### `spec/features/<domain>/<feature-slug>.review.md`

The **gate between critique and design** — design only proceeds when this file
says `Approved for design`.

**Structure:**

- `## Blocking issues` — must fix before design
- `## Warnings` — should address
- `## Edge cases missed` — scenarios to add
- `## Coverage gaps` — requirements with no proof
- `## Suggested scenarios` — concrete additions
- Final verdict: `Approved for design` or `Changes required`

**Example (from create-novel.review.md, abbreviated):**

```markdown
# Create a Novel — Spec Review

## Blocking issues

None.

## Warnings

None.

## Edge cases missed

None — the 20 scenarios provide comprehensive coverage.

## Coverage gaps

None — every requirement REQ-001…REQ-011, REQ-037…REQ-039 has at least
one scenario.

## Suggested scenarios

None — current coverage is sufficient.

---

**Verdict:** Approved for design

The feature is complete, testable, and ready for design.
```

### The Revise Loop

If the verdict is `Changes required`, the critic adds a
`## Spec change required` section listing exact changes. You then:

1. Run `/spec-analyse <domain>/<feature-slug> --revise` with the correction text
2. The spec-analyst applies only the requested change
3. Run `/spec-critique <domain>/<feature-slug>` again
4. Repeat until `Approved for design`

---

## Stage 3: Design (Technical Specification)

**Command:** `/spec-design <domain>/<feature-slug>`

**Agent:** `spec-architect` (`.kilo/agent/spec-architect.md`) — reached via
`.kilo/command/spec-design.md`, whose frontmatter says `agent: spec-architect`.

**How this step runs:** Kilo finds `.kilo/command/spec-design.md`, reads its
`agent:` field, loads `.kilo/agent/spec-architect.md` as the agent's system
prompt, and replaces `$ARGUMENTS` with `<domain>/<feature-slug>`. Injected before
it works: **`AGENTS.md`**, **`.kilo/rules/core.md`**, **`.kilo/kilo.json`**.
Isolated context — no chat history, only `$ARGUMENTS` and the files on disk.

**Permissions (declared in the agent file):** may write
`spec/features/**/*.design.md` and `spec/domains/**/data-model.md`; `.feature` is
explicitly **denied**.

**Reads (in addition to the injected `AGENTS.md` + `core.md`):**
- `spec/features/<domain>/<feature-slug>.feature`,
- `spec/features/<domain>/<feature-slug>.review.md` — **must** say
  `Approved for design`, else the architect stops,
- `spec/domains/<domain>/requirements.md`,
- any `spec/domains/<domain>/ui/*.ui.md`.

**Writes:** `spec/features/<domain>/<feature-slug>.design.md` and the shared
`spec/domains/<domain>/data-model.md`.

**Status:** `[STATUS] <domain>/<feature-slug> designed done|blocked: <reason>`.

**Feeds the next step:** `/spec-test <domain>/<feature-slug>` — the architect
ticks `designed` and sets this as `STATUS.md`'s Next action.

**Precondition:** The `.review.md` must exist and contain `Approved for design`.

**What it does:**

1. Reads the `.feature`, `requirements.md`, `.review.md`, and UI notes
2. Produces a technical design mapping scenarios to implementation
3. Updates the shared domain data model
4. Prints `[STATUS] <domain>/<feature-slug> designed done|blocked: <reason>`

### Files Created

#### 1. `spec/features/<domain>/<feature-slug>.design.md`

The **technical blueprint** for test-author and implementer.

**Structure:**

**1. API contract:**

- Each endpoint: method, path, auth requirement
- Request body (fields, types, validation rules)
- Response body (success + error shapes)
- Mapped to scenarios it serves

**2. Data model:**

- PostgreSQL tables, columns, types, keys, indexes
- Notes on changes to shared domain model

**3. UI plan:**

- React routes/components and their state
- Mapped to UI notes

**4. Test plan:**

- Which scenarios → Playwright E2E tests
- Which scenarios → Newman/Postman API tests

**5. Traceability:**

- Scenario → endpoint/component mapping

**Example (from create-novel.design.md, abbreviated):**

````markdown
# Create a novel — Design

## 1. API contract

### 1.1 `POST /api/novels`

Creates one entry.

| Property      | Value                          |
| ------------- | ------------------------------ |
| Method / path | `POST /api/novels`             |
| Content type  | `multipart/form-data`          |
| Success       | `201 Created`, body `NovelDto` |

Request fields:

| Field           | Type    | Required | Rules                                |
| --------------- | ------- | -------- | ------------------------------------ |
| `author`        | text    | yes      | Trimmed; non-blank (REQ-002)         |
| `titlePl`       | text    | yes      | Trimmed; non-blank (REQ-003)         |
| `titleOriginal` | text    | yes      | Trimmed; non-blank (REQ-004)         |
| `year`          | integer | yes      | Integer 1000-9999 (REQ-005, REQ-007) |
| `genres`        | array   | yes (≥1) | Each from canonical list (REQ-006)   |
| `description`   | text    | no       | Trimmed; empty → `NULL` (REQ-011)    |
| `isFavourite`   | boolean | no       | Defaults to `false` (REQ-037)        |
| `picture`       | file    | no       | JPEG/PNG/WebP/GIF, ≤5MB (REQ-010)    |

Success response:

```json
{
  "id": "3f2a9c1e-6b7d-4e8f-9a0b-1c2d3e4f5a6b",
  "author": "J.R.R. Tolkien",
  "titlePl": "Władca Pierścieni",
  "titleOriginal": "The Lord of the Rings",
  "year": 1954,
  "genres": ["Fantasy"],
  "description": "Epic fantasy trilogy",
  "isFavourite": false,
  "pictureUrl": "/uploads/novels/3f2a9c1e.jpg",
  "createdAt": "2026-10-27T14:23:45.123Z"
}
```
````

Error responses:

```json
{
  "error": "validation_error",
  "message": "Author is required",
  "fields": { "author": "required" }
}
```

## 2. Data model

Tables:

```sql
CREATE TABLE novels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author VARCHAR(255) NOT NULL,
  title_pl VARCHAR(500) NOT NULL,
  title_original VARCHAR(500) NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 1000 AND year <= 9999),
  description TEXT,
  is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
  picture_url VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE novel_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  genre VARCHAR(100) NOT NULL CHECK (genre IN (
    'Fantasy', 'Science Fiction', 'Horror', 'Thriller', 'Mystery',
    'Crime', 'Romance', 'Historical', 'Adventure', 'Literary',
    'Drama', 'Poetry', 'Non-fiction', 'Biography', 'Other'
  )),
  UNIQUE (novel_id, genre)
);
```

## 3. UI plan

Route: `/create`

Components:

- `NovelForm` — form with fields, validation, picture upload
- `GenreMultiSelect` — dropdown allowing multiple selections
- `PictureUpload` — drag-drop or file picker with preview

## 4. Test plan

**Playwright E2E** (all 20 scenarios):

- Form rendering, validation, success, picture upload, multiple genres

**Newman/Postman API**:

- Subset of scenarios testing the API contract directly

````

#### 2. `spec/domains/<domain>/data-model.md`

The **shared domain data model** — updated when a feature changes tables.

**Example (from novels/data-model.md):**

```markdown
# Novels — Data Model

## Tables

### `novels`

| Column          | Type         | Nullable | Default | Notes                     |
|-----------------|--------------|----------|---------|---------------------------|
| `id`            | UUID         | no       | gen     | Primary key               |
| `author`        | VARCHAR(255) | no       |         | Novel author              |
| `title_pl`      | VARCHAR(500) | no       |         | Polish title              |
| `title_original`| VARCHAR(500) | no       |         | Original title            |
| `year`          | INTEGER      | no       |         | 4-digit year (1000-9999)  |
| `description`   | TEXT         | yes      |         | Optional description      |
| `is_favourite`  | BOOLEAN      | no       | false   | Favourite flag            |
| `picture_url`   | VARCHAR(500) | yes      |         | Stored picture path       |
| `created_at`    | TIMESTAMP    | no       | NOW()   | Creation timestamp        |

### `novel_genres`

| Column     | Type        | Nullable | Notes                           |
|------------|-------------|----------|---------------------------------|
| `id`       | UUID        | no       | Primary key                     |
| `novel_id` | UUID        | no       | FK to novels; CASCADE delete    |
| `genre`    | VARCHAR(100)| no       | From canonical list             |

Unique: `(novel_id, genre)` — no duplicate genres per novel.
````

---

## Stage 4: Test (Red Phase)

**Command:** `/spec-test <domain>/<feature-slug>`

**Agent:** `spec-test-author` (`.kilo/agent/spec-test-author.md`) — reached via
`.kilo/command/spec-test.md`, whose frontmatter says `agent: spec-test-author`.

**How this step runs:** Kilo finds `.kilo/command/spec-test.md`, reads its
`agent:` field, loads `.kilo/agent/spec-test-author.md` as the agent's system
prompt, and replaces `$ARGUMENTS` with `<domain>/<feature-slug>`. Injected before
it works: **`AGENTS.md`**, **`.kilo/rules/core.md`**, **`.kilo/kilo.json`**.
Isolated context — no chat history, only `$ARGUMENTS` and the files on disk.

**Permissions (declared in the agent file):** may write only `app/tests/**`;
`.feature` is explicitly **denied**, and it never edits production code.

**Reads (in addition to the injected `AGENTS.md` + `core.md`):**
- the feature's `.feature`,
- its `.design.md` (including the "Fixtures and setup" section, if present),
- the domain `data-model.md`.

**Writes:** `app/tests/e2e/<domain>/<feature-slug>.spec.js` (UI scenarios),
`app/tests/api/**` Postman/Newman collection (API scenarios), and any fixtures
under `app/tests/e2e/fixtures/`.

**Status:** `[STATUS] <domain>/<feature-slug> tested-red done|blocked: <reason>`
(the tests must fail for the *right* reason — a missing endpoint or an assertion,
never a typo/import/syntax error).

**Feeds the next step:** `/spec-implement <domain>/<feature-slug>` — the
test-author ticks `tested (red)` and sets this as `STATUS.md`'s Next action.

**What it does:**

1. Reads `.feature`, `.design.md`, and `data-model.md`
2. **Generates required test fixtures first** (images, files, data)
3. Writes Playwright tests for UI scenarios
4. Writes Postman/Newman tests for API scenarios
5. Confirms each test **fails for the right reason** (not typos/imports)
6. Prints `[STATUS] <domain>/<feature-slug> tested-red done|blocked: <reason>`

### Files Created

#### 1. `app/tests/e2e/<domain>/<feature-slug>.spec.js`

**Playwright end-to-end tests** — one test per scenario.

**Structure:**

- Test suite per feature
- Each test named after its scenario
- `@req` tags in test name or comment
- Fixtures loaded from `app/tests/e2e/fixtures/`

**Example:**

```javascript
// app/tests/e2e/novels/create-novel.spec.js
import { test, expect } from "@playwright/test";

test.describe("Create a novel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/create");
  });

  // @req:novels#REQ-001
  test("Successfully create a novel with all required fields", async ({ page }) => {
    await page.fill('input[name="author"]', "J.R.R. Tolkien");
    await page.fill('input[name="titlePl"]', "Władca Pierścieni");
    await page.fill('input[name="titleOriginal"]', "The Lord of the Rings");
    await page.fill('input[name="year"]', "1954");
    await page.selectOption('select[name="genres"]', "Fantasy");

    await page.click('button[type="submit"]');

    await expect(page.locator(".success-message")).toBeVisible();
    await expect(page.locator(".novel-list")).toContainText("Władca Pierścieni");
  });

  // @req:novels#REQ-002
  test("Cannot create without author", async ({ page }) => {
    await page.fill('input[name="titlePl"]', "Hobbit");
    await page.fill('input[name="titleOriginal"]', "The Hobbit");
    await page.fill('input[name="year"]', "1937");
    await page.selectOption('select[name="genres"]', "Fantasy");

    await page.click('button[type="submit"]');

    await expect(page.locator(".error-message")).toContainText("Author is required");
  });

  // @req:novels#REQ-010 @req:novels#REQ-038
  test("Upload a valid picture (JPEG, under 5 MB)", async ({ page }) => {
    await page.fill('input[name="author"]', "Terry Pratchett");
    await page.fill('input[name="titlePl"]', "Kolor magii");
    await page.fill('input[name="titleOriginal"]', "The Colour of Magic");
    await page.fill('input[name="year"]', "1983");
    await page.selectOption('select[name="genres"]', "Fantasy");

    await page.setInputFiles('input[type="file"]', "fixtures/valid-picture.jpg");

    await page.click('button[type="submit"]');

    await expect(page.locator(".success-message")).toBeVisible();
    await expect(page.locator(".novel-picture")).toBeVisible();
  });

  // ... 17 more tests
});
```

#### 2. `app/tests/api/<domain>/<feature-slug>.postman_collection.json`

**Postman collection** for Newman — API-level tests.

**Example:**

```json
{
  "info": {
    "name": "Create Novel API Tests",
    "description": "API tests for create-novel feature",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Successfully create a novel (@req:novels#REQ-001)",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "formdata",
          "formdata": [
            { "key": "author", "value": "J.R.R. Tolkien", "type": "text" },
            { "key": "titlePl", "value": "Władca Pierścieni", "type": "text" },
            { "key": "titleOriginal", "value": "The Lord of the Rings", "type": "text" },
            { "key": "year", "value": "1954", "type": "text" },
            { "key": "genres", "value": "Fantasy", "type": "text" }
          ]
        },
        "url": "{{baseUrl}}/api/novels"
      },
      "response": [],
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Status is 201', () => {",
              "  pm.response.to.have.status(201);",
              "});",
              "pm.test('Response has id', () => {",
              "  const json = pm.response.json();",
              "  pm.expect(json.id).to.be.a('string');",
              "});"
            ]
          }
        }
      ]
    },
    {
      "name": "Cannot create without author (@req:novels#REQ-002)",
      "request": {
        "method": "POST",
        "body": {
          "mode": "formdata",
          "formdata": [
            { "key": "titlePl", "value": "Hobbit", "type": "text" },
            { "key": "titleOriginal", "value": "The Hobbit", "type": "text" },
            { "key": "year", "value": "1937", "type": "text" },
            { "key": "genres", "value": "Fantasy", "type": "text" }
          ]
        },
        "url": "{{baseUrl}}/api/novels"
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Status is 400', () => {",
              "  pm.response.to.have.status(400);",
              "});",
              "pm.test('Error message mentions author', () => {",
              "  const json = pm.response.json();",
              "  pm.expect(json.message.toLowerCase()).to.include('author');",
              "});"
            ]
          }
        }
      ]
    }
  ]
}
```

#### 3. `app/tests/e2e/fixtures/`

**Test fixtures** — sample files for tests.

- `valid-picture.jpg` — small JPEG for upload tests
- `large-picture.jpg` — exactly 5,000,001 bytes for size limit tests
- `invalid-picture.txt` — text file posing as image for format tests

### Red Phase Verification

The test-author agent:

1. Runs the tests
2. Confirms they **fail for the right reason**:
   - Assertion failure (endpoint missing)
   - 404 (route not implemented)
   - NOT: import error, typo, syntax error
3. Fixes any test bugs before reporting red

---

## Stage 5: Implement (Green Phase)

**Command:** `/spec-implement <domain>/<feature-slug>`

**Agent:** `spec-implementer` (`.kilo/agent/spec-implementer.md`) — reached via
`.kilo/command/spec-implement.md`, whose frontmatter says `agent: spec-implementer`.

**How this step runs:** Kilo finds `.kilo/command/spec-implement.md`, reads its
`agent:` field, loads `.kilo/agent/spec-implementer.md` as the agent's system
prompt, and replaces `$ARGUMENTS` with `<domain>/<feature-slug>`. Injected before
it works: **`AGENTS.md`**, **`.kilo/rules/core.md`**, **`.kilo/kilo.json`**.
Isolated context — no chat history, only `$ARGUMENTS` and the files on disk.

**Permissions (declared in the agent file):** may write `app/server/**`,
`app/client/**`, `app/docker/**`, `app/jenkins/**`, `app/tests/**`, and the root
`package.json`; `.feature` is explicitly **denied**.

**Reads (in addition to the injected `AGENTS.md` + `core.md`):**
- the feature's `.feature`,
- its `.design.md`,
- the domain `data-model.md`,
- the existing tests under `app/tests/`.

**Writes:** `app/server/**`, `app/client/**`, `app/docker/**`, `app/jenkins/**`,
`app/tests/**`, and the root `package.json` (project scaffold on first run).

**Status:** `[STATUS] <domain>/<feature-slug> implemented done|blocked: <reason>`
(reported only once `npm run test:api` and `npm run test:e2e` pass).

**Feeds the next step:** nothing to run — the chain ends here for now (stages 6
review and 7 document do not exist). The implementer ticks `implemented` and sets
`STATUS.md`'s Next action to validation; you only append to the `README.md`
decisions log if a decision changed.

**What it does:**

1. Reads `.feature`, `.design.md`, `data-model.md`, and tests
2. **Scaffolds the project** on first run (if not already done)
3. Implements endpoints, migrations, and UI components per the design
4. Runs tests until they pass
5. Runs lint/typecheck if configured
6. Prints `[STATUS] <domain>/<feature-slug> implemented done|blocked: <reason>`

### Files Created/Modified

#### 1. Project Scaffold (first run only)

**Root:**

- `package.json` — npm workspace config

**`app/server/`:**

- `package.json` — Express, pg, multer dependencies
- `src/index.js` — Express app entry point
- `src/db.js` — PostgreSQL connection pool
- `src/migrate.js` — Migration runner
- `migrations/` — versioned SQL migrations
- `.env.example` — environment variables template

**`app/client/`:**

- `package.json` — React, Vite dependencies
- `src/App.jsx` — React app entry
- `vite.config.js` — Vite config

**`app/tests/`:**

- `package.json` — Playwright, Newman dependencies
- `playwright.config.js` — Playwright config

**`app/docker/`:**

- `Dockerfile.server`, `Dockerfile.client`
- `docker-compose.yml` — PostgreSQL + server + client

**`app/jenkins/`:**

- `Jenkinsfile` — CI pipeline

#### 2. Database Migration

**`app/server/migrations/001_create_novels.sql`**

```sql
-- Create novels table
CREATE TABLE novels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author VARCHAR(255) NOT NULL,
  title_pl VARCHAR(500) NOT NULL,
  title_original VARCHAR(500) NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 1000 AND year <= 9999),
  description TEXT,
  is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
  picture_url VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create novel_genres join table
CREATE TABLE novel_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  genre VARCHAR(100) NOT NULL CHECK (genre IN (
    'Fantasy', 'Science Fiction', 'Horror', 'Thriller', 'Mystery',
    'Crime', 'Romance', 'Historical', 'Adventure', 'Literary',
    'Drama', 'Poetry', 'Non-fiction', 'Biography', 'Other'
  )),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (novel_id, genre)
);

-- Index for genre lookups
CREATE INDEX idx_novel_genres_novel_id ON novel_genres(novel_id);
CREATE INDEX idx_novel_genres_genre ON novel_genres(genre);
```

#### 3. Backend Implementation

**`app/server/src/routes/novels.js`**

```javascript
import express from "express";
import multer from "multer";
import { createNovel } from "../controllers/novelController.js";
import { validatePicture } from "../middleware/validatePicture.js";

const router = express.Router();
const upload = multer({ dest: "uploads/temp/" });

router.post("/novels", upload.single("picture"), validatePicture, createNovel);

export default router;
```

**`app/server/src/controllers/novelController.js`**

```javascript
import db from "../db.js";
import { savePicture } from "../utils/pictureStorage.js";

export async function createNovel(req, res) {
  const { author, titlePl, titleOriginal, year, description, isFavourite } = req.body;
  const genres = Array.isArray(req.body.genres) ? req.body.genres : [req.body.genres];

  // Validation
  const errors = {};
  if (!author?.trim()) errors.author = "required";
  if (!titlePl?.trim()) errors.titlePl = "required";
  if (!titleOriginal?.trim()) errors.titleOriginal = "required";
  if (!year) errors.year = "required";

  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum) || yearNum < 1000 || yearNum > 9999) {
    errors.year = "invalid_year";
  }

  if (!genres || genres.length === 0) {
    errors.genres = "required";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: "validation_error",
      message: "Validation failed",
      fields: errors,
    });
  }

  // Save picture if uploaded
  let pictureUrl = null;
  if (req.file) {
    pictureUrl = await savePicture(req.file);
  }

  // Insert novel
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const novelResult = await client.query(
      `INSERT INTO novels (author, title_pl, title_original, year, description, is_favourite, picture_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        author.trim(),
        titlePl.trim(),
        titleOriginal.trim(),
        yearNum,
        description?.trim() || null,
        isFavourite === "true" || isFavourite === true,
        pictureUrl,
      ],
    );

    const novel = novelResult.rows[0];

    // Insert genres
    for (const genre of genres) {
      await client.query("INSERT INTO novel_genres (novel_id, genre) VALUES ($1, $2)", [novel.id, genre]);
    }

    await client.query("COMMIT");

    // Fetch complete novel with genres
    const completeNovel = await fetchNovelById(novel.id);

    res.status(201).json(completeNovel);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

**`app/server/src/middleware/validatePicture.js`**

```javascript
import fs from "fs/promises";
import fileType from "file-type";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function validatePicture(req, res, next) {
  if (!req.file) {
    return next(); // Picture is optional
  }

  // Check size
  if (req.file.size > MAX_SIZE) {
    await fs.unlink(req.file.path);
    return res.status(400).json({
      error: "picture_too_large",
      message: "Picture must be 5 MB or smaller",
    });
  }

  // Check type by magic bytes
  const type = await fileType.fromFile(req.file.path);
  if (!type || !ALLOWED_TYPES.includes(type.mime)) {
    await fs.unlink(req.file.path);
    return res.status(400).json({
      error: "picture_invalid_type",
      message: "Picture must be JPEG, PNG, WebP, or GIF",
    });
  }

  next();
}
```

#### 4. Frontend Implementation

**`app/client/src/pages/CreateNovelPage.jsx`**

```javascript
import React, { useState } from "react";
import NovelForm from "../components/NovelForm";
import { createNovel } from "../api/novels";

export default function CreateNovelPage() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(formData) {
    try {
      const novel = await createNovel(formData);
      setSuccess(true);
      setError(null);
    } catch (err) {
      setError(err.message);
      setSuccess(false);
    }
  }

  return (
    <div className="create-novel-page">
      <h1>Add a Novel</h1>

      {success && <div className="success-message">Novel created successfully!</div>}

      {error && <div className="error-message">{error}</div>}

      <NovelForm onSubmit={handleSubmit} />
    </div>
  );
}
```

**`app/client/src/components/NovelForm.jsx`**

```javascript
import React, { useState } from "react";
import GenreMultiSelect from "./GenreMultiSelect";
import PictureUpload from "./PictureUpload";

const GENRES = [
  "Fantasy",
  "Science Fiction",
  "Horror",
  "Thriller",
  "Mystery",
  "Crime",
  "Romance",
  "Historical",
  "Adventure",
  "Literary",
  "Drama",
  "Poetry",
  "Non-fiction",
  "Biography",
  "Other",
];

export default function NovelForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    author: "",
    titlePl: "",
    titleOriginal: "",
    year: "",
    genres: [],
    description: "",
    isFavourite: false,
    picture: null,
  });

  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleGenresChange(selectedGenres) {
    setFormData((prev) => ({ ...prev, genres: selectedGenres }));
  }

  function handlePictureChange(file) {
    setFormData((prev) => ({ ...prev, picture: file }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Client-side validation
    const newErrors = {};
    if (!formData.author.trim()) newErrors.author = "Author is required";
    if (!formData.titlePl.trim()) newErrors.titlePl = "Polish title is required";
    if (!formData.titleOriginal.trim()) newErrors.titleOriginal = "Original title is required";
    if (!formData.year) newErrors.year = "Year is required";
    if (formData.genres.length === 0) newErrors.genres = "At least one genre is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    await onSubmit(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="novel-form">
      <div className="form-field">
        <label htmlFor="author">Author *</label>
        <input type="text" id="author" name="author" value={formData.author} onChange={handleChange} />
        {errors.author && <span className="error">{errors.author}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="titlePl">Polish Title *</label>
        <input type="text" id="titlePl" name="titlePl" value={formData.titlePl} onChange={handleChange} />
        {errors.titlePl && <span className="error">{errors.titlePl}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="titleOriginal">Original Title *</label>
        <input type="text" id="titleOriginal" name="titleOriginal" value={formData.titleOriginal} onChange={handleChange} />
        {errors.titleOriginal && <span className="error">{errors.titleOriginal}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="year">Year *</label>
        <input type="number" id="year" name="year" min="1000" max="9999" value={formData.year} onChange={handleChange} />
        {errors.year && <span className="error">{errors.year}</span>}
      </div>

      <div className="form-field">
        <label>Genres *</label>
        <GenreMultiSelect genres={GENRES} selected={formData.genres} onChange={handleGenresChange} />
        {errors.genres && <span className="error">{errors.genres}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="no description yet"
        />
      </div>

      <div className="form-field">
        <label>Picture</label>
        <PictureUpload onChange={handlePictureChange} />
      </div>

      <div className="form-field">
        <label>
          <input type="checkbox" name="isFavourite" checked={formData.isFavourite} onChange={handleChange} />
          Mark as favourite
        </label>
      </div>

      <button type="submit">Add Novel</button>
    </form>
  );
}
```

### Green Phase Verification

The implementer agent:

1. Runs migrations: `npm run migrate`
2. Starts server: `npm run dev:server`
3. Starts client: `npm run dev:client`
4. Runs API tests: `npm run test:api` (Newman)
5. Runs E2E tests: `npm run test:e2e` (Playwright)
6. Confirms all tests pass
7. Reports `implemented done`

---

## The Automatic Driver (SUSPENDED)

> **Suspended as of 2026-10-27.** Parked in `.kilo/suspended-agents/` and **not
> registered** — we run the pipeline manually, one stage at a time, for now. This
> section is kept for reference; reactivate by moving `.kilo/suspended-agents/spec-orchestrator.md`
> back to `.kilo/agent/` and `.kilo/suspended-agents/spec-flow.md` back to
> `.kilo/command/`.

**Command:** `/spec-flow <your plain English description>`

**Agent:** `spec-orchestrator` (`.kilo/agent/spec-orchestrator.md`)

**What it does:**

Runs the **entire chain automatically** without you typing each stage command:

1. Records your feature description
2. Creates `spec/features/<domain>/<feature-slug>.status.md` to track progress
3. Invokes `spec-analyst` as a subagent → analyse
4. Reads the `[STATUS]` line from analyse
5. Invokes `spec-critic` as a subagent → critique
6. If critique returns `blocked: spec-change-required`:
   - Invokes `spec-analyst --revise` with corrections
   - Re-runs critique
7. Invokes `spec-architect` → design
8. Invokes `spec-test-author` → test
9. Invokes `spec-implementer` → implement
10. Updates `STATUS.md`
11. Reports success or blocker

**When to use:**

- You want the whole chain to run unattended
- You trust the flow and don't need to review between stages

**When NOT to use:**

- You want to review output after each stage (default workflow)
- You want to make manual adjustments between stages

**Status tracking:**

The orchestrator maintains `spec/features/<domain>/<feature-slug>.status.md`:

```markdown
# Create a novel — Pipeline Status

**Stage:** implemented
**Next:** Manual validation or next feature

## History

- 2026-10-27 analysed done
- 2026-10-27 critiqued done (approved for design)
- 2026-10-27 designed done
- 2026-10-27 tested-red done
- 2026-10-27 implemented done

## Original Prompt

I want users to add novels to their collection. Required: Author, Polish title,
Original title, Year (4-digit), Genre (dropdown). Optional: Picture (max 5MB),
Description, Favourite flag.

## Blockers

None
```

---

## File Map: What Gets Created

Here's every file created by the pipeline for the **create-novel** feature:

### Specification Layer (under `spec/`)

```
spec/
├── domains/
│   └── novels/
│       ├── requirements.md          [analyst, stage 1]
│       ├── data-model.md            [architect, stage 3]
│       └── ui/
│           └── novel-form.ui.md     [optional input]
└── features/
    └── novels/
        ├── create-novel.feature      [analyst, stage 1]
        ├── create-novel.review.md    [critic, stage 2]
        ├── create-novel.design.md    [architect, stage 3]
        └── create-novel.status.md    [orchestrator, auto mode]
```

### Application Layer (under `app/`)

```
app/
├── server/
│   ├── package.json                             [implementer, scaffold]
│   ├── .env.example                             [implementer, scaffold]
│   ├── src/
│   │   ├── index.js                             [implementer, scaffold]
│   │   ├── db.js                                [implementer, scaffold]
│   │   ├── migrate.js                           [implementer, scaffold]
│   │   ├── routes/
│   │   │   └── novels.js                        [implementer, stage 5]
│   │   ├── controllers/
│   │   │   └── novelController.js               [implementer, stage 5]
│   │   ├── middleware/
│   │   │   └── validatePicture.js               [implementer, stage 5]
│   │   └── utils/
│   │       └── pictureStorage.js                [implementer, stage 5]
│   └── migrations/
│       └── 001_create_novels.sql                [implementer, stage 5]
├── client/
│   ├── package.json                             [implementer, scaffold]
│   ├── vite.config.js                           [implementer, scaffold]
│   ├── index.html                               [implementer, scaffold]
│   └── src/
│       ├── App.jsx                              [implementer, scaffold]
│       ├── pages/
│       │   └── CreateNovelPage.jsx              [implementer, stage 5]
│       ├── components/
│       │   ├── NovelForm.jsx                    [implementer, stage 5]
│       │   ├── GenreMultiSelect.jsx             [implementer, stage 5]
│       │   └── PictureUpload.jsx                [implementer, stage 5]
│       └── api/
│           └── novels.js                        [implementer, stage 5]
├── tests/
│   ├── package.json                             [implementer, scaffold]
│   ├── playwright.config.js                     [implementer, scaffold]
│   ├── e2e/
│   │   ├── fixtures/
│   │   │   ├── valid-picture.jpg                [test-author, stage 4]
│   │   │   ├── large-picture.jpg                [test-author, stage 4]
│   │   │   └── invalid-picture.txt              [test-author, stage 4]
│   │   └── novels/
│   │       └── create-novel.spec.js             [test-author, stage 4]
│   └── api/
│       └── novels/
│           └── create-novel.postman_collection.json [test-author, stage 4]
├── docker/
│   ├── Dockerfile.server                        [implementer, scaffold]
│   ├── Dockerfile.client                        [implementer, scaffold]
│   └── docker-compose.yml                       [implementer, scaffold]
└── jenkins/
    └── Jenkinsfile                              [implementer, scaffold]
```

### Configuration (root)

```
NovelTracker/
├── package.json                      [implementer, scaffold - workspace config]
├── .env                              [you, manual setup]
└── .env.example                      [implementer, scaffold]
```

---

## The Gates and Loops

### Gate 1: Review Verdict

**Location:** Between critique (stage 2) and design (stage 3)

**Rule:** Design proceeds **only** when `.review.md` contains `Approved for design`.

**Loop:** If verdict is `Changes required`:

1. Critic adds `## Spec change required` section
2. You run `/spec-analyse <domain>/<feature> --revise` with corrections
3. Analyst applies changes (preserves everything else)
4. You run `/spec-critique <domain>/<feature>` again
5. Repeat until approved

### Gate 2: Tests Must Fail for Right Reason

**Location:** Stage 4 (test-author)

**Rule:** Tests must fail due to **missing implementation**, not test bugs.

**Verification:**

- ✅ Good: `404 Not Found` (endpoint missing)
- ✅ Good: `AssertionError: expected element not found` (UI not implemented)
- ❌ Bad: `SyntaxError` (test code broken)
- ❌ Bad: `Cannot import 'xyz'` (missing dependency)

### Gate 3: Tests Must Pass

**Location:** Stage 5 (implementer)

**Rule:** All tests pass before reporting `implemented done`.

**Verification:**

- `npm run test:api` → all Newman tests pass
- `npm run test:e2e` → all Playwright tests pass
- `npm run lint` → no errors (if configured)

---

## Continuity: How Sessions Resume

**Problem:** AI agents have no memory between sessions. If you close VS Code or
start a new session, the agent knows nothing about your project.

**Solution:** Durable files are the source of truth.

### The Resume File: `STATUS.md`

`AGENTS.md` is **auto-loaded at the start of every session** and holds the durable
instructions (stack, specs, agents, rules). It points to `STATUS.md`, which is the
**single source of truth** for:

- Which stage you're at
- The exact next action
- Pending decisions

**Example (`STATUS.md`):**

```markdown
## Pipeline

analyse → critique → design → test → implement → review → document

Legend: ✅ done · 🚧 in progress · ⬜ not started

| Domain | Feature      | analysed | critiqued | designed | tested (red) | implemented |
| ------ | ------------ | -------- | --------- | -------- | ------------ | ----------- |
| novels | create-novel | ✅       | ✅        | ✅       | ⬜           | ⬜          |

**Scope (narrowed 2026-10-27):** only **creating a novel** is specified.

## Next action

**Stage 4 — write the tests, then implement `create-novel`.** Run
`/spec-test novels/create-novel` to write the red tests, then
`/spec-implement novels/create-novel` until tests pass.

Prerequisites: `npm install` and PostgreSQL running with `.env` filled in.
```

### Update Rules

**Who updates `STATUS.md`:**

- **Stage agents** (analyst, critic, architect, test-author, implementer):
  - Tick their stage's column for the feature
  - Set the `## Next action` to the next command (or the blocker)
  - Then print the `[STATUS]` line
- **User:**
  - Append to the `README.md` history log for decisions/reversals
  - Correct `STATUS.md` if a stage left it wrong

**When to update:**

- At the **end of a flow** (after implement completes)
- When **genuinely blocked** (needs user input)
- When **scope changes** (feature added/removed/narrowed)

### The History Log: `README.md`

The README's **"Progress log"** is a **decisions log**:

- Record the _why_ (decisions, reversals, conventions)
- Git already tracks the _what_ (file changes)

**What to log:**

- Stack changes (MERN → PERN)
- Scope changes (narrowed to one feature)
- Conventions decided (genre dropdown, picture limits)
- Workflow improvements (orchestrator added)

**What NOT to log:**

- Routine file creation
- Test passes
- Code refactors
- Bug fixes

---

## Quick Reference

### Commands

Each command file (`.kilo/command/*.md`) names the agent it runs; that agent's
file (`.kilo/agent/*.md`) is loaded as the system prompt. Every command also gets
`AGENTS.md` + `.kilo/rules/core.md` injected. The model and each stage's step
budget come from the root config `.kilo/kilo.json` (top-level `model` + an
`agent` block with `steps` per agent), so every agent runs on the same settings.

| Command                                    | Agent             | Agent file                          | Stage | Produces                                 | Status line                                          |
| ------------------------------------------ | ----------------- | ----------------------------------- | ----- | ---------------------------------------- | ---------------------------------------------------- |
| `/spec-analyse <description>`               | spec-analyst      | `.kilo/agent/spec-analyst.md`       | 1     | `requirements.md` + `.feature`           | `analysed done`                                      |
| `/spec-analyse <domain>/<feature> --revise` | spec-analyst      | `.kilo/agent/spec-analyst.md`       | 1     | edited `.feature` (+ `requirements.md`)  | `analysed done`                                      |
| `/spec-critique <domain>/<feature>`        | spec-critic       | `.kilo/agent/spec-critic.md`        | 2     | `.review.md` with verdict                | `critiqued done` / `critiqued blocked: spec-change-required` |
| `/spec-design <domain>/<feature>`          | spec-architect    | `.kilo/agent/spec-architect.md`     | 3     | `.design.md` + `data-model.md`           | `designed done`                                      |
| `/spec-test <domain>/<feature>`            | spec-test-author  | `.kilo/agent/spec-test-author.md`   | 4     | tests (red/failing)                      | `tested-red done`                                    |
| `/spec-implement <domain>/<feature>`       | spec-implementer  | `.kilo/agent/spec-implementer.md`   | 5     | app code (green)                         | `implemented done`                                   |
| `/spec-flow <description>` _(suspended)_   | spec-orchestrator | `.kilo/agent/spec-orchestrator.md`  | all   | whole chain                              | `… done`                                             |

### Inputs → outputs per stage (what each agent reads and writes)

Each row is *in addition to* the always-loaded `AGENTS.md` + `.kilo/rules/core.md`.

| Stage | Agent | Reads | Writes |
| ----- | ----- | ----- | ------ |
| 1 Analyse | spec-analyst | your description / `--revise` text · `spec/domains/<domain>/requirements.md` (if any) · `ui/*.ui.md` | `spec/domains/<domain>/requirements.md`, then `spec/features/<domain>/<feature>.feature` |
| 2 Critique | spec-critic | `.feature` · `requirements.md` · `ui/*.ui.md` · sibling features | `spec/features/<domain>/<feature>.review.md` |
| 3 Design | spec-architect | `.feature` · `.review.md` (must be `Approved for design`) · `requirements.md` · `ui/*.ui.md` | `spec/features/<domain>/<feature>.design.md`, `spec/domains/<domain>/data-model.md` |
| 4 Test | spec-test-author | `.feature` · `.design.md` (fixtures section) · `data-model.md` | `app/tests/e2e/**`, `app/tests/api/**`, `app/tests/e2e/fixtures/**` |
| 5 Implement | spec-implementer | `.feature` · `.design.md` · `data-model.md` · existing `app/tests/**` | `app/**`, root `package.json` |

### Files by Stage

| Stage        | Files Created                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Analyse   | `spec/domains/<domain>/requirements.md`<br>`spec/features/<domain>/<feature>.feature`                                                                 |
| 2. Critique  | `spec/features/<domain>/<feature>.review.md`                                                                                                          |
| 3. Design    | `spec/features/<domain>/<feature>.design.md`<br>`spec/domains/<domain>/data-model.md`                                                                 |
| 4. Test      | `app/tests/e2e/<domain>/<feature>.spec.js`<br>`app/tests/api/<domain>/<feature>.postman_collection.json`<br>`app/tests/e2e/fixtures/*`                |
| 5. Implement | `app/server/src/routes/*`<br>`app/server/src/controllers/*`<br>`app/server/migrations/*`<br>`app/client/src/pages/*`<br>`app/client/src/components/*` |

### The Chain

```
You: "I want users to create novels..."
  ↓
[1] /spec-analyse → requirements.md + .feature
  ↓
[2] /spec-critique → .review.md (Approved for design?)
  ↓ (if Changes required → /spec-analyse --revise → /spec-critique again)
  ↓
[3] /spec-design → .design.md + data-model.md
  ↓
[4] /spec-test → tests (red)
  ↓
[5] /spec-implement → code (green)
  ↓
Done! Feature implemented and tests pass.
```

### Ownership Rules

| Agent                           | Can Edit                               | Cannot Edit                                  |
| ------------------------------- | -------------------------------------- | -------------------------------------------- |
| spec-analyst                    | `requirements.md`, `.feature`          | Everything else                              |
| spec-critic                     | `.review.md`                           | `.feature`, `requirements.md`                |
| spec-architect                  | `.design.md`, `data-model.md`          | `.feature`, `requirements.md`                |
| spec-test-author                | `app/tests/**`                         | `.feature`, `app/server/**`, `app/client/**` |
| spec-implementer                | `app/**`                               | `.feature`, `requirements.md`                |
| spec-orchestrator _(suspended)_ | `STATUS.md`, `README.md` | `.feature`                                   |

---

## Summary

This is how the spec-driven pipeline works:

1. **You describe a feature in plain English**
2. **The analyst** writes numbered requirements + Gherkin scenarios
3. **The critic** reviews them and gates design with a verdict
4. **The architect** writes the technical design (API + data model + UI + test plan)
5. **The test-author** writes failing tests proving the scenarios
6. **The implementer** writes code until tests pass

Each stage reads the previous stage's output. Specs are frozen after analysing.
You control the pace (one stage, review, next). The automatic driver
(`/spec-flow`) is **suspended** as of 2026-10-27, so for now the flow is always
manual.

Files are the source of truth. `STATUS.md` tells any session
where to resume. The README progress log records decisions (the _why_), not
changes (git handles the _what_).

The result: a working application that exactly matches your requirements, with
every line of code traced back to a frozen spec, tested end-to-end, and ready to
deploy.
