import type { EnginePort } from "./port";

/**
 * Proxy that tries primary engine first, falls back to secondary on network errors.
 * Fallback is per-call — a transient network failure does not permanently disable primary.
 */
export function createFallbackEngine(
  primary: EnginePort,
  fallback: EnginePort,
): EnginePort {
  return new Proxy(primary, {
    get(target, prop, receiver) {
      const primaryValue = Reflect.get(target, prop, receiver);
      if (typeof primaryValue !== "function") return primaryValue;
      return async (...args: unknown[]) => {
        try {
          return await (primaryValue as Function).apply(target, args);
        } catch (err) {
          if (
            err instanceof TypeError &&
            (err.message.includes("fetch") ||
              err.message.includes("network"))
          ) {
            console.warn(
              "[engine] Rust server unreachable, falling back to TsEngine",
            );
            const fallbackValue = Reflect.get(fallback, prop, receiver);
            return (fallbackValue as Function).apply(fallback, args);
          }
          throw err;
        }
      };
    },
  });
}
