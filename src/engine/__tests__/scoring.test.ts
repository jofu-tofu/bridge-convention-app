import { describe, test, expect } from "vitest";
import { BidSuit, Seat, Vulnerability } from "../types";
import type { Contract } from "../types";
import {
  isVulnerable,
  calculateTrickPoints,
  isGame,
  isSmallSlam,
  isGrandSlam,
  calculateMakingScore,
  calculatePenalty,
  calculateScore,
} from "../scoring";

// Helper to build Contract objects concisely
function contract(
  level: Contract["level"],
  strain: BidSuit,
  declarer: Seat = Seat.South,
  doubled = false,
  redoubled = false,
): Contract {
  return { level, strain, doubled, redoubled, declarer };
}

describe("isVulnerable", () => {
  test("NS vulnerability with North declarer returns true", () => {
    expect(isVulnerable(Seat.North, Vulnerability.NorthSouth)).toBe(true);
  });

  test("NS vulnerability with South declarer returns true", () => {
    expect(isVulnerable(Seat.South, Vulnerability.NorthSouth)).toBe(true);
  });

  test("NS vulnerability with East declarer returns false", () => {
    expect(isVulnerable(Seat.East, Vulnerability.NorthSouth)).toBe(false);
  });

  test("NS vulnerability with West declarer returns false", () => {
    expect(isVulnerable(Seat.West, Vulnerability.NorthSouth)).toBe(false);
  });

  test("EW vulnerability with East declarer returns true", () => {
    expect(isVulnerable(Seat.East, Vulnerability.EastWest)).toBe(true);
  });

  test("EW vulnerability with North declarer returns false", () => {
    expect(isVulnerable(Seat.North, Vulnerability.EastWest)).toBe(false);
  });

  test("Both vulnerability always returns true", () => {
    expect(isVulnerable(Seat.North, Vulnerability.Both)).toBe(true);
    expect(isVulnerable(Seat.East, Vulnerability.Both)).toBe(true);
    expect(isVulnerable(Seat.South, Vulnerability.Both)).toBe(true);
    expect(isVulnerable(Seat.West, Vulnerability.Both)).toBe(true);
  });

  test("None vulnerability always returns false", () => {
    expect(isVulnerable(Seat.North, Vulnerability.None)).toBe(false);
    expect(isVulnerable(Seat.East, Vulnerability.None)).toBe(false);
    expect(isVulnerable(Seat.South, Vulnerability.None)).toBe(false);
    expect(isVulnerable(Seat.West, Vulnerability.None)).toBe(false);
  });
});

describe("calculateTrickPoints", () => {
  test("1C = 20", () => {
    expect(calculateTrickPoints(contract(1, BidSuit.Clubs))).toBe(20);
  });

  test("1D = 20", () => {
    expect(calculateTrickPoints(contract(1, BidSuit.Diamonds))).toBe(20);
  });

  test("5C = 100", () => {
    expect(calculateTrickPoints(contract(5, BidSuit.Clubs))).toBe(100);
  });

  test("5D = 100", () => {
    expect(calculateTrickPoints(contract(5, BidSuit.Diamonds))).toBe(100);
  });

  test("1H = 30", () => {
    expect(calculateTrickPoints(contract(1, BidSuit.Hearts))).toBe(30);
  });

  test("4H = 120", () => {
    expect(calculateTrickPoints(contract(4, BidSuit.Hearts))).toBe(120);
  });

  test("4S = 120", () => {
    expect(calculateTrickPoints(contract(4, BidSuit.Spades))).toBe(120);
  });

  test("1NT = 40", () => {
    expect(calculateTrickPoints(contract(1, BidSuit.NoTrump))).toBe(40);
  });

  test("2NT = 70", () => {
    expect(calculateTrickPoints(contract(2, BidSuit.NoTrump))).toBe(70);
  });

  test("3NT = 100", () => {
    expect(calculateTrickPoints(contract(3, BidSuit.NoTrump))).toBe(100);
  });

  test("1H doubled = 60", () => {
    expect(calculateTrickPoints(contract(1, BidSuit.Hearts, Seat.South, true))).toBe(60);
  });

  test("1H redoubled = 120", () => {
    expect(
      calculateTrickPoints(contract(1, BidSuit.Hearts, Seat.South, false, true)),
    ).toBe(120);
  });
});

