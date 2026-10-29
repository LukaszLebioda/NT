# Novels — Shared data model

**Status:** design (draft for implementation)
**Date:** 2026-10-27
**Scope (narrowed 2026-10-27):** the domain currently specifies **creating a
novel** only. Authentication and per-user ownership, listing/filtering, editing,
and deleting are deferred; their model parts are removed here and will return
with those features.
**Inputs:** `spec/domains/novels/requirements.md` and
`spec/features/novels/create-novel.feature`.
**Consumers:** `create-novel.design.md`.

This is the single source of truth for the novels tables, the shared `NovelDto`,
the endpoint index, and the error envelope used by the create feature.

## 1. Scope

The novels domain owns exactly two tables: `novels` and `novel_genres`. There is
no `user_id` column and no dependency on a users table for now: per-user
ownership arrives with the deferred authentication feature. Every row in
`novels` is one novel entry.

## 2. Tables

### 2.1 `novels`

```sql
CREATE TABLE novels (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author             text NOT NULL,
  title_pl           text NOT NULL,
  title_original     text NOT NULL,
  published_year     smallint NOT NULL,
  description        text,
  picture_key        text,
  picture_mime       varchar(32),
  picture_size_bytes integer,
  is_favourite       boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT novels_author_not_blank
    CHECK (btrim(author) <> ''),
  CONSTRAINT novels_title_pl_not_blank
    CHECK (btrim(title_pl) <> ''),
  CONSTRAINT novels_title_original_not_blank
    CHECK (btrim(title_original) <> ''),
  CONSTRAINT novels_year_range
    CHECK (published_year BETWEEN 1000 AND 9999),
  CONSTRAINT novels_picture_mime_allowed
    CHECK (picture_mime IS NULL OR picture_mime IN
      ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  CONSTRAINT novels_picture_size_range
    CHECK (picture_size_bytes IS NULL OR
           picture_size_bytes BETWEEN 1 AND 5242880),
  CONSTRAINT novels_picture_consistent
    CHECK (
      (picture_key IS NULL AND picture_mime IS NULL AND picture_size_bytes IS NULL)
      OR
      (picture_key IS NOT NULL AND picture_mime IS NOT NULL AND picture_size_bytes IS NOT NULL)
    ),
  CONSTRAINT novels_picture_key_unique UNIQUE (picture_key)
);

CREATE FUNCTION novels_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER novels_touch_updated_at
BEFORE UPDATE ON novels
FOR EACH ROW EXECUTE FUNCTION novels_touch_updated_at();
```

`gen_random_uuid()` is built in to PostgreSQL 13+ (our image is PostgreSQL 16),
so no extension is required.

Column notes:

| Column | Notes |
|---|---|
| `id` | Opaque `uuid` identifier, the API's target for a novel. |
| `author` | Trimmed by the API; blank is rejected. |
| `title_pl` | Polish title. (A Polish ICU collation will be added together with A-Z sorting when the list feature arrives.) |
| `title_original` | Original title. |
| `published_year` | `smallint` is sufficient for 1000-9999 and makes the range explicit. |
| `description` | `NULL` means "no description yet". The API trims and converts an empty/whitespace-only value to `NULL`. No length limit is set because no requirement sets one. |
| `picture_key` | Relative storage key such as `novels/2026/10/<uuid>.jpg`. Never an absolute path, a client filename, or a public URL. `NULL` means the default book icon. |
| `picture_mime` | MIME type detected from file content, not the client-declared one. |
| `picture_size_bytes` | Detected size. The check encodes the 5 MB ceiling: 5,242,880 bytes; exactly 5 MB is valid. |
| `is_favourite` | Set at creation; defaults to `false`. |
| `created_at`, `updated_at` | `updated_at` is maintained by the trigger. |

`picture_key`, `picture_mime` and `picture_size_bytes` are all-or-nothing via
`novels_picture_consistent`, preventing a row that claims a picture without a
file reference or vice versa.

### 2.2 `novel_genres`

