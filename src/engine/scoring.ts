import { BidSuit, Seat, Vulnerability } from "./types";
import type { Contract } from "./types";

// ── Trick-point constants ──────────────────────────────────────────
const MINOR_TRICK_VALUE = 20;
const MAJOR_TRICK_VALUE = 30;
const NT_FIRST_TRICK_VALUE = 40;
const NT_SUBSEQUENT_TRICK_VALUE = 30;

// ── Multipliers ────────────────────────────────────────────────────
const DOUBLED_MULTIPLIER = 2;
const REDOUBLED_MULTIPLIER = 4;

// ── Game / partscore thresholds ────────────────────────────────────
const GAME_TRICK_POINT_THRESHOLD = 100;
const SMALL_SLAM_LEVEL = 6;
const GRAND_SLAM_LEVEL = 7;
const BOOK_TRICKS = 6;

// ── Bonuses ────────────────────────────────────────────────────────
const GAME_BONUS_VUL = 500;
const GAME_BONUS_NON_VUL = 300;
const PARTSCORE_BONUS = 50;
const SMALL_SLAM_BONUS_VUL = 750;
const SMALL_SLAM_BONUS_NON_VUL = 500;
const GRAND_SLAM_BONUS_VUL = 1500;
const GRAND_SLAM_BONUS_NON_VUL = 1000;
const INSULT_BONUS_DOUBLED = 50;
const INSULT_BONUS_REDOUBLED = 100;

// ── Overtrick values (doubled/redoubled) ───────────────────────────
const DOUBLED_OVERTRICK_VUL = 200;
const DOUBLED_OVERTRICK_NON_VUL = 100;
const REDOUBLED_OVERTRICK_VUL = 400;
const REDOUBLED_OVERTRICK_NON_VUL = 200;

// ── Undoubled penalties ────────────────────────────────────────────
const UNDOUBLED_PENALTY_VUL = 100;
const UNDOUBLED_PENALTY_NON_VUL = 50;

// ── Doubled penalty schedule ───────────────────────────────────────
const DOUBLED_PENALTY_VUL_FIRST = 200;
const DOUBLED_PENALTY_VUL_SUBSEQUENT = 300;
const DOUBLED_PENALTY_NON_VUL_FIRST = 100;
const DOUBLED_PENALTY_NON_VUL_SECOND_THIRD = 200;
const DOUBLED_PENALTY_NON_VUL_FOURTH_PLUS = 300;
const NON_VUL_ESCALATION_THRESHOLD = 3;

/** Check if a declarer is vulnerable given the vulnerability setting. */
export function isVulnerable(
  declarer: Seat,
  vulnerability: Vulnerability,
): boolean {
  switch (vulnerability) {
    case Vulnerability.None:
      return false;
    case Vulnerability.Both:
      return true;
    case Vulnerability.NorthSouth:
      return declarer === Seat.North || declarer === Seat.South;
    case Vulnerability.EastWest:
      return declarer === Seat.East || declarer === Seat.West;
  }
}

/**
 * Trick points for the contract (before bonuses).
 * Minor (C/D): 20 per trick. Major (H/S): 30 per trick.
 * NT: 40 first + 30 each subsequent. Doubled x2, redoubled x4.
 * @internal
 */
export function calculateTrickPoints(contract: Contract): number {
  const { level, strain, doubled, redoubled } = contract;

  let base: number;
  if (strain === BidSuit.Clubs || strain === BidSuit.Diamonds) {
    base = MINOR_TRICK_VALUE * level;
  } else if (strain === BidSuit.Hearts || strain === BidSuit.Spades) {
    base = MAJOR_TRICK_VALUE * level;
  } else {
    // NoTrump: first trick + subsequent tricks
    base = NT_FIRST_TRICK_VALUE + NT_SUBSEQUENT_TRICK_VALUE * (level - 1);
  }

  if (redoubled) return base * REDOUBLED_MULTIPLIER;
  if (doubled) return base * DOUBLED_MULTIPLIER;
  return base;
}

/** Game requires trick points >= GAME_TRICK_POINT_THRESHOLD. @internal */
export function isGame(contract: Contract): boolean {
  return calculateTrickPoints(contract) >= GAME_TRICK_POINT_THRESHOLD;
}

/** Small slam = level 6. @internal */
export function isSmallSlam(contract: Contract): boolean {
  return contract.level === SMALL_SLAM_LEVEL;
}

/** Grand slam = level 7. @internal */
export function isGrandSlam(contract: Contract): boolean {
  return contract.level === GRAND_SLAM_LEVEL;
}

