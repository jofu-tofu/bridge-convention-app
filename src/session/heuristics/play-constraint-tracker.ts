/**
 * PlayConstraintTracker — tracks card play observations to produce
 * updated constraints for Monte Carlo deal sampling during play.
 *
 * Detects voids (off-suit follows) and tracks cards played per seat per suit.
 * Cursor-based: re-calling update() with the same tricks is O(1) amortized.
 */

import type { PlayedCard, Trick, Seat, Suit } from "../../engine/types";

export class PlayConstraintTracker {
  private processedTrickCount = 0;
  private readonly voids = new Map<Seat, Set<Suit>>();
  /** Key: `${seat}-${suit}`, value: count of cards played. */
  private readonly playedPerSeatSuit = new Map<string, number>();

  /** Update tracker with current game state. Cursor-based — only new tricks are processed. */
  update(previousTricks: readonly Trick[], currentTrick: readonly PlayedCard[]): void {
    // Process newly completed tricks (cursor-based)
    for (let i = this.processedTrickCount; i < previousTricks.length; i++) {
      const trick = previousTricks[i]!;
      this.processTrick(trick.plays);
    }
    this.processedTrickCount = previousTricks.length;

    // Always re-scan current trick (it changes each call)
    this.scanForVoids(currentTrick);
  }

  /** Get detected voids per seat. */
  getVoids(): ReadonlyMap<Seat, Set<Suit>> {
    return this.voids;
  }

  /** Get count of cards played by a seat in a suit (from completed tricks only). */
  getPlayedCount(seat: Seat, suit: Suit): number {
    return this.playedPerSeatSuit.get(`${seat}-${suit}`) ?? 0;
  }

  private processTrick(plays: readonly PlayedCard[]): void {
    if (plays.length === 0) return;
    const ledSuit = plays[0]!.card.suit;

    for (const play of plays) {
      if (play.card.suit !== ledSuit) {
        this.markVoid(play.seat, ledSuit);
      }
      // Track cards played per seat per suit
      const key = `${play.seat}-${play.card.suit}`;
      this.playedPerSeatSuit.set(key, (this.playedPerSeatSuit.get(key) ?? 0) + 1);
    }
  }

  private scanForVoids(plays: readonly PlayedCard[]): void {
    if (plays.length === 0) return;
    const ledSuit = plays[0]!.card.suit;

    for (const play of plays) {
      if (play.card.suit !== ledSuit) {
        this.markVoid(play.seat, ledSuit);
      }
    }
  }

  private markVoid(seat: Seat, suit: Suit): void {
    let seatVoids = this.voids.get(seat);
    if (!seatVoids) {
      seatVoids = new Set();
      this.voids.set(seat, seatVoids);
    }
    seatVoids.add(suit);
  }
}
