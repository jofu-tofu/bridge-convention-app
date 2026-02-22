import type { PlayStrategy, PlayResult } from "../shared/types";

export const randomPlayStrategy: PlayStrategy = {
  id: "random",
  name: "Random Play",
  suggest(context): PlayResult {
    if (context.legalPlays.length === 0) {
      throw new Error("No legal cards to play");
    }
    const index = Math.floor(Math.random() * context.legalPlays.length);
    return { card: context.legalPlays[index]!, reason: "random" };
  },
};
