---
description: Test authoring — turns an approved feature into Playwright (UI) and Newman (API) tests
agent: spec-tester
arguments: <domain>/<feature-slug>
---

Run the spec-tester agent for the given feature:

$ARGUMENTS

The spec-tester reads the feature, its design doc, and the data model, then
writes Playwright specs (app/tests/e2e) for UI scenarios and Postman/Newman
requests (app/tests/api) for API scenarios, one test per scenario carrying its
@req tag. It never edits specs or production code.