describe("isGame", () => {
  test("3NT is game (100)", () => {
    expect(isGame(contract(3, BidSuit.NoTrump))).toBe(true);
  });

  test("4H is game (120)", () => {
    expect(isGame(contract(4, BidSuit.Hearts))).toBe(true);
  });

  test("4S is game (120)", () => {
    expect(isGame(contract(4, BidSuit.Spades))).toBe(true);
  });

  test("5C is game (100)", () => {
    expect(isGame(contract(5, BidSuit.Clubs))).toBe(true);
  });

  test("5D is game (100)", () => {
    expect(isGame(contract(5, BidSuit.Diamonds))).toBe(true);
  });

  test("2NT is not game (70)", () => {
    expect(isGame(contract(2, BidSuit.NoTrump))).toBe(false);
  });

  test("2S is not game (60)", () => {
    expect(isGame(contract(2, BidSuit.Spades))).toBe(false);
  });

  test("4D is not game (80)", () => {
    expect(isGame(contract(4, BidSuit.Diamonds))).toBe(false);
  });

  test("1H doubled is game (60 trick points, but doubled to 60... wait no)", () => {
    // 1H doubled: trick points = 30 * 1 * 2 = 60, NOT game
    expect(isGame(contract(1, BidSuit.Hearts, Seat.South, true))).toBe(false);
  });

  test("2D doubled is not game (80)", () => {
    // 2D doubled: 20 * 2 * 2 = 80
    expect(isGame(contract(2, BidSuit.Diamonds, Seat.South, true))).toBe(false);
  });

  test("2H doubled is game (120)", () => {
    // 2H doubled: 30 * 2 * 2 = 120
    expect(isGame(contract(2, BidSuit.Hearts, Seat.South, true))).toBe(true);
  });

  test("3D doubled is game (120)", () => {
    // 3D doubled: 20 * 3 * 2 = 120
    expect(isGame(contract(3, BidSuit.Diamonds, Seat.South, true))).toBe(true);
  });
});

describe("isSmallSlam", () => {
  test("level 6 is small slam", () => {
    expect(isSmallSlam(contract(6, BidSuit.NoTrump))).toBe(true);
  });

  test("level 5 is not small slam", () => {
    expect(isSmallSlam(contract(5, BidSuit.Clubs))).toBe(false);
  });

  test("level 7 is not small slam", () => {
    expect(isSmallSlam(contract(7, BidSuit.NoTrump))).toBe(false);
  });
});

describe("isGrandSlam", () => {
  test("level 7 is grand slam", () => {
    expect(isGrandSlam(contract(7, BidSuit.NoTrump))).toBe(true);
  });

  test("level 6 is not grand slam", () => {
    expect(isGrandSlam(contract(6, BidSuit.Hearts))).toBe(false);
  });
});

