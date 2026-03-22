/**
 * Pedagogical Scope Vocabulary — type-safe scope constants for teachingTags.
 *
 * Static scopes are `as const` string constants. Parameterized scopes use
 * factory functions (e.g., Bergen scopes parameterized by suit).
 *
 * PedagogicalScope is a branded string type enforced at authoring time via
 * createSurface(). The runtime type remains `string` for backward compatibility.
 */

// ── Branded type ────────────────────────────────────────────────────

declare const __pedagogicalScope: unique symbol;
export type PedagogicalScope = string & { readonly [__pedagogicalScope]: never };

/** Cast a string literal to PedagogicalScope. Used only inside this file. */
function scope<T extends string>(s: T): T & PedagogicalScope {
  return s as T & PedagogicalScope;
}

// ── Cross-module scopes (NT) ────────────────────────────────────────

/** Responder R1 bids seeking major fit (Stayman + Transfers share this). */
export const SCOPE_R1_MAJOR_FIT = scope("r1-major-fit");
/** NT response alternatives: transfer vs Stayman. */
export const SCOPE_NT_RESPONSE_TRANSFER_VS_STAYMAN = scope("NT response: transfer vs Stayman");
/** Stayman ask vs transfer near-miss. */
export const SCOPE_R1_ASK_VS_TRANSFER = scope("r1-ask-vs-transfer");
/** R1 major fit fallback (natural NT bids). */
export const SCOPE_R1_MAJOR_FIT_FALLBACK = scope("r1-major-fit-fallback");
/** R3 game-forcing continues Stayman ask. */
export const SCOPE_R3_GF_CONTINUES_ASK = scope("r3-gf-continues-ask");
/** R3 game-forcing vs invite after denial. */
export const SCOPE_R3_GF_VS_INVITE_DENIAL = scope("r3-gf-vs-invite-denial");
/** R3 game-forcing vs 3NT game after denial. */
export const SCOPE_R3_GF_VS_GAME_DENIAL = scope("r3-gf-vs-game-denial");
/** After denial: Smolen vs 3NT alternatives. */
export const SCOPE_AFTER_DENIAL_SMOLEN_VS_3NT = scope("After denial: Smolen vs 3NT");

// ── Natural NT scopes ───────────────────────────────────────────────

/** Natural NT R1 bids family. */
export const SCOPE_NATURAL_NT_R1 = scope("natural-nt:r1");
/** Natural NT R1 strength progression. */
export const SCOPE_NATURAL_NT_R1_STRENGTH = scope("natural-nt:r1-strength");

// ── Stayman scopes ──────────────────────────────────────────────────

/** Stayman R3 strength after 2H response. */
export const SCOPE_STAYMAN_R3_2H_STRENGTH = scope("stayman:r3-2h-strength");
/** Stayman R3 strength after 2S response. */
export const SCOPE_STAYMAN_R3_2S_STRENGTH = scope("stayman:r3-2s-strength");
/** Stayman R3 strength after no-fit denial. */
export const SCOPE_STAYMAN_R3_NO_FIT_STRENGTH = scope("stayman:r3-no-fit-strength");
/** Stayman R3 strength after denial. */
export const SCOPE_STAYMAN_R3_DENIAL_STRENGTH = scope("stayman:r3-denial-strength");
/** Stayman raise continues ask. */
export const SCOPE_STAYMAN_RAISE_CONTINUES_ASK = scope("stayman:raise-continues-ask");

// ── Smolen scopes ───────────────────────────────────────────────────

/** Smolen entry variant family. */
export const SCOPE_SMOLEN_ENTRY_VARIANTS = scope("smolen:entry-variants");
/** Smolen R3 bids family. */
export const SCOPE_SMOLEN_R3_BIDS = scope("smolen:r3-bids");

// ── Transfer scopes ─────────────────────────────────────────────────

/** Transfer R3 hearts strength progression. */
export const SCOPE_TRANSFER_R3_HEARTS_STRENGTH = scope("transfer:r3-hearts-strength");
/** Transfer R3 spades strength progression. */
export const SCOPE_TRANSFER_R3_SPADES_STRENGTH = scope("transfer:r3-spades-strength");
/** Transfer game vs NT for hearts. */
export const SCOPE_TRANSFER_GAME_VS_NT_HEARTS = scope("transfer:game-vs-nt-hearts");
/** Transfer signoff continues R1 hearts. */
export const SCOPE_TRANSFER_SIGNOFF_CONTINUES_R1_HEARTS = scope("transfer:signoff-continues-r1-hearts");

// ── DONT scopes ─────────────────────────────────────────────────────

