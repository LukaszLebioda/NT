---
description: Design — turns an approved feature into an API/schema/UI/test design document
agent: spec-designer
arguments: <domain>/<feature-slug>
---

Run the spec-designer agent for the given feature:

$ARGUMENTS

The designer reads the feature, its review file (which must say Approved for
design), and the domain requirements.md, then writes
spec/features/<domain>/<feature-slug>.design.md with an API contract, a
PostgreSQL data model, a UI plan, a test plan, and traceability. It never edits
.feature or requirements.md.