```sql
CREATE TABLE novel_genres (
  novel_id uuid NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  genre    text NOT NULL,
  PRIMARY KEY (novel_id, genre),
  CONSTRAINT novel_genres_allowed CHECK (genre IN (
    'Fantasy', 'Science Fiction', 'Horror', 'Thriller', 'Mystery',
    'Crime', 'Romance', 'Historical', 'Adventure', 'Literary',
    'Drama', 'Poetry', 'Non-fiction', 'Biography', 'Other'
  ))
);
```

- The composite primary key makes a genre unique within one novel.
- `ON DELETE CASCADE` removes genre rows with the novel.
- The `CHECK` is the database-level copy of the fixed allowed list; the list is
  revisable, so changing it is a migration plus a shared constant update.

### 2.3 Why a join table instead of a PostgreSQL array

**Decision: `novel_genres` join table.**

| Concern | Join table (chosen) | `text[]` column |
|---|---|---|
| Allowed values | Per-row `CHECK`; an unsupported genre cannot be stored | Array `CHECK` is possible but easier to bypass in application code |
| Duplicates | Composite primary key prevents them | Application must dedupe |
| Referential integrity | FK cascade with the novel | No FK |
| Future genre filtering | Plain indexed join | Requires `unnest` or a GIN index |

The constraints (allowed values, no duplicates, cascade) match the rules
directly, so the join table is the better fit for this domain.

### 2.4 Canonical genre list and display order

The fixed list, in canonical order, is:

```text
Fantasy, Science Fiction, Horror, Thriller, Mystery, Crime, Romance,
Historical, Adventure, Literary, Drama, Poetry, Non-fiction, Biography, Other
```

The API returns `genres` sorted by this order. The list is a shared constant in
the server validation module and is also exposed by `GET /api/genres` so the
client does not hard-code a second copy.

## 3. Picture storage

Pictures are files on the API host's upload volume, not bytes in PostgreSQL. The
database stores only the reference and metadata:

- `picture_key` — relative key under the configured uploads root.
- `picture_mime` — MIME detected from file content.
- `picture_size_bytes` — detected byte size.

Rules enforced by the API and reflected in the schema:

| Rule | Enforcement |
|---|---|
| Formats JPEG, PNG, WebP, GIF | Magic-byte detection; MIME allow-list; extension derived from the detected type, never trusted from the client |
| At most 5 MB | Multipart limit `5 * 1024 * 1024`; DB check; exactly 5,242,880 bytes accepted |
| Client filename | Never used for storage; a generated UUID key plus a canonical extension |
| Path traversal | Only server-generated keys; no client-supplied path segments |
| Active content | Raster formats only; no SVG. Responses set `X-Content-Type-Options: nosniff`, `Content-Type` from `picture_mime`, `Content-Disposition: inline` |
| Cache | `Cache-Control: private, max-age=300` plus an `ETag`; the DTO URL includes a `?v=<updated_at>` token so a replacement is not masked by a stale cache |

## 4. Shared read model — `NovelDto`

The create endpoint returns this shape.

```ts
export type Genre =
  | 'Fantasy' | 'Science Fiction' | 'Horror' | 'Thriller' | 'Mystery'
  | 'Crime' | 'Romance' | 'Historical' | 'Adventure' | 'Literary'
  | 'Drama' | 'Poetry' | 'Non-fiction' | 'Biography' | 'Other';

export interface NovelDto {
  id: string;            // uuid
  author: string;
  titlePl: string;
  titleOriginal: string;
  year: number;
  genres: Genre[];
  description: string | null;
  picture: null | {
    url: string;          // /api/novels/:id/picture?v=<updatedAt epoch ms>
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  };
  isFavourite: boolean;
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
}
```

- `description` is the full text; a client preview is computed from it later.
- `picture` is `null` exactly when `picture_key` is `NULL`; the UI then renders
  the default book icon.
- `genres` is never empty for a stored row.

## 5. API conventions

### 5.1 Endpoint index

