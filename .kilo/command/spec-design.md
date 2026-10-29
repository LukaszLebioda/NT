---
description: Design — turns an approved feature into an API/schema/UI/test design document
agent: spec-architect
arguments: <domain>/<feature-slug>
---

Run the spec-architect agent for the given feature:

$ARGUMENTS

The architect reads the feature, its review file (which must say Approved for
design), and the domain requirements.md, then writes
spec/features/<domain>/<feature-slug>.design.md with an API contract, a
PostgreSQL data model, a UI plan, a test plan, and traceability. It never edits
.feature or requirements.md.
