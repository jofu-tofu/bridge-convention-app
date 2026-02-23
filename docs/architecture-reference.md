# Architecture Reference

Detailed architecture decisions and implementation reference for the Bridge Practice App.
Source: Obsidian vault `Projects/Bridge Practice App/Architecture.md`.

## Convention Deal Constraints

| Convention        | Opener Constraints                          | Responder Constraints                                        |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------ |
| **Stayman**       | North: 15-17 HCP, balanced, no 5-card major | South: 8+ HCP, 4+ card major                                 |
| **Gerber**        | North: 15-17 HCP, balanced                  | South: 16+ HCP, slam interest                                |
| **DONT**          | East: 15-17 HCP, balanced (opens 1NT)       | South: shape for DONT overcall (single-suited or two-suited) |
| **Bergen Raises** | North: 12-21 HCP, 5+ card major             | South: 6-12 HCP, 4+ card support                             |

## Convention Implementation Pattern

Each convention is ~100-200 LOC, single file exporting a `ConventionConfig`:

- Deal constraints (HCP ranges, shape requirements per seat)
- Bidding decision tree
- Explanation templates
- Example hands

| Convention    | Trigger                                  | Key Decision Points                                             | Est. LOC |
| ------------- | ---------------------------------------- | --------------------------------------------------------------- | -------- |
| Stayman       | Partner opens 1NT, 8+ HCP + 4-card major | 2C → partner rebids 2D/2H/2S → responder's rebid                | ~150     |
| Gerber        | Partner opens 1NT/2NT, slam interest     | 4C → 4D/4H/4S/4NT (0-1-2-3 aces) → optional 5C for kings        | ~100     |
| DONT          | Opponent opens 1NT                       | Double (single suit) / 2C-2S (two-suited) → partner's responses | ~150     |
| Bergen Raises | Partner opens 1H/1S, 4+ support          | 3C (7-9), 3D (10-12 constructive), 3M (0-6 preemptive)          | ~120     |

**Variant note:** DONT has 3+ common variants (standard, modified with run-outs, Meckwell). Bergen has standard vs reverse. Variant selection must be resolved before Phase 4 implementation.

## AI Bidding Strategy

- **Partner (North):** Textbook-correct per active convention
- **Opponents (East/West):** Standard SAYC, no special conventions — realistic simulation

## AI Play Heuristics (No DDS in V1)

- 4th-best leads
- Cover honors (cover queen with king)
- Second hand low, third hand high
- Follow suit high/low
- Trump when void

**Quality bar:** AI should not make an obviously incorrect play more than once per deal on average.

## Screen Flow

```
ConventionSelect → GameScreen (Bidding) → GameScreen (Playing) → ExplanationScreen
                                                                     ↓
                                                              "Back to Menu" → ConventionSelect
                                                              "Next Deal" → GameScreen (Bidding)
```

**Error states:** Deal generation failure → retry or back to menu. Unexpected errors → back to menu.

## Game State Machine

Phases: `BIDDING | PLAYING | EXPLANATION`

- **BIDDING:** User and AI take turns bidding. Ends when 3 passes follow a bid. Sets contract, declarer, dummy.
- **PLAYING:** 13 tricks of 4 cards each. Legal play validation (must follow suit). Trick winner determined. Score calculated.
- **EXPLANATION:** Compare user bids to textbook-correct sequence. Generate annotations per bid. Convention callouts.

## Store Architecture

| Store | File             | Runes                | Responsibility                                |
| ----- | ---------------- | -------------------- | --------------------------------------------- |
| Game  | `game.svelte.ts` | `$state`, `$derived` | Current deal, auction, tricks, phase, turn    |
| App   | `app.svelte.ts`  | `$state`             | Selected convention, screen, user preferences |

## V1 → V2 Migration Path

- **DDS:** V2 adds `dds-bridge-sys` Rust crate to `src-tauri/`. Tauri IPC: `invoke('solve_deal', { deal })`. `TauriIpcEngine` implements same `EnginePort` interface.
- **Storage:** V2 replaces localStorage with SQLite via `tauri-plugin-sql` for stats/progress tracking.
- **Mobile:** If Tauri 2.0 mobile proves insufficient, entire frontend lifts into Capacitor shell. Engine has zero Tauri imports. Only native shell wrapper changes.

## ADR: TypeScript over WASM for V1 Engine

**Decision:** TypeScript
**Rationale:** V1 engine does ~100K integer ops per game (<5ms V8 execution). Bottleneck is card animations (200-500ms), not computation. WASM adds FFI complexity, toolchain burden, and slower dev velocity with zero user-perceptible benefit.
**Reversal conditions:** DDS needed in-browser, deal generation consistently >200ms, or real-time multiplayer at scale.

## Component Hierarchy (Phase 3-4)

```
App.svelte
├── ConventionSelect.svelte
├── GameScreen.svelte
│   ├── BridgeTable.svelte (4-seat layout)
│   │   ├── HandDisplay.svelte (fan of 13 cards)
│   │   │   └── Card.svelte (SVG face, flip/fly animations)
│   │   ├── TrickArea.svelte (current trick center)
│   │   └── DummyHand.svelte (face-up after opening lead)
│   ├── AuctionTable.svelte (bid history grid)
│   └── BidPanel.svelte (clickable bid buttons)
└── ExplanationScreen.svelte
    ├── BiddingReview.svelte (step-through with annotations)
    └── ConventionCallout.svelte ("This bid is Stayman because...")
```

## Phase Implementation Details

| Phase | Exit Criterion                               | Test Target         |
| ----- | -------------------------------------------- | ------------------- |
| 0     | Scaffold runs, trivial test passes           | 1 test              |
| 1     | 60+ engine tests pass in <1s                 | 60+ unit            |
| 2     | Full game simulation runs in tests           | 130+ unit           |
| 3     | Full game playable in Tauri window           | 25 component        |
| 4     | All 4 conventions correct, explanations work | 190+ unit           |
| 5     | Animations, localStorage, E2E pass           | 2-5 E2E, <40s total |
