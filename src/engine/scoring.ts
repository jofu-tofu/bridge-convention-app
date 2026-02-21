import { BidSuit, Seat, Vulnerability } from "./types";
import type { Contract } from "./types";

/** Check if a declarer is vulnerable given the vulnerability setting. */
export function isVulnerable(declarer: Seat, vulnerability: Vulnerability): boolean {
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
 */
export function calculateTrickPoints(contract: Contract): number {
  const { level, strain, doubled, redoubled } = contract;

  let base: number;
  if (strain === BidSuit.Clubs || strain === BidSuit.Diamonds) {
    base = 20 * level;
  } else if (strain === BidSuit.Hearts || strain === BidSuit.Spades) {
    base = 30 * level;
  } else {
    // NoTrump: 40 for first trick + 30 for each additional
    base = 40 + 30 * (level - 1);
  }

  if (redoubled) return base * 4;
  if (doubled) return base * 2;
  return base;
}

/** Game requires trick points >= 100. */
export function isGame(contract: Contract): boolean {
  return calculateTrickPoints(contract) >= 100;
}

/** Small slam = level 6. */
export function isSmallSlam(contract: Contract): boolean {
  return contract.level === 6;
}

/** Grand slam = level 7. */
export function isGrandSlam(contract: Contract): boolean {
  return contract.level === 7;
}

/** Per-trick value for the contract strain (undoubled). */
function trickValue(strain: BidSuit): number {
  if (strain === BidSuit.Clubs || strain === BidSuit.Diamonds) return 20;
  if (strain === BidSuit.Hearts || strain === BidSuit.Spades) return 30;
  // NT overtricks are 30 each (only the first contracted trick is 40)
  return 30;
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
  if (trickPoints >= 100) {
    bonus = vulnerable ? 500 : 300;
  } else {
    bonus = 50;
  }

  // Slam bonuses (in addition to game bonus)
  if (contract.level === 6) {
    bonus += vulnerable ? 750 : 500;
  } else if (contract.level === 7) {
    bonus += vulnerable ? 1500 : 1000;
  }

  // Insult bonus for making a doubled/redoubled contract
  if (contract.redoubled) {
    bonus += 100;
  } else if (contract.doubled) {
    bonus += 50;
  }

  // Overtrick points
  let overtrickPoints: number;
  if (contract.redoubled) {
    overtrickPoints = overtricks * (vulnerable ? 400 : 200);
  } else if (contract.doubled) {
    overtrickPoints = overtricks * (vulnerable ? 200 : 100);
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
    return calculateDoubledPenalty(undertricks, vulnerable) * 2;
  }
  if (contract.doubled) {
    return calculateDoubledPenalty(undertricks, vulnerable);
  }
  // Undoubled: flat per-trick penalty
  return undertricks * (vulnerable ? 100 : 50);
}

/** Calculate doubled undertrick penalty (before redouble multiplier). */
function calculateDoubledPenalty(undertricks: number, vulnerable: boolean): number {
  let total = 0;
  for (let i = 1; i <= undertricks; i++) {
    if (vulnerable) {
      // Vul doubled: 1st=200, 2nd+=300
      total += i === 1 ? 200 : 300;
    } else {
      // NV doubled: 1st=100, 2nd-3rd=200, 4th+=300
      if (i === 1) {
        total += 100;
      } else if (i <= 3) {
        total += 200;
      } else {
        total += 300;
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
  const required = contract.level + 6;
  const vulnerable = isVulnerable(contract.declarer, vulnerability);

  if (tricksWon >= required) {
    const overtricks = tricksWon - required;
    return calculateMakingScore(contract, overtricks, vulnerable);
  } else {
    const undertricks = required - tricksWon;
    return -calculatePenalty(contract, undertricks, vulnerable);
  }
}