describe("calculateMakingScore", () => {
  describe("partscore bonus", () => {
    test("1C making exact NV = 20 + 50 = 70", () => {
      expect(calculateMakingScore(contract(1, BidSuit.Clubs), 0, false)).toBe(70);
    });

    test("2H making exact NV = 60 + 50 = 110", () => {
      expect(calculateMakingScore(contract(2, BidSuit.Hearts), 0, false)).toBe(110);
    });

    test("partscore bonus is 50 even when vulnerable", () => {
      expect(calculateMakingScore(contract(1, BidSuit.Clubs), 0, true)).toBe(70);
    });
  });

  describe("game bonus", () => {
    test("3NT making exact NV = 100 + 300 = 400", () => {
      expect(calculateMakingScore(contract(3, BidSuit.NoTrump), 0, false)).toBe(400);
    });

    test("3NT making exact V = 100 + 500 = 600", () => {
      expect(calculateMakingScore(contract(3, BidSuit.NoTrump), 0, true)).toBe(600);
    });

    test("4H making exact NV = 120 + 300 = 420", () => {
      expect(calculateMakingScore(contract(4, BidSuit.Hearts), 0, false)).toBe(420);
    });

    test("4S making exact V = 120 + 500 = 620", () => {
      expect(calculateMakingScore(contract(4, BidSuit.Spades), 0, true)).toBe(620);
    });

    test("5C making exact NV = 100 + 300 = 400", () => {
      expect(calculateMakingScore(contract(5, BidSuit.Clubs), 0, false)).toBe(400);
    });
  });

  describe("slam bonus", () => {
    test("6H making exact NV = 180 + 300 game + 500 slam = 980", () => {
      expect(calculateMakingScore(contract(6, BidSuit.Hearts), 0, false)).toBe(980);
    });

    test("6H making exact V = 180 + 500 game + 750 slam = 1430", () => {
      expect(calculateMakingScore(contract(6, BidSuit.Hearts), 0, true)).toBe(1430);
    });

    test("7NT making exact NV = 220 + 300 game + 1000 grand slam = 1520", () => {
      expect(calculateMakingScore(contract(7, BidSuit.NoTrump), 0, false)).toBe(1520);
    });

    test("7NT making exact V = 220 + 500 game + 1500 grand slam = 2220", () => {
      expect(calculateMakingScore(contract(7, BidSuit.NoTrump), 0, true)).toBe(2220);
    });
  });

  describe("overtricks undoubled", () => {
    test("2H NV +1 overtrick = 60 + 50 partscore + 30 overtrick = 140", () => {
      expect(calculateMakingScore(contract(2, BidSuit.Hearts), 1, false)).toBe(140);
    });

    test("3NT NV +2 overtricks = 100 + 300 game + 60 overtricks = 460", () => {
      expect(calculateMakingScore(contract(3, BidSuit.NoTrump), 2, false)).toBe(460);
    });

    test("1C NV +3 overtricks = 20 + 50 + 60 = 130", () => {
      expect(calculateMakingScore(contract(1, BidSuit.Clubs), 3, false)).toBe(130);
    });
  });

  describe("doubled insult and overtricks", () => {
    test("doubled insult adds +50", () => {
      // 1C doubled NV making exact: trick=40, partscore=50, insult=50 → 140
      // Wait: 1C doubled = 20*2 = 40 trick points. 40 < 100, so partscore.
      expect(calculateMakingScore(contract(1, BidSuit.Clubs, Seat.South, true), 0, false)).toBe(140);
    });

    test("redoubled insult adds +100", () => {
      // 1C redoubled NV making exact: trick=80, partscore=50, insult=100 → 230
      expect(
        calculateMakingScore(contract(1, BidSuit.Clubs, Seat.South, false, true), 0, false),
      ).toBe(230);
    });

    test("doubled overtricks NV = 100 per overtrick", () => {
      // 2H doubled NV +1: trick=120, game=300, insult=50, overtrick=100 → 570
      expect(
        calculateMakingScore(contract(2, BidSuit.Hearts, Seat.South, true), 1, false),
      ).toBe(570);
    });

    test("doubled overtricks V = 200 per overtrick", () => {
      // 2H doubled V +1: trick=120, game=500, insult=50, overtrick=200 → 870
      expect(
        calculateMakingScore(contract(2, BidSuit.Hearts, Seat.South, true), 1, true),
      ).toBe(870);
    });

    test("redoubled overtricks NV = 200 per overtrick", () => {
      // 1H redoubled NV +1: trick=120, game=300, insult=100, overtrick=200 → 720
      expect(
        calculateMakingScore(contract(1, BidSuit.Hearts, Seat.South, false, true), 1, false),
      ).toBe(720);
    });

    test("redoubled overtricks V = 400 per overtrick", () => {
      // 1H redoubled V +1: trick=120, game=500, insult=100, overtrick=400 → 1120
      expect(
        calculateMakingScore(contract(1, BidSuit.Hearts, Seat.South, false, true), 1, true),
      ).toBe(1120);
    });
  });

  describe("full scenarios", () => {
    test("4S doubled NV making +1 = 690", () => {
      // trick=4*30*2=240, game=300, insult=50, overtrick=100 → 690
      expect(
        calculateMakingScore(contract(4, BidSuit.Spades, Seat.South, true), 1, false),
      ).toBe(690);
    });
  });
});

