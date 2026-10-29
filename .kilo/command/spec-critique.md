---
description: Spec review — critiques a feature's Gherkin and its backing requirements, always writing <feature-slug>.review.md
agent: spec-critic
arguments: <domain>/<feature-slug>
---

Run the spec-critic agent for the given feature:

$ARGUMENTS

The critic reads the feature and the domain's requirements.md, then always
writes spec/features/<domain>/<feature-slug>.review.md with blocking
issues, warnings, edge cases missed, coverage gaps, and suggested scenarios,
ending with a verdict (Approved for design | Changes required). It never edits
.feature or requirements.md.