All paths are under `/api`. Only the endpoints needed by the create feature are
specified; listing, reading, editing, and deleting return with their features.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/novels` | Create one entry (multipart, optional picture) |
| `GET` | `/novels/:id/picture` | Serve the stored picture for a novel |
| `GET` | `/genres` | The canonical genre list (static, no user data) |

### 5.2 Content types and field names

- `POST /novels` is always `multipart/form-data`. Text fields are strings;
  `genres` is repeated once per genre; `isFavourite` is `"true"` or `"false"`;
  `picture` is an optional single file part.
- JSON uses camelCase (`titlePl`, `titleOriginal`, `isFavourite`); the database
  uses snake_case. The API layer is the only mapping point.
- Unknown multipart fields are ignored, not silently persisted.

### 5.3 Error envelope

```json
{
  "error": {
    "code": "validation_error",
    "message": "Validation failed",
    "fields": {
      "year": "The year must be a valid 4-digit year (1000–9999)"
    }
  }
}
```

`fields` is optional; it is present for field-level validation and keyed by the
API field names (`author`, `titlePl`, `titleOriginal`, `year`, `genres`,
`description`, `picture`). A single request may return several field errors.

| Code | HTTP | Meaning |
|---|---|---|
| `validation_error` | 400 | One or more fields are missing, blank, out of range, or not allowed |
| `picture_invalid_type` | 400 | The uploaded file is not JPEG, PNG, WebP, or GIF by content |
| `picture_too_large` | 413 | The uploaded file is larger than 5 MB |
| `internal_error` | 500 | Unexpected server failure |

Canonical validation messages (the UI displays these, and tests assert them):

| Field | Message |
|---|---|
| `author` | `The author is required` |
| `titlePl` | `The Polish title is required` |
| `titleOriginal` | `The original title is required` |
| `year` (missing) | `The year is required` |
| `year` (invalid) | `The year must be a valid 4-digit year (1000–9999)` |
| `genres` (empty) | `At least one genre is required` |
| `genres` (not allowed) | `Each genre must be one of the allowed options` |
| `picture` (type) | `The picture must be a JPEG, PNG, WebP, or GIF file` |
| `picture` (size) | `The picture must be at most 5 MB` |

## 6. Create transaction and file lifecycle

| Step | Detail |
|---|---|
| Validate | Fields, genres, and file |
| Write file | Write the validated picture to its final generated key (if one was uploaded) |
| Transaction | Insert the `novels` row; insert one `novel_genres` row per genre; commit |
| On failure | Unlink the new file; no row is committed without its file |

## 7. Invariants

1. Required text fields are trimmed and non-blank.
2. `published_year` is an integer in 1000-9999.
3. A novel has at least one genre; every genre is from the canonical list; no
   duplicates.
4. `description` is either `NULL` or non-blank text; whitespace-only becomes
   `NULL`.
5. A picture is either absent (`NULL` reference) or a validated file with one of
   the four MIME types and size 1-5,242,880 bytes.
6. `is_favourite` defaults to `false`.
7. Two entries may share a title, author, year, genres, and picture; there is no
   duplicate-entry constraint.
8. There is no soft delete, undo, or restore state.

## 8. Migration order

Apply in this order:

1. `novels` and its constraints.
2. `novels_touch_updated_at()` and the `novels_touch_updated_at` trigger.
3. `novel_genres`.

Rollback drops the tables in reverse order after dropping the trigger; dropping
`novels` cascades `novel_genres`.

## 9. Out of scope (deferred)

- Authentication and per-user ownership (the `user_id` column returns with it).
- Listing, sorting, filtering, the A-Z view, and its indexes.
- Editing, deleting, and favourite marking after creation.
- Shared/public books, sharing, or collaborative editing.
- A separate genre catalogue table or user-managed genres.
- Picture cropping, multiple pictures per novel, external picture URLs, or
  picture removal.
- Pagination, sorting options, combined filters, and genre filters.
- Soft delete, undo, and delete confirmation.
- Description length limits and full-text search.
- Optimistic concurrency control.
