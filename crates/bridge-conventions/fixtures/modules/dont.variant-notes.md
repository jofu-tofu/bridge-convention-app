# DONT fixture — variant notes

This fixture (`dont.json`) encodes the **modern DONT variant**:

- `2S` is a natural single-suit spade overcall made as a direct overcall.
- `module.dont.singleSuited` explicitly **excludes spades** — the single-suited 2C relay is for a 6+ non-spade suit.
- There is no `reveal-spades-2S` surface under a `wait-reveal` state, because spades are never hidden behind a takeout double in this variant.

The **original Bergen DONT** instead treats spades as just another single-suit type: overcaller doubles to show a one-suiter, and advancer relays through 2C while overcaller reveals spades at 2S. A verify run anchored on original Bergen would therefore expect a `reveal-spades-2S` surface under `wait-reveal`.

This difference is intentional. Keep the modern variant unless a partnership explicitly requests original Bergen.

## Where the variant decision is visible in the fixture

- `module.dont.singleSuited` fact definition in `dont.json` — predicate excludes spades.
- `dont:natural-spades-2s` surface — 2S as a natural overcall (direct, not via a relay-and-reveal chain).
- `dont:bypass-spades-2s` — the competing surface path for holding spades without making a DONT call.
- Absence (by design) of any `wait-reveal` state with a `reveal-spades-2S` surface.

## For future verify runs

If ConventionForge verify or any similar authority-comparison tool flags `reveal-spades-2S` as missing, that is **expected** given the authority anchor. Do not add the surface; instead, either:

1. Keep the variant gap as an explicit "modern variant" note in the report, or
2. Re-anchor the verify run on a modern DONT reference (e.g., Bridge Guys' "modern variant" section, BridgeBum) rather than the original Bergen source.