/** DONT overcaller R1 actions family. */
export const SCOPE_DONT_OVERCALLER_R1_ACTIONS = scope("dont:overcaller-r1-actions");
/** DONT overcaller two-suited alternatives. */
export const SCOPE_DONT_TWO_SUITED_ACTIONS = scope("DONT overcaller two-suited actions");
/** DONT overcaller long-suit alternatives. */
export const SCOPE_DONT_LONG_SUIT_ACTIONS = scope("DONT overcaller long-suit actions");
/** DONT 2H vs 2D near-miss. */
export const SCOPE_DONT_2H_VS_2D = scope("dont:2h-vs-2d");
/** DONT 2C vs 2D near-miss. */
export const SCOPE_DONT_2C_VS_2D = scope("dont:2c-vs-2d");
/** DONT 2S vs double near-miss. */
export const SCOPE_DONT_2S_VS_DOUBLE = scope("dont:2s-vs-double");
/** DONT overcaller reveals family. */
export const SCOPE_DONT_OVERCALLER_REVEALS = scope("dont:overcaller-reveals");
/** DONT reveal after double continuation. */
export const SCOPE_DONT_REVEAL_AFTER_DOUBLE = scope("dont:reveal-after-double");
/** DONT show after 2C relay continuation. */
export const SCOPE_DONT_SHOW_AFTER_2C_RELAY = scope("dont:show-after-2c-relay");
/** DONT show after 2D relay continuation. */
export const SCOPE_DONT_SHOW_AFTER_2D_RELAY = scope("dont:show-after-2d-relay");

// ── Weak Two scopes ─────────────────────────────────────────────────

/** Weak Two opener bids family. */
export const SCOPE_WEAK_TWO_OPENER_BIDS = scope("weak-two:opener-bids");
/** Ogust response alternatives. */
export const SCOPE_OGUST_RESPONSES = scope("Ogust responses");

// ── Bergen scopes (parameterized by suit) ───────────────────────────

/** Bergen R4 after game-try decision. */
export const SCOPE_BERGEN_R4_AFTER_TRY_DECISION = scope("bergen:r4-after-try-decision");

/** Bergen natural 1NT response vs raise alternatives. */
export const SCOPE_BERGEN_1NT_VS_RAISE = scope("bergen:1nt-vs-raise");

export const bergenScopes = {
  r1SplinterAndGame: (suit: string) => scope(`bergen:r1-splinter-and-game-${suit}`),
  r1SplinterVsGame: (suit: string) => scope(`bergen:r1-splinter-vs-game-${suit}`),
  r1StrengthRaises: (suit: string) => scope(`bergen:r1-strength-raises-${suit}`),
  r1StrengthChain: (suit: string) => scope(`bergen:r1-strength-chain-${suit}`),
  r1ConstructiveVsLimit: (suit: string) => scope(`bergen:r1-constructive-vs-limit-${suit}`),
  r1PreemptiveFallback: (suit: string) => scope(`bergen:r1-preemptive-fallback-${suit}`),
  r2AfterConstructive: (suit: string) => scope(`bergen:r2-after-constructive-${suit}`),
  r2AfterLimit: (suit: string) => scope(`bergen:r2-after-limit-${suit}`),
  r2AfterPreemptive: (suit: string) => scope(`bergen:r2-after-preemptive-${suit}`),
  r2RebidsAfterConstructive: (suit: string) => scope(`bergen:r2-rebids-after-constructive-${suit}`),
  r2ConstructiveStrength: (suit: string) => scope(`bergen:r2-constructive-strength-${suit}`),
  r2RebidsAfterLimit: (suit: string) => scope(`bergen:r2-rebids-after-limit-${suit}`),
  r2LimitStrength: (suit: string) => scope(`bergen:r2-limit-strength-${suit}`),
  r2RebidsAfterPreemptive: (suit: string) => scope(`bergen:r2-rebids-after-preemptive-${suit}`),
  r2PreemptiveStrength: (suit: string) => scope(`bergen:r2-preemptive-strength-${suit}`),
  r3GameTryDecisions: (suit: string) => scope(`bergen:r3-game-try-decisions-${suit}`),
  r3GameTryStrength: (suit: string) => scope(`bergen:r3-game-try-strength-${suit}`),
  strengthRaisesAlternatives: (suit: string) => scope(`Bergen strength raises (${suit})`),
  openerRebidAfterConstructive: (suit: string) => scope(`Opener rebid after constructive (${suit})`),
  openerRebidAfterLimit: (suit: string) => scope(`Opener rebid after limit (${suit})`),
  responderGameTryDecision: (suit: string) => scope(`Responder game try decision (${suit})`),
} as const;
