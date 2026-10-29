# Create a novel — Design

**Status:** design (draft for implementation)
**Date:** 2026-10-27
**Feature:** `spec/features/novels/create-novel.feature` (20 scenarios)
**Review gate:** `create-novel.review.md`
**Shared model:** [`../../domains/novels/data-model.md`](../../domains/novels/data-model.md)

**Scope (narrowed 2026-10-27):** authentication and per-user ownership are
**deferred**. This design has no login, no `requireAuth`, and no `user_id`: the
create endpoint is open for now. Ownership, listing, editing, and deleting return
with their own features.

This design adds no new behaviour beyond the feature and
REQ-001…REQ-011, REQ-037…REQ-039.

## 1. API contract

### 1.1 `POST /api/novels`

Creates one entry.

| Property | Value |
|---|---|
| Method / path | `POST /api/novels` |
| Content type | `multipart/form-data` |
| Success | `201 Created`, body `NovelDto` |
| Side effects | Inserts one `novels` row, one or more `novel_genres` rows, and optionally one stored picture file |

Request fields (multipart parts):

| Field | Type | Required | Rules |
|---|---|---|---|
| `author` | text | yes | Trimmed; non-blank (REQ-002) |
| `titlePl` | text | yes | Trimmed; non-blank (REQ-003) |
| `titleOriginal` | text | yes | Trimmed; non-blank (REQ-004) |
| `year` | text integer | yes | Integer 1000-9999 (REQ-005, REQ-007) |
| `genres` | repeated text | yes (≥1) | Each value from the canonical list; duplicates de-duplicated; at least one remains (REQ-006, REQ-008) |
| `description` | text | no | Trimmed; empty/whitespace-only becomes `NULL` (REQ-011, REQ-039) |
| `isFavourite` | `"true"` / `"false"` | no | Defaults to `false` (REQ-037) |
| `picture` | one file | no | JPEG/PNG/WebP/GIF by magic bytes, ≤ 5,242,880 bytes (REQ-010, REQ-038) |

Example success response:

```json
{
  "id": "3f2a9c1e-6b7d-4e8f-9a0b-1c2d3e4f5a6b",
  "author": "J.R.R. Tolkien",
  "titlePl": "Władca Pierścieni",
  "titleOriginal": "The Lord of the Rings",
  "year": 1954,
  "genres": ["Fantasy", "Adventure"],
  "description": null,
  "picture": null,
  "isFavourite": false,
  "createdAt": "2026-10-27T08:00:00.000Z",
  "updatedAt": "2026-10-27T08:00:00.000Z"
}
```

With a picture, `picture` is
`{ "url": "/api/novels/3f2a9c1e-6b7d-4e8f-9a0b-1c2d3e4f5a6b/picture?v=1761206400000", "mimeType": "image/jpeg" }`.

### 1.2 Supporting reads used by this feature

| Method / path | Why |
|---|---|
| `GET /api/genres` | Populates the multi-select with the canonical list. Static response `{ "items": Genre[] }`, no user data. |
| `GET /api/novels/:id/picture` | Renders the uploaded picture/thumbnail. |

There is no `GET /api/novels` list endpoint yet — the collection view is a
deferred feature.

### 1.3 Error responses

| Status | Code | When |
|---|---|---|
| `400` | `validation_error` | `author`, `titlePl`, `titleOriginal`, or `year` missing/blank; `year` not an integer or outside 1000-9999; no `genres`; any genre outside the list |
| `400` | `picture_invalid_type` | file content is not JPEG/PNG/WebP/GIF (including a renamed PDF) |
| `413` | `picture_too_large` | file is larger than 5 MB |
| `500` | `internal_error` | unexpected failure; nothing is committed |

The body follows the shared envelope; `fields` carries one entry per invalid
field. When several fields are invalid, all field errors are returned together.
On every failure, no `novels` row, no `novel_genres` row, and no stored file
remains. The client stays on the form and displays the message(s).

## 2. Data model

No schema change is introduced by this feature beyond the shared model. It
performs the first writes to the shared tables:

| Table | Write |
|---|---|
| `novels` | One row: `author`, `title_pl`, `title_original`, `published_year`, `description`, `picture_key/mime/size`, `is_favourite` |
| `novel_genres` | One row per selected genre; the composite PK prevents duplicates |

Details:

- `published_year` is `smallint`; 1000 and 9999 are accepted.
- `description` is `NULL` when absent or blank.
- `picture_key` is a server-generated relative key; the client filename is not
  stored. `picture_mime` and `picture_size_bytes` are detected values.
- Insert of `novels` and `novel_genres` is one transaction. The picture file is
  written before the transaction; on failure it is unlinked.
