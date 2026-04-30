# Dev Tools

Use this guide when you need deterministic app state, direct route entry, or
debug-only overrides during local development.

## URL Params

| Param | Values | Effect |
| --- | --- | --- |
| `?convention=<id>` | `nt-bundle`, `stayman-bundle`, `jacoby-transfers-bundle`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle`, `michaels-unusual-bundle`, `strong-2c-bundle`, `negative-doubles-bundle`, `nmf-bundle` | Select convention and open the game screen. `?learn=stayman` resolves module-first; `?learn=nt-bundle` falls back to bundle filter behavior. |
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

## Debug Drawer Dev Actions

Open the debug drawer (`?dev=debug` or the bug-toggle button in the game header) to access phase-aware shortcut buttons at the top of the panel. They wrap existing store methods so you can skip the manual UI flow.

Each row shows a button on the left and a one-line summary on the right; click "Show details" to expand each row with a longer description of subtle behavior. Every button also carries a `title=` tooltip.

| Phase | Action | Effect |
| --- | --- | --- |
| `BIDDING` | `Bid expected` | Submit the strategy's recommended bid for this turn. Falls back to **Pass** if no convention rule matches your hand. |
| `BIDDING` | `Pass` | Submit a single Pass for the current user turn. |
| `BIDDING` | `Finish auction` | Auto-bid your remaining turns (expected bid per turn, Pass on undefined). Lands in `DECLARER_PROMPT`, or `EXPLANATION` if all-pass. |
| `BIDDING` | `Skip to playing` | Same as `Finish auction`, then auto-accepts the prompt. **Silently swaps your seat to declarer if your partner declares.** |
| `BIDDING` | `Skip to review` | Same as `Finish auction`, then auto-declines the prompt. The hand is not played. |
| `DECLARER_PROMPT` | `Accept (play)` | Enter `PLAYING`. Same swap behavior as the regular Accept button. |
| `DECLARER_PROMPT` | `Skip to review` | Decline the prompt and jump to `EXPLANATION` without playing. |
| `PLAYING` | `Auto-play to end` | Finish the hand and land in review with the full play log captured. **User seats use first-legal-play (NOT DDS-best);** opponents use the configured play profile (Expert+ uses DDS). No animation. |
| `PLAYING` | `Restart play` | Restart from trick 1 of the current contract; auction unchanged. |
| `PLAYING` | `Abandon hand` | Hard skip — flips phase to `EXPLANATION` mid-trick without finishing the hand. Use `Auto-play to end` if you want a completed play log. |
| `EXPLANATION` | `Next deal` | New deal. In multi-module drills, rotates round-robin to the next module. |
| `EXPLANATION` | `Play this hand` | Re-enter `PLAYING` for the same contract. Only shown when a contract exists. |
| `EXPLANATION` | `Back to menu` | Reset session and navigate to `/practice`. |

Persistent toggles (`Autoplay`, `Auto-dismiss`) sit at the bottom — equivalent to the `?dev=autoplay` / `?dev=autoDismiss` URL flags but flippable mid-session. Both **persist across deals** until toggled off. Auto-dismiss only retries *blocking* (wrong-bid) feedback, not non-blocking greens. All buttons disable while `gameStore.isProcessing` (which includes the initial AI bids of a fresh deal).

## Test IDs

- Bid buttons: `data-testid="bid-{callKey}"` such as `bid-1C`, `bid-7NT`, `bid-P`, `bid-X`, `bid-XX`
- Bid containers: `level-bids`, `special-bids`
- Dev-action buttons: `data-testid="dev-{action}"` such as `dev-finish-auction`, `dev-skip-to-review`, `dev-autoplay-hand`, `dev-abandon-hand`, `dev-toggle-autoplay`, `dev-toggle-details`
