# Docs Map

This repo uses `docs/` as a small, predictable knowledge tree. The goal is placement by topic, not "whatever fits at the root".

## Categories

- `architecture/` — stable design decisions, specs, migration history, subsystem rationale
- `guides/` — practical how-tos and operational guidance
- `product/` — product direction, roadmap, personas, audience framing
- `research/` — evidence gathering, literature reviews, market/UX investigations, topic-local research artifacts

## Placement Rules

- Keep the root thin. `docs/` itself should contain only index files like this one, not standalone topic docs.
- Put each research topic in its own folder under `docs/research/` when it may grow supporting notes, artifacts, or follow-up analysis.
- Prefer one canonical location per topic. Link across categories instead of duplicating content.
- If a doc answers "why is the system shaped this way?", it belongs in `architecture/`.
- If a doc answers "how do I do this here?", it belongs in `guides/`.
- If a doc answers "what are we building for whom and why?", it belongs in `product/`.
- If a doc gathers evidence before or around a decision, it belongs in `research/`.

## Start Here

- Architecture work: `docs/architecture/README.md`
- Implementation how-tos: `docs/guides/`
- Local debug URL params and route shortcuts: `docs/guides/dev-tools.md`
- Deployment and release workflow: `docs/guides/deployment.md`
- Product and UX framing: `docs/product/product-direction.md`
- Research topics: `docs/research/README.md`