- No uniqueness constraint exists on title/author/year. Adding the same book
  twice creates two independent entries; no rule forbids it.

## 3. UI plan

### 3.1 Route and components

| Item | Design |
|---|---|
| Route | `/novels/new` |
| Page | `NovelCreatePage` |
| Form | `NovelForm` with `mode="create"` |
| Controls | `TextField` (Author, Polish title, Original title), `YearField`, `GenreMultiSelect`, `PictureField`, `DescriptionField`, `FavouriteField`, `FormErrors`, `FormActions` |
| Shared shell | `AppLayout` |
| After success | Show a success confirmation and keep the form available for another entry (the collection list is a deferred feature) |
| Cancel | Reset the form |

Mapping from the rules to components:

| Element | Component |
|---|---|
| Author / Polish title / Original title text boxes | `TextField` |
| Year number field with spinner | `YearField` — text input with `inputMode="numeric"` and custom up/down stepper buttons; validates `^\d{4}$` and 1000-9999 on submit |
| Genre multi-select dropdown | `GenreMultiSelect` (checkbox list in a popover; options from `GET /api/genres`) |
| Picture image picker + preview thumbnail | `PictureField` (file input, preview via `URL.createObjectURL`, accepts the four extensions) |
| Description auto-growing text box | `DescriptionField` (textarea that grows with content) |
| Favourite checkbox | `FavouriteField` (label "Mark as favourite (asterisk)") |
| Save / Cancel | `FormActions` |

### 3.2 State

`NovelForm` owns:

```ts
{
  values: {
    author: string;
    titlePl: string;
    titleOriginal: string;
    year: string;          // input value; parsed on submit
    genres: Genre[];
    description: string;
    isFavourite: boolean;
  };
  pictureFile: File | null;
  picturePreviewUrl: string | null;
  errors: Record<string, string>;   // API field names
  submitError: string | null;       // picture size/type, network, 500
  isSubmitting: boolean;
}
```

- The year is held as a string while typing and validated on submit; the API
  receives an integer.
- The form uses application-level validation (`noValidate`), so the canonical
  messages are shown instead of browser-native bubbles.
- `GenreMultiSelect` may be left empty; the app shows "At least one genre is
  required" on submit. The Save button is not disabled for validation failures
  (only while submitting).
- `PictureField` pre-checks `file.size > 5 * 1024 * 1024` and the extension for
  immediate feedback; the server's magic-byte check is authoritative.
- Values survive a failed submit; the form is not reset.

### 3.3 Flow

1. On mount, fetch `GET /api/genres` (or use a cached constant) to fill the
   multi-select.
2. Submit builds `FormData` with all text fields, repeated `genres` parts,
   `isFavourite`, and the optional `picture` file.
3. `201`: show a success notice, keep the form for another entry.
4. `400`/`413`: stay on the form, map `error.fields` to inline errors, show
   `error.message` for picture errors.

## 4. Test plan

### 4.1 Playwright (primary for UI behaviour)

File: `app/tests/e2e/novels/create-novel.spec.js`.

| # | Scenario | Playwright assertion | Newman |
|---|---|---|---|
| C1 | Add a new novel with all required fields | Fill form, save, see success | `POST` 201 |
| C2 | Add a novel with more than one genre | Select Fantasy + Adventure | `POST` 201; `genres` = both |
| C3 | Create a novel marked as a favourite at creation | Check favourite | `POST` 201; `isFavourite:true` |
| C4 | Add a novel with a picture upload | Upload `cover.jpg`; thumbnail shown | `POST` 201; `picture` non-null |
| C5 | Attempt to add a novel with an unsupported picture format | Upload `cover.pdf`; message | `POST` 400 `picture_invalid_type` |
| C6 | Attempt to add a novel with a picture larger than 5 MB | Upload `huge-cover.png`; message | `POST` 413 `picture_too_large` |
| C7 | Add a novel with a description | Fill description | `POST` 201; `description` stored |
| C8 | Attempt to add a novel without an author | Blank author; error | `POST` 400; `fields.author` |
| C9 | Attempt to add a novel without a Polish title | Blank title; error | `POST` 400; `fields.titlePl` |
| C10 | Attempt to add a novel without an original title | Blank title; error | `POST` 400; `fields.titleOriginal` |
| C11 | Attempt to add a novel without a year | Blank year; error | `POST` 400; `fields.year` |
| C12 | Attempt to add a novel with no genre selected | No genre; error | `POST` 400; `fields.genres` |
| C13 | Attempt to add a novel with a non-numeric year | "eighteen-thirty-four"; error | `POST` 400; `fields.year` |
| C14 | Attempt to add a novel with a 3-digit year | `999`; error | `POST` 400; `fields.year` |
| C15 | Attempt to add a novel with a 5-digit year | `10000`; error | `POST` 400; `fields.year` |
| C16 | Attempt to add a novel with a genre outside the dropdown list | API-only payload | `POST` 400; `fields.genres` |
| C17 | Boundary years are accepted (outline) | `1000`, `9999` | `POST` 201 each |
| C18 | Add a novel with a picture of exactly 5 MB | Upload `exactly-5mb.png` | `POST` 201 |
| C19 | Attempt to add a novel with a mix of allowed and disallowed genres | API-only payload | `POST` 400; `fields.genres` |
| C20 | Attempt to add a novel with a whitespace-only author | `"   "`; error | `POST` 400; `fields.author` |