/** Per-trick value for the contract strain (undoubled). */
function trickValue(strain: BidSuit): number {
  if (strain === BidSuit.Clubs || strain === BidSuit.Diamonds) return MINOR_TRICK_VALUE;
  if (strain === BidSuit.Hearts || strain === BidSuit.Spades) return MAJOR_TRICK_VALUE;
  // NT overtricks are 30 each (only the first contracted trick is 40)
  return NT_SUBSEQUENT_TRICK_VALUE;
}

/**
 * Score when declarer makes the contract (overtricks >= 0).
 * Returns: trick points + game/partscore bonus + slam bonus + overtrick points + insult bonus.
 */
export function calculateMakingScore(
  contract: Contract,
  overtricks: number,
  vulnerable: boolean,
): number {
  const trickPoints = calculateTrickPoints(contract);

  // Game / partscore bonus
  let bonus: number;
  if (trickPoints >= GAME_TRICK_POINT_THRESHOLD) {
    bonus = vulnerable ? GAME_BONUS_VUL : GAME_BONUS_NON_VUL;
  } else {
    bonus = PARTSCORE_BONUS;
  }

  // Slam bonuses (in addition to game bonus)
  if (contract.level === SMALL_SLAM_LEVEL) {
    bonus += vulnerable ? SMALL_SLAM_BONUS_VUL : SMALL_SLAM_BONUS_NON_VUL;
  } else if (contract.level === GRAND_SLAM_LEVEL) {
    bonus += vulnerable ? GRAND_SLAM_BONUS_VUL : GRAND_SLAM_BONUS_NON_VUL;
  }

  // Insult bonus for making a doubled/redoubled contract
  if (contract.redoubled) {
    bonus += INSULT_BONUS_REDOUBLED;
  } else if (contract.doubled) {
    bonus += INSULT_BONUS_DOUBLED;
  }

  // Overtrick points
  let overtrickPoints: number;
  if (contract.redoubled) {
    overtrickPoints = overtricks * (vulnerable ? REDOUBLED_OVERTRICK_VUL : REDOUBLED_OVERTRICK_NON_VUL);
  } else if (contract.doubled) {
    overtrickPoints = overtricks * (vulnerable ? DOUBLED_OVERTRICK_VUL : DOUBLED_OVERTRICK_NON_VUL);
  } else {
    overtrickPoints = overtricks * trickValue(contract.strain);
  }

  return trickPoints + bonus + overtrickPoints;
}

/**
 * Penalty when declarer goes down (undertricks >= 1).
 * Returns a positive number representing the penalty amount.
 */
export function calculatePenalty(
  contract: Contract,
  undertricks: number,
  vulnerable: boolean,
): number {
  if (contract.redoubled) {
    return calculateDoubledPenalty(undertricks, vulnerable) * DOUBLED_MULTIPLIER;
  }
  if (contract.doubled) {
    return calculateDoubledPenalty(undertricks, vulnerable);
  }
  // Undoubled: flat per-trick penalty
  return undertricks * (vulnerable ? UNDOUBLED_PENALTY_VUL : UNDOUBLED_PENALTY_NON_VUL);
}

/** Calculate doubled undertrick penalty (before redouble multiplier). */
function calculateDoubledPenalty(
  undertricks: number,
  vulnerable: boolean,
): number {
  let total = 0;
  for (let i = 1; i <= undertricks; i++) {
    if (vulnerable) {
      // Vul doubled: 1st=200, 2nd+=300
      total += i === 1 ? DOUBLED_PENALTY_VUL_FIRST : DOUBLED_PENALTY_VUL_SUBSEQUENT;
    } else {
      // NV doubled: 1st=100, 2nd-3rd=200, 4th+=300
      if (i === 1) {
        total += DOUBLED_PENALTY_NON_VUL_FIRST;
      } else if (i <= NON_VUL_ESCALATION_THRESHOLD) {
        total += DOUBLED_PENALTY_NON_VUL_SECOND_THIRD;
      } else {
        total += DOUBLED_PENALTY_NON_VUL_FOURTH_PLUS;
      }
    }
  }
  return total;
}

/**
 * Unified score calculation. Positive = declarer made, negative = declarer went down.
 * tricksWon = total tricks won by declarer (0-13).
 * Required tricks = contract.level + 6.
 */
export function calculateScore(
  contract: Contract,
  tricksWon: number,
  vulnerability: Vulnerability,
): number {
  const required = contract.level + BOOK_TRICKS;
  const vulnerable = isVulnerable(contract.declarer, vulnerability);

  if (tricksWon >= required) {
    const overtricks = tricksWon - required;
    return calculateMakingScore(contract, overtricks, vulnerable);
  } else {
    const undertricks = required - tricksWon;
    return -calculatePenalty(contract, undertricks, vulnerable);
  }
}
