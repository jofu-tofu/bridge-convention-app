/**
 * Bergen-specific composition: defines the Bergen skeleton and delegates to
 * the generic composeModules framework.
 *
 * Unlike the 1NT skeleton (which has a single dispatch state), the Bergen
 * skeleton has TWO dispatch-like states — one per suit (responder-r1-hearts
 * and responder-r1-spades) — because the same bid (e.g. 3H) means different
 * things depending on which major was opened. Both states are pre-populated
 * with their full transition arrays in the skeleton; modules contribute only
 * post-R1 machine states.
 *
 * Module entry surfaces and entry transitions are empty — the R1 surfaces
 * are provided via the module's surfaceGroups so that the machine-based
 * surface router correctly resolves per-suit surface groups.
 */
import type { BundleSkeleton } from "../../core/composition/compose";
import { BidSuit } from "../../../engine/types";

/**
 * The Bergen Raises bundle skeleton — shared FSM infrastructure.
 *
 * State flow:
 *   idle → major-opened-hearts / major-opened-spades (on 1H / 1S)
 *
 *   bergen-active (abstract parent — inherited interference transitions):
 *     All children inherit:
 *       → bergen-contested (on opponent double/overcall)
 *
 *     major-opened-hearts/spades → responder-r1-hearts/spades (on pass — dispatch points)
 *       → [module-owned post-R1 states]
 *     → terminal
 */
export const BERGEN_SKELETON: BundleSkeleton = {
  machineId: "bergen-conversation",
  dispatchStateId: "responder-r1-hearts",
  entrySurfaceGroupId: "bergen-entry",
  states: [
    // ─── idle ────────────────────────────────────────────────────
    {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "idle-to-major-opened-hearts",
          match: { kind: "call", level: 1, strain: BidSuit.Hearts },
          target: "major-opened-hearts",
        },
        {
          transitionId: "idle-to-major-opened-spades",
          match: { kind: "call", level: 1, strain: BidSuit.Spades },
          target: "major-opened-spades",
        },
      ],
    },

    // ─── bergen-active: abstract parent with inherited interference ─
    // All child states inherit these opponent-interference transitions.
    // No surfaceGroupId — this is an abstract container for inheritance only.
    {
      stateId: "bergen-active",
      parentId: null,
      transitions: [
        {
          transitionId: "bergen-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "bergen-contested",
        },
        {
          transitionId: "bergen-opponent-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "bergen-contested",
        },
      ],
    },

    // ─── major-opened: waiting for opponent pass or interference ─
    {
      stateId: "major-opened-hearts",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "hearts-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r1-hearts",
        },
      ],
    },
    {
      stateId: "major-opened-spades",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "spades-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r1-spades",
        },
      ],
    },

    // ─── R1 dispatch states (one per suit) ──────────────────────
    //
    // Pre-populated with transitions because the same bid encodes different
    // meanings per suit (e.g. 3H = preemptive after 1H, splinter after 1S).
    // Module entryTransitions are not used; the module plugs in only its
    // post-R1 machine states.
    //
    // Hearts: 3C=constructive, 3D=limit, 3H=preemptive, 3S=splinter, 4H=game
    {
      stateId: "responder-r1-hearts",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "r1-hearts-constructive",
          match: { kind: "call", level: 3, strain: BidSuit.Clubs },
          target: "opener-after-constructive-hearts",
        },
        {
          transitionId: "r1-hearts-limit",
          match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
          target: "opener-after-limit-hearts",
        },
        {
          transitionId: "r1-hearts-preemptive",
          match: { kind: "call", level: 3, strain: BidSuit.Hearts },
          target: "opener-after-preemptive-hearts",
        },
        {
          transitionId: "r1-hearts-splinter",
          match: { kind: "call", level: 3, strain: BidSuit.Spades },
          target: "terminal",
        },
        {
          transitionId: "r1-hearts-game",
          match: { kind: "call", level: 4, strain: BidSuit.Hearts },
          target: "terminal",
        },
        {
          transitionId: "r1-hearts-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-r1-hearts",
      entryEffects: { setCaptain: "responder" },
    },
    // Spades: 3C=constructive, 3D=limit, 3S=preemptive, 3H=splinter, 4S=game
    {
      stateId: "responder-r1-spades",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "r1-spades-constructive",
          match: { kind: "call", level: 3, strain: BidSuit.Clubs },
          target: "opener-after-constructive-spades",
        },
        {
          transitionId: "r1-spades-limit",
          match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
          target: "opener-after-limit-spades",
        },
        {
          transitionId: "r1-spades-preemptive",
          match: { kind: "call", level: 3, strain: BidSuit.Spades },
          target: "opener-after-preemptive-spades",
        },
        {
          transitionId: "r1-spades-splinter",
          match: { kind: "call", level: 3, strain: BidSuit.Hearts },
          target: "terminal",
        },
        {
          transitionId: "r1-spades-game",
          match: { kind: "call", level: 4, strain: BidSuit.Spades },
          target: "terminal",
        },
        {
          transitionId: "r1-spades-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-r1-spades",
      entryEffects: { setCaptain: "responder" },
    },

    // ─── End states ─────────────────────────────────────────────
    {
      stateId: "terminal",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [],
    },
    {
      stateId: "bergen-contested",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      surfaceGroupId: "bergen-interrupted",
      transitions: [
        {
          transitionId: "bergen-contested-absorb",
          match: { kind: "pass" },
          target: "bergen-contested",
        },
      ],
      entryEffects: { setCompetitionMode: "Contested" },
    },
  ],
};