For C16 and C19 the UI is a constrained multi-select, so Playwright cannot
originate an out-of-list genre; the server rejection is covered by Newman.

### 4.2 Newman / Postman

File: `app/tests/api/novels.postman_collection.json`, folder **Create novel**.
Each request asserts status, `error.code`/`fields`, and the response schema.

### 4.3 Fixtures and setup

- `cover.jpg`, `cover.png`, `cover.webp`, `cover.gif` — small valid images.
- `cover.pdf` (rejected by magic bytes).
- `huge-cover.png` — 5,242,881+ bytes.
- `exactly-5mb.png` — exactly 5,242,880 bytes and a valid PNG.
- Fixtures live in `app/tests/e2e/fixtures/images/`.

## 5. Traceability

| Scenario | REQ | Endpoint(s) | UI component(s) | Primary test |
|---|---|---|---|---|
| Add a new novel with all required fields | REQ-001, 009, 011 | `POST /novels` | `NovelCreatePage`, `NovelForm` | Playwright C1 |
| Add a novel with more than one genre | REQ-001, 008 | `POST /novels` | `GenreMultiSelect` | Playwright C2 |
| Create a novel marked as a favourite at creation | REQ-037 | `POST /novels` | `FavouriteField` | Playwright C3 |
| Add a novel with a picture upload | REQ-001, 038 | `POST /novels`; `GET /novels/:id/picture` | `PictureField` | Playwright C4 |
| Attempt to add a novel with an unsupported picture format | REQ-010 | `POST /novels` | `PictureField`, `FormErrors` | Playwright C5 + Newman C5N |
| Attempt to add a novel with a picture larger than 5 MB | REQ-010 | `POST /novels` | `PictureField`, `FormErrors` | Playwright C6 + Newman C6N |
| Add a novel with a description | REQ-001, 039 | `POST /novels` | `DescriptionField` | Playwright C7 |
| Attempt to add a novel without an author | REQ-002 | `POST /novels` | `TextField`, `FormErrors` | Playwright C8 + Newman C8N |
| Attempt to add a novel without a Polish title | REQ-003 | `POST /novels` | `TextField`, `FormErrors` | Playwright C9 + Newman C9N |
| Attempt to add a novel without an original title | REQ-004 | `POST /novels` | `TextField`, `FormErrors` | Playwright C10 + Newman C10N |
| Attempt to add a novel without a year | REQ-005 | `POST /novels` | `YearField`, `FormErrors` | Playwright C11 + Newman C11N |
| Attempt to add a novel with no genre selected | REQ-006 | `POST /novels` | `GenreMultiSelect`, `FormErrors` | Playwright C12 + Newman C12N |
| Attempt to add a novel with a non-numeric year | REQ-007 | `POST /novels` | `YearField`, `FormErrors` | Playwright C13 + Newman C13N |
| Attempt to add a novel with a 3-digit year | REQ-007 | `POST /novels` | `YearField`, `FormErrors` | Playwright C14 + Newman C14N |
| Attempt to add a novel with a 5-digit year | REQ-007 | `POST /novels` | `YearField`, `FormErrors` | Playwright C15 + Newman C15N |
| Attempt to add a novel with a genre outside the dropdown list | REQ-008 | `POST /novels` | `GenreMultiSelect` | Newman C16N |
| Boundary years are accepted | REQ-007 | `POST /novels` | `YearField` | Playwright C17 + Newman C17N |
| Add a novel with a picture of exactly 5 MB | REQ-010, 038 | `POST /novels`; `GET /novels/:id/picture` | `PictureField` | Playwright C18 + Newman C18N |
| Attempt to add a novel with a mix of allowed and disallowed genres | REQ-008 | `POST /novels` | `GenreMultiSelect`, `FormErrors` | Newman C19N |
| Attempt to add a novel with a whitespace-only author | REQ-002 | `POST /novels` | `TextField`, `FormErrors` | Playwright C20 + Newman C20N |
