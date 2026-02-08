import { describe, test, expect } from 'vitest';
import { Suit, Rank, Seat, Vulnerability, BidSuit, SpecialBid } from '../types';
import type { Card, Hand, Deal, ContractBid, SpecialCall, Call, Auction, Contract, HandEvaluation, SuitLength } from '../types';

describe('Suit', () => {
  test('has exactly 4 values', () => {
    const values = Object.values(Suit);
    expect(values).toHaveLength(4);
  });

  test('values are single-char bridge notation', () => {
    expect(Suit.Clubs).toBe('C');
    expect(Suit.Diamonds).toBe('D');
    expect(Suit.Hearts).toBe('H');
    expect(Suit.Spades).toBe('S');
  });
});

describe('Rank', () => {
  test('has exactly 13 values', () => {
    const values = Object.values(Rank);
    expect(values).toHaveLength(13);
  });

  test('numeric ranks use digit strings', () => {
    expect(Rank.Two).toBe('2');
    expect(Rank.Nine).toBe('9');
  });

  test('Ten uses T notation', () => {
    expect(Rank.Ten).toBe('T');
  });

  test('face cards use single-char notation', () => {
    expect(Rank.Jack).toBe('J');
    expect(Rank.Queen).toBe('Q');
    expect(Rank.King).toBe('K');
    expect(Rank.Ace).toBe('A');
  });
});

describe('Card', () => {
  test('is constructible from Suit and Rank', () => {
    const card: Card = { suit: Suit.Spades, rank: Rank.Ace };
    expect(card.suit).toBe('S');
    expect(card.rank).toBe('A');
  });

  test('is a plain object matching raw string values', () => {
    const card: Card = { suit: Suit.Hearts, rank: Rank.King };
    expect(card).toEqual({ suit: 'H', rank: 'K' });
  });
});

describe('Seat', () => {
  test('has exactly 4 values', () => {
    const values = Object.values(Seat);
    expect(values).toHaveLength(4);
  });

  test('values are single-char compass notation', () => {
    expect(Seat.North).toBe('N');
    expect(Seat.East).toBe('E');
    expect(Seat.South).toBe('S');
    expect(Seat.West).toBe('W');
  });
});

describe('Vulnerability', () => {
  test('has exactly 4 values', () => {
    const values = Object.values(Vulnerability);
    expect(values).toHaveLength(4);
  });

  test('values use bridge notation', () => {
    expect(Vulnerability.None).toBe('None');
    expect(Vulnerability.NorthSouth).toBe('NS');
    expect(Vulnerability.EastWest).toBe('EW');
    expect(Vulnerability.Both).toBe('Both');
  });
});

describe('BidSuit', () => {
  test('has exactly 5 values including NoTrump', () => {
    const values = Object.values(BidSuit);
    expect(values).toHaveLength(5);
  });

  test('includes all card suits plus NoTrump', () => {
    expect(BidSuit.Clubs).toBe('C');
    expect(BidSuit.Diamonds).toBe('D');
    expect(BidSuit.Hearts).toBe('H');
    expect(BidSuit.Spades).toBe('S');
    expect(BidSuit.NoTrump).toBe('NT');
  });
});

describe('SpecialBid', () => {
  test('has exactly 3 values', () => {
    const values = Object.values(SpecialBid);
    expect(values).toHaveLength(3);
  });

  test('values use bridge notation', () => {
    expect(SpecialBid.Pass).toBe('Pass');
    expect(SpecialBid.Double).toBe('X');
    expect(SpecialBid.Redouble).toBe('XX');
  });
});

describe('Call discriminated union', () => {
  test('ContractBid has type bid with level and strain', () => {
    const bid: ContractBid = { type: 'bid', level: 1, strain: BidSuit.NoTrump };
    expect(bid.type).toBe('bid');
    expect(bid.level).toBe(1);
    expect(bid.strain).toBe('NT');
  });

  test('SpecialCall has type pass, double, or redouble', () => {
    const pass: SpecialCall = { type: 'pass' };
    const dbl: SpecialCall = { type: 'double' };
    const rdbl: SpecialCall = { type: 'redouble' };
    expect(pass.type).toBe('pass');
    expect(dbl.type).toBe('double');
    expect(rdbl.type).toBe('redouble');
  });

  test('Call union discriminates on type field', () => {
    const calls: Call[] = [
      { type: 'bid', level: 3, strain: BidSuit.Hearts },
      { type: 'pass' },
    ];
    const bid = calls[0]!;
    if (bid.type === 'bid') {
      expect(bid.level).toBe(3);
      expect(bid.strain).toBe('H');
    }
    expect(calls[1]!.type).toBe('pass');
  });
});

describe('composite interfaces', () => {
  test('Hand holds readonly cards', () => {
    const hand: Hand = {
      cards: [
        { suit: Suit.Spades, rank: Rank.Ace },
        { suit: Suit.Hearts, rank: Rank.King },
      ],
    };
    expect(hand.cards).toHaveLength(2);
  });

  test('Deal contains hands for all seats', () => {
    const emptyHand: Hand = { cards: [] };
    const deal: Deal = {
      hands: {
        [Seat.North]: emptyHand,
        [Seat.East]: emptyHand,
        [Seat.South]: emptyHand,
        [Seat.West]: emptyHand,
      },
      dealer: Seat.North,
      vulnerability: Vulnerability.None,
    };
    expect(deal.dealer).toBe('N');
    expect(deal.vulnerability).toBe('None');
  });

  test('Auction tracks entries and completion', () => {
    const auction: Auction = {
      entries: [
        { seat: Seat.North, call: { type: 'bid', level: 1, strain: BidSuit.Clubs } },
        { seat: Seat.East, call: { type: 'pass' } },
      ],
      isComplete: false,
    };
    expect(auction.entries).toHaveLength(2);
    expect(auction.isComplete).toBe(false);
  });

  test('Contract captures final bid result', () => {
    const contract: Contract = {
      level: 4,
      strain: BidSuit.Spades,
      doubled: false,
      redoubled: false,
      declarer: Seat.South,
    };
    expect(contract.level).toBe(4);
    expect(contract.declarer).toBe('S');
  });
});
