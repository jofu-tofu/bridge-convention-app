# Dev Tools

Use this guide when you need deterministic app state, direct route entry, or
debug-only overrides during local development.

## URL Params

| Param | Values | Effect |
| --- | --- | --- |
| `?convention=<id>` | `nt-bundle`, `nt-stayman`, `nt-transfers`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle`, `michaels-unusual-bundle`, `strong-2c-bundle`, `negative-doubles-bundle`, `nmf-bundle` | Select convention and open the game screen. `?learn=stayman` resolves module-first; `?learn=nt-bundle` falls back to bundle filter behavior. |
| `?learn=<id>` | module or bundle ID | Open learning mode. Resolution is module-first, then bundle filter. |
| `?seed=<n>` | number | Deterministic PRNG seed. Advances per deal (`42`, `43`, `44`...). Reload resets. |
| `?phase=<name>` | `review`, `playing`, `declarer` | Jump straight to a game phase after auto-completing prior steps. Requires `?convention=`. |
| `?dev=<flags>` | comma-separated: `debug`, `expanded`, `autoplay`, `autoDismiss`, `auth:free`, `auth:premium`, `auth:expired` | Debug panel and dev-only behavior flags. |
| `?practiceMode=<mode>` | `decision-drill`, `full-auction`, `learn` | Select practice mode. |
| `?practiceRole=<role>` | `opener`, `responder`, `both` | Select the practiced seat role. |
| `?targetState=<id>`, `?targetSurface=<id>` | FSM state / meaning surface | Coverage targeting used by coverage tests. |

## Route Replacements

Old `?screen=` behavior has been replaced by routes:

- `/settings`
- `/coverage`
- `/workshop`
- `/guides/[slug]`
- `/learn/[moduleId]`

`/workshop` requires `FEATURES.workshop` and is dev-only. `/coverage` accepts
`?convention=X` for bundle-specific coverage.

Backward-compat alias: `?profiles=true` redirects to `/workshop`.

## Examples

```text
?convention=nt-bundle&seed=42
?convention=nt-bundle&seed=42&phase=review
?convention=nt-bundle&dev=debug,expanded,autoDismiss
/coverage?convention=nt-bundle
/settings
```

## CLI Pairing

- `npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=42` runs the same session flow as the UI
- `npx tsx src/cli/main.ts selftest --bundle=<id>` checks strategy self-consistency

## Test IDs

- Bid buttons: `data-testid="bid-{callKey}"` such as `bid-1C`, `bid-7NT`, `bid-P`, `bid-X`, `bid-XX`
- Bid containers: `level-bids`, `special-bids`