describe("calculatePenalty", () => {
  describe("undoubled not vulnerable", () => {
    test("down 1 = 50", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades), 1, false)).toBe(50);
    });

    test("down 3 = 150", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades), 3, false)).toBe(150);
    });
  });

  describe("undoubled vulnerable", () => {
    test("down 1 = 100", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades), 1, true)).toBe(100);
    });

    test("down 3 = 300", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades), 3, true)).toBe(300);
    });
  });

  describe("doubled not vulnerable", () => {
    test("down 1 = 100", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades, Seat.South, true), 1, false)).toBe(100);
    });

    test("down 2 = 300", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades, Seat.South, true), 2, false)).toBe(300);
    });

    test("down 3 = 500", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades, Seat.South, true), 3, false)).toBe(500);
    });

    test("down 4 = 800", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades, Seat.South, true), 4, false)).toBe(800);
    });

    test("down 5 = 1100", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades, Seat.South, true), 5, false)).toBe(1100);
    });
  });

  describe("doubled vulnerable", () => {
    test("down 1 = 200", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades, Seat.South, true), 1, true)).toBe(200);
    });

    test("down 2 = 500", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades, Seat.South, true), 2, true)).toBe(500);
    });

    test("down 3 = 800", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades, Seat.South, true), 3, true)).toBe(800);
    });

    test("down 4 = 1100", () => {
      expect(calculatePenalty(contract(4, BidSuit.Spades, Seat.South, true), 4, true)).toBe(1100);
    });
  });

  describe("redoubled", () => {
    test("redoubled NV down 1 = 200", () => {
      expect(
        calculatePenalty(contract(4, BidSuit.Spades, Seat.South, false, true), 1, false),
      ).toBe(200);
    });

    test("redoubled NV down 3 = 1000", () => {
      expect(
        calculatePenalty(contract(4, BidSuit.Spades, Seat.South, false, true), 3, false),
      ).toBe(1000);
    });

    test("redoubled V down 2 = 1000", () => {
      expect(
        calculatePenalty(contract(4, BidSuit.Spades, Seat.South, false, true), 2, true),
      ).toBe(1000);
    });
  });

  describe("large undertrick penalties (bridge scoring tables)", () => {
    test("doubled NV down 6 = 1700", () => {
      // 100 + 200 + 200 + 300 + 300 + 300 = 1400... let me calculate:
      // Down 1: 100, down 2: +200=300, down 3: +200=500, down 4: +300=800,
      // down 5: +300=1100, down 6: +300=1400
      expect(calculatePenalty(contract(7, BidSuit.NoTrump, Seat.South, true), 6, false)).toBe(1400);
    });

    test("doubled NV down 7 = 1700", () => {
      expect(calculatePenalty(contract(7, BidSuit.NoTrump, Seat.South, true), 7, false)).toBe(1700);
    });

    test("doubled V down 6 = 1700", () => {
      // 200 + 300*5 = 1700
      expect(calculatePenalty(contract(7, BidSuit.NoTrump, Seat.South, true), 6, true)).toBe(1700);
    });

    test("doubled V down 7 = 2000", () => {
      // 200 + 300*6 = 2000
      expect(calculatePenalty(contract(7, BidSuit.NoTrump, Seat.South, true), 7, true)).toBe(2000);
    });

    test("undoubled NV down 13 = 650", () => {
      // 13 × 50 = 650 (worst possible undoubled NV)
      expect(calculatePenalty(contract(7, BidSuit.NoTrump), 13, false)).toBe(650);
    });

    test("undoubled V down 13 = 1300", () => {
      // 13 × 100 = 1300 (worst possible undoubled V)
      expect(calculatePenalty(contract(7, BidSuit.NoTrump), 13, true)).toBe(1300);
    });
  });
});

