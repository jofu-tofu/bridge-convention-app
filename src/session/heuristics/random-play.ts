import type { PlayStrategy, PlayResult } from "../../conventions";

export function createRandomPlayStrategy(
  rng: () => number = Math.random,
): PlayStrategy {
  return {
    id: "random",
    name: "Random Play",
    suggest(context): Promise<PlayResult> {
      if (context.legalPlays.length === 0) {
        throw new Error("No legal cards to play");
      }
      const index = Math.floor(rng() * context.legalPlays.length);
      return Promise.resolve({ card: context.legalPlays[index]!, reason: "random" });
    },
  };
}

/** Default instance using Math.random — backward-compatible. */
export const randomPlayStrategy: PlayStrategy = createRandomPlayStrategy();
