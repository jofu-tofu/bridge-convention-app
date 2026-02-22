import type { EnginePort } from "../engine/port";
import type { ConventionConfig } from "../conventions/types";
import type { Deal, Seat, Auction } from "../engine/types";
import type { DrillSession } from "../ai/types";
import type { BiddingStrategy } from "../shared/types";
import { createDrillConfig } from "../ai/drill-config-factory";
import { createDrillSession } from "../ai/drill-session";
import { conventionToStrategy } from "../ai/convention-strategy";

export async function startDrill(
  engine: EnginePort,
  convention: ConventionConfig,
  userSeat: Seat,
  gameStore: {
    startDrill: (
      deal: Deal,
      session: DrillSession,
      initialAuction?: Auction,
      strategy?: BiddingStrategy,
    ) => Promise<void>;
  },
  rng?: () => number,
) {
  const config = createDrillConfig(convention.id, userSeat);
  const session = createDrillSession(config);
  const strategy = conventionToStrategy(convention);
  const constraints = rng
    ? { ...convention.dealConstraints, rng }
    : convention.dealConstraints;
  const deal = await engine.generateDeal(constraints);
  const initialAuction = convention.defaultAuction
    ? convention.defaultAuction(userSeat, deal)
    : undefined;
  await gameStore.startDrill(deal, session, initialAuction, strategy);
}
