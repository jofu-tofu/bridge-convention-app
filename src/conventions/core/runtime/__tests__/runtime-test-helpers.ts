import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import { makeSurface as _makeSurface, buildMachine } from "../../../../test-support/convention-factories";

export { buildMachine };

/**
 * Backward-compatible wrapper: delegates to the canonical makeSurface
 * but preserves the positional (meaningId, moduleId) call signature
 * used by existing runtime tests.
 */
export function makeSurface(meaningId: string, moduleId: string): MeaningSurface {
  return _makeSurface({ meaningId, moduleId });
}
