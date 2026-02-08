import { describe, test, expect } from 'vitest';
import { Seat, BidSuit } from '../types';
import type { Auction, Contract } from '../types';
import type { EnginePort } from '../port';
import { TsEngine } from '../ts-engine';
import { hand } from './fixtures';

const testHand = hand(
  'SA', 'SK', 'S3', 'S2',
  'HK', 'HJ', 'H3',
  'DA', 'D3', 'D2',
  'C3', 'C2', 'C4',
); // 15 HCP balanced

describe('TsEngine', () => {
  test('is constructible and satisfies EnginePort', () => {
    const engine: EnginePort = new TsEngine();
    expect(engine).toBeDefined();
  });

  test('generateDeal returns a Deal with 4 hands of 13 cards', async () => {
    const engine = new TsEngine();
    const deal = await engine.generateDeal({ seats: [] });
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(deal.hands[seat].cards).toHaveLength(13);
    }
  });

  test('evaluateHand returns HandEvaluation with correct HCP', async () => {
    const engine = new TsEngine();
    const result = await engine.evaluateHand(testHand);
    expect(result.hcp).toBe(15);
    expect(result.strategy).toBe('HCP');
  });

  test('getSuitLength returns correct tuple', async () => {
    const engine = new TsEngine();
    const shape = await engine.getSuitLength(testHand);
    expect(shape).toEqual([4, 3, 3, 3]);
  });

  test('isBalanced returns true for balanced hand', async () => {
    const engine = new TsEngine();
    const balanced = await engine.isBalanced(testHand);
    expect(balanced).toBe(true);
  });

  test('solveDeal throws DDS not available', async () => {
    const engine = new TsEngine();
    const deal = await engine.generateDeal({ seats: [] });
    await expect(engine.solveDeal(deal)).rejects.toThrow('DDS not available');
  });

  test('getLegalCalls throws Not implemented', async () => {
    const engine = new TsEngine();
    const auction: Auction = { entries: [], isComplete: false };
    await expect(engine.getLegalCalls(auction, Seat.North)).rejects.toThrow('Not implemented');
  });

  test('suggestBid throws DDS not available', async () => {
    const engine = new TsEngine();
    const auction: Auction = { entries: [], isComplete: false };
    await expect(engine.suggestBid(testHand, auction, Seat.North)).rejects.toThrow('DDS not available');
  });

  test('addCall throws Not implemented', async () => {
    const engine = new TsEngine();
    const auction: Auction = { entries: [], isComplete: false };
    const entry = { seat: Seat.North, call: { type: 'pass' as const } };
    await expect(engine.addCall(auction, entry)).rejects.toThrow('Not implemented');
  });

  test('isAuctionComplete throws Not implemented', async () => {
    const engine = new TsEngine();
    const auction: Auction = { entries: [], isComplete: false };
    await expect(engine.isAuctionComplete(auction)).rejects.toThrow('Not implemented');
  });

  test('getContract throws Not implemented', async () => {
    const engine = new TsEngine();
    const auction: Auction = { entries: [], isComplete: false };
    await expect(engine.getContract(auction)).rejects.toThrow('Not implemented');
  });

  test('calculateScore throws Not implemented', async () => {
    const engine = new TsEngine();
    const contract: Contract = {
      level: 4, strain: BidSuit.Spades, doubled: false, redoubled: false, declarer: Seat.South,
    };
    await expect(engine.calculateScore(contract, 10, false)).rejects.toThrow('Not implemented');
  });

  test('suggestPlay throws DDS not available', async () => {
    const engine = new TsEngine();
    await expect(engine.suggestPlay(testHand, [], null, [])).rejects.toThrow('DDS not available');
  });
});
