# create-novel.feature — Spec review

Reviewer: spec-critic · Date: 2026-10-27
Scope reviewed: `create-novel.feature` (20 scenarios) and rules
`REQ-001…REQ-011`, `REQ-037`, `REQ-038`, `REQ-039`.

**Scope note:** the feature was narrowed on 2026-10-27. Authentication and
per-user ownership are deferred; the former "anonymous cannot add" scenario
(REQ-012) and the signed-in background were removed, and the success assertions
changed from list-rendering to stored state.

Mechanical checks: every scenario carries at least one valid
`@req:novels#REQ-nnn`; every tag resolves to an existing REQ; no `@todo`
remains. All create-side REQs (REQ-001…REQ-011, REQ-037, REQ-038, REQ-039) are
proven by this feature.

## Blocking issues

None.

## Warnings

- **REQ-008 message drift.** REQ-008 requires reporting "each genre must be one
  of the allowed options"; *…genre outside the dropdown list* and *…mix of
  allowed and disallowed genres* both assert "the genre must be one of the
  allowed options". Align the wording.
- **Whitespace-only Author scenario uses a non-standard step shape.**
  *Attempt to add a novel with a whitespace-only author* pairs a bespoke step
  with "the user enters the following details", unlike every sibling's single
  details table. REQ-002 says only that the author is "missing"; treating a
  present-but-blank value as missing is sensible but not stated in the rule.
- **Under-tagging.** *Add a novel with a picture upload* asserts the REQ-009/011
  defaults ("no picture", "no description") but is tagged only REQ-001/REQ-038.
- **`[INFERRED]` reliance** remains (year range, picture formats, default icon);
  mitigated because each is promoted to a REQ (REQ-007, REQ-010, REQ-009).

## Edge cases missed

- Year values that are **4 digits but out of range** (`0999`, `0100`, `0000`) —
  REQ-007 says "between 1000 and 9999", but only 3-digit `999` and 5-digit
  `10000` cover the boundaries.
- Picture format detection for an uppercase extension (`.JPG`) or a
  renamed/spoofed file (a `.pdf` renamed `.jpg`).
- An **empty-string** genre entry versus "no genre selected".
- Adding the **same book twice** (duplicate entries) — no rule.
- Oversized description / any description length limit — no rule.
- **Whitespace-only Polish title / Original title** (only Author is covered).

## Coverage gaps

- This feature covers REQ-001…REQ-011 and REQ-037/REQ-038/REQ-039 in full.
- REQ-010's accepted formats are proven for a `.png` (size edges); a valid
  JPEG/GIF/WebP success upload is not individually exercised.

## Suggested scenarios

- Create with year `0999` and `0000` → rejected (REQ-007, 4-digit but
  out-of-range).
- Create with an uppercase-extension picture (`cover.JPG`) → accepted, or
  rejected under a stated policy.
- Create with a whitespace-only Polish title / Original title → rejected
  (REQ-003/REQ-004).

**Verdict:** Approved for design
