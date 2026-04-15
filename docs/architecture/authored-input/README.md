# Authored Input — Architecture Notes

This folder holds design specs for the **authored-input substrate**: what convention authors write into fixtures, what must be inferred/derived versus authored, and the rules that keep authored fixtures complete, non-overlapping, and scalable as conventions grow.

Scope boundary: these docs govern the **data model for authored module/bundle content** and the rules for turning it into viewports. They do not cover the rendering layer or session/pipeline logic except where those consume authored input.

## Contents

- `reference-manual-inferred-fields.md` — design spec for generalizing the `/learn/[moduleId]` reference-page data model so every convention renders through one derivation pipeline, with typed predicates replacing free-text escape hatches and required fields forcing explicit "not applicable" reasons.

## Placement Rules

Add a doc here when a design decision governs **what authors write** for a new dimension of convention content (reference pages, drill configuration, teaching metadata, authority citations, etc.), or when a migration reshapes the authored schema meaningfully enough that future authors need a record of the intent — not just the resulting types.

Keep per-fixture authoring instructions in `docs/guides/convention-authoring.md`. This folder is for the *design* behind the schema; the guide is the *how-to* for using it.
