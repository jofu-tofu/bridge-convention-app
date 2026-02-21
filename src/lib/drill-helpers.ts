import type { EnginePort } from "../engine/port";
import type { ConventionConfig } from "../conventions/types";
import type { Deal, Seat, Auction } from "../engine/types";
import type { DrillSession } from "../ai/types";
import { createDrillConfig } from "../ai/drill-config-factory";
import { createDrillSession } from "../ai/drill-session";

export async function startDrill(
  engine: EnginePort,
  convention: ConventionConfig,
  userSeat: Seat,
  gameStore: { startDrill: (deal: Deal, session: DrillSession, initialAuction?: Auction) => Promise<void> },
) {
  const config = createDrillConfig(convention.id, userSeat);
  const session = createDrillSession(config);
  const deal = await engine.generateDeal(convention.dealConstraints);
  const initialAuction = convention.defaultAuction
    ? convention.defaultAuction(userSeat, deal)
    : undefined;
  await gameStore.startDrill(deal, session, initialAuction);
}
