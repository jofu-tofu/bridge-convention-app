import { describe, it, expect } from "vitest";
import { buildConventionCard } from "../convention-card";
import {
  SAYC_SYSTEM_CONFIG,
  ACOL_SYSTEM_CONFIG,
  TWO_OVER_ONE_SYSTEM_CONFIG,
} from "../../../conventions/definitions/system-config";

describe("buildConventionCard", () => {
  it("SAYC: 15–17, 5-card majors, 1 round", () => {
    const card = buildConventionCard(SAYC_SYSTEM_CONFIG, "N-S");
    expect(card.partnership).toBe("N-S");
    expect(card.systemName).toBe("SAYC");
    expect(card.ntRange).toBe("15–17");
    expect(card.majorLength).toBe("5-card majors");
    expect(card.twoLevelForcing).toBe("1 round");
    expect(card.oneNtResponse).toBe("Non-forcing 6–10");
  });

  it("Acol: 12–14, 4-card majors, 1 round", () => {
    const card = buildConventionCard(ACOL_SYSTEM_CONFIG, "N-S");
    expect(card.systemName).toBe("Acol");
    expect(card.ntRange).toBe("12–14");
    expect(card.majorLength).toBe("4-card majors");
    expect(card.twoLevelForcing).toBe("1 round");
    expect(card.oneNtResponse).toBe("Non-forcing 6–9");
  });

  it("2/1: 15–17, 5-card majors, Game forcing", () => {
    const card = buildConventionCard(TWO_OVER_ONE_SYSTEM_CONFIG, "E-W");
    expect(card.partnership).toBe("E-W");
    expect(card.systemName).toBe("2/1");
    expect(card.ntRange).toBe("15–17");
    expect(card.majorLength).toBe("5-card majors");
    expect(card.twoLevelForcing).toBe("Game forcing");
    expect(card.oneNtResponse).toBe("Semi-forcing 6–12");
  });
});