describe("calculateScore", () => {
  test("positive when declarer makes contract", () => {
    // 3NT NV making exact (9 tricks): +400
    const result = calculateScore(
      contract(3, BidSuit.NoTrump),
      9,
      Vulnerability.None,
    );
    expect(result).toBe(400);
  });

  test("negative when declarer goes down", () => {
    // 2H NV down 3 (5 tricks instead of 8): -150
    const result = calculateScore(
      contract(2, BidSuit.Hearts),
      5,
      Vulnerability.None,
    );
    expect(result).toBe(-150);
  });

  test("3NT vul making exact = 600", () => {
    const result = calculateScore(
      contract(3, BidSuit.NoTrump, Seat.South),
      9,
      Vulnerability.NorthSouth,
    );
    expect(result).toBe(600);
  });

  test("7NT NV making exact = 1520", () => {
    const result = calculateScore(
      contract(7, BidSuit.NoTrump),
      13,
      Vulnerability.None,
    );
    expect(result).toBe(1520);
  });

  test("4S vul doubled down 2 = -500", () => {
    const result = calculateScore(
      contract(4, BidSuit.Spades, Seat.South, true),
      8,
      Vulnerability.NorthSouth,
    );
    expect(result).toBe(-500);
  });

  test("uses vulnerability correctly based on declarer seat", () => {
    // East declares, EW vulnerable
    const result = calculateScore(
      contract(3, BidSuit.NoTrump, Seat.East),
      9,
      Vulnerability.EastWest,
    );
    expect(result).toBe(600); // vul game bonus
  });

  test("declarer not vulnerable when vulnerability is other side", () => {
    // South declares, EW vulnerable (South is NV)
    const result = calculateScore(
      contract(3, BidSuit.NoTrump, Seat.South),
      9,
      Vulnerability.EastWest,
    );
    expect(result).toBe(400); // NV game bonus
  });

  test("making with overtricks", () => {
    // 4H NV making +2 (12 tricks): 120 + 300 + 60 = 480
    const result = calculateScore(
      contract(4, BidSuit.Hearts),
      12,
      Vulnerability.None,
    );
    expect(result).toBe(480);
  });

  test("exactly making returns 0 overtricks", () => {
    // 1C NV making exact (7 tricks): 20 + 50 = 70
    const result = calculateScore(
      contract(1, BidSuit.Clubs),
      7,
      Vulnerability.None,
    );
    expect(result).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// Doubled contract game threshold edge cases (ACBL Law 77)
// ---------------------------------------------------------------------------

describe("doubled contract game thresholds", () => {
  test("2C doubled is NOT game (80 trick points < 100)", () => {
    // 2C doubled: 20 * 2 * 2 = 80
    expect(calculateTrickPoints(contract(2, BidSuit.Clubs, Seat.South, true))).toBe(80);
    expect(isGame(contract(2, BidSuit.Clubs, Seat.South, true))).toBe(false);
  });

  test("3C doubled IS game (120 trick points >= 100)", () => {
    // 3C doubled: 20 * 3 * 2 = 120
    expect(calculateTrickPoints(contract(3, BidSuit.Clubs, Seat.South, true))).toBe(120);
    expect(isGame(contract(3, BidSuit.Clubs, Seat.South, true))).toBe(true);
  });

  test("4C undoubled is NOT game (80 trick points < 100)", () => {
    // 4C: 20 * 4 = 80
    expect(calculateTrickPoints(contract(4, BidSuit.Clubs))).toBe(80);
    expect(isGame(contract(4, BidSuit.Clubs))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NT overtrick and multiple overtrick edge cases (ACBL Law 77-78)
// ---------------------------------------------------------------------------

describe("overtrick edge cases", () => {
  test("NT overtrick value is 30 not 40 (1NT NV +1 = 120)", () => {
    // 1NT +1 NV: trick=40, partscore=50, overtrick=30 → 120 (NOT 130)
    expect(calculateMakingScore(contract(1, BidSuit.NoTrump), 1, false)).toBe(120);
  });

  test("multiple doubled overtricks NV (3NT doubled NV +3 = 850)", () => {
    // 3NT doubled NV +3: trick=200, game=300, insult=50, overtricks=3*100=300 → 850
    expect(
      calculateMakingScore(contract(3, BidSuit.NoTrump, Seat.South, true), 3, false),
    ).toBe(850);
  });

  test("multiple redoubled V overtricks (1H XX V +3 = 1920)", () => {
    // 1H redoubled V +3: trick=120, game=500, insult=100, overtricks=3*400=1200 → 1920
    expect(
      calculateMakingScore(contract(1, BidSuit.Hearts, Seat.South, false, true), 3, true),
    ).toBe(1920);
  });
});

// ---------------------------------------------------------------------------
// Extreme penalty and zero-overtrick boundary (ACBL Law 79)
// ---------------------------------------------------------------------------

describe("extreme penalties and boundaries", () => {
  test("redoubled NV down 8 = 4000", () => {
    // Doubled NV down 8: 100+200+200+300+300+300+300+300 = 2000
    // Redoubled = 2000 * 2 = 4000
    expect(
      calculatePenalty(contract(7, BidSuit.NoTrump, Seat.South, false, true), 8, false),
    ).toBe(4000);
  });

  test("4H exactly making NV (0 overtricks) = 420", () => {
    // 4H NV making exact: trick=120, game=300 → 420
    expect(calculateMakingScore(contract(4, BidSuit.Hearts), 0, false)).toBe(420);
  });
});

describe("bridge scoring extremes", () => {
  test("7NT redoubled vulnerable making exact = highest possible making score", () => {
    // 7NT redoubled V: trick points = (40 + 30*6) * 4 = 880
    // Game bonus (V) = 500, Grand slam (V) = 1500, Redoubled insult = 100
    // Total = 880 + 500 + 1500 + 100 = 2980
    const result = calculateMakingScore(
      contract(7, BidSuit.NoTrump, Seat.South, false, true), 0, true
    );
    expect(result).toBe(2980);
  });

  test("7NT redoubled NV making exact", () => {
    // trick points = 880, game bonus (NV) = 300, grand slam (NV) = 1000, insult = 100
    // Total = 880 + 300 + 1000 + 100 = 2280
    const result = calculateMakingScore(
      contract(7, BidSuit.NoTrump, Seat.South, false, true), 0, false
    );
    expect(result).toBe(2280);
  });

  test("1C NV making exact = lowest possible making score (70)", () => {
    const result = calculateMakingScore(contract(1, BidSuit.Clubs), 0, false);
    expect(result).toBe(70); // 20 trick + 50 partscore
  });

  test("6NT redoubled V making +1 = large making score with overtrick", () => {
    // 6NT redoubled V: trick = (40+30*5)*4 = 760
    // Game bonus (V) = 500, Small slam (V) = 750, Insult = 100
    // Overtrick (redoubled V) = 400
    // Total = 760 + 500 + 750 + 100 + 400 = 2510
    const result = calculateMakingScore(
      contract(6, BidSuit.NoTrump, Seat.South, false, true), 1, true
    );
    expect(result).toBe(2510);
  });

  test("doubled V down 13 in 7NT = maximum penalty", () => {
    // Down 13 doubled V: 200 + 300*12 = 3800
    const result = calculateScore(
      contract(7, BidSuit.NoTrump, Seat.South, true),
      0,
      Vulnerability.NorthSouth,
    );
    expect(result).toBe(-3800);
  });
});
