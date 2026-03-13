import type { Call } from "../../../engine/types";
import type { DeclaredEncoderKind } from "../../../core/contracts/agreement-module";
import type { EncoderKind } from "../../../core/contracts/provenance";
import { callsMatch } from "../../../engine/call-helpers";

// ─── Encoder configuration types ────────────────────────────

/**
 * Configuration for frontier-step encoding.
 * One meaning maps to the next available step in a relay ladder.
 * Used by Lebensohl, Kokish, relay systems.
 */
export interface FrontierStepConfig {
  /** Ordered list of step calls in ascending order. */
  readonly stepLadder: readonly Call[];
  /** Index into stepLadder indicating the current frontier position. */
  readonly currentStepIndex: number;
}

/**
 * Configuration for relay-map encoding.
 * One meaning maps to a call determined by the active relay position.
 */
export interface RelayMapConfig {
  /** Mapping from position identifiers to calls. */
  readonly entries: readonly RelayMapEntry[];
  /** The currently active position in the relay. */
  readonly activePosition: string;
}

export interface RelayMapEntry {
  readonly position: string;
  readonly call: Call;
}

/** Discriminated union of encoder configurations. */
export type EncoderConfig = FrontierStepConfig | RelayMapConfig;

// ─── Encoding result ────────────────────────────────────────

export interface EncodingResolution {
  /** The resolved call, or undefined if no legal encoding is available. */
  readonly chosenCall: Call | undefined;
  /** Runtime encoder kind for provenance tracing. */
  readonly encoderKind: EncoderKind;
  /** All calls the encoder considered. */
  readonly consideredCalls: readonly Call[];
  /** Calls that were blocked (illegal or unavailable). */
  readonly blockedCalls: readonly { readonly call: Call; readonly reason: string }[];
}

// ─── Resolver ───────────────────────────────────────────────

function isLegal(call: Call, legalCalls: readonly Call[]): boolean {
  return legalCalls.some((lc) => callsMatch(lc, call));
}

function resolveDirectOrChoiceSet(
  defaultCall: Call,
  legalCalls: readonly Call[],
): EncodingResolution {
  const legal = isLegal(defaultCall, legalCalls);
  return {
    chosenCall: legal ? defaultCall : undefined,
    encoderKind: "default-call",
    consideredCalls: [defaultCall],
    blockedCalls: legal ? [] : [{ call: defaultCall, reason: "illegal_in_auction" }],
  };
}

function resolveFrontierStep(
  config: FrontierStepConfig,
  legalCalls: readonly Call[],
): EncodingResolution {
  const { stepLadder, currentStepIndex } = config;
  const consideredSteps = stepLadder.slice(currentStepIndex);
  const blockedCalls: { call: Call; reason: string }[] = [];
  let chosenCall: Call | undefined;

  for (const step of consideredSteps) {
    if (isLegal(step, legalCalls)) {
      chosenCall = step;
      break;
    }
    blockedCalls.push({ call: step, reason: "step_not_legal" });
  }

  return {
    chosenCall,
    encoderKind: "frontier-step",
    consideredCalls: consideredSteps,
    blockedCalls,
  };
}

function resolveRelayMap(
  config: RelayMapConfig,
  legalCalls: readonly Call[],
): EncodingResolution {
  const { entries, activePosition } = config;
  const consideredCalls = entries.map((e) => e.call);
  const matched = entries.find((e) => e.position === activePosition);

  if (!matched) {
    return {
      chosenCall: undefined,
      encoderKind: "relay-map",
      consideredCalls,
      blockedCalls: [],
    };
  }

  const legal = isLegal(matched.call, legalCalls);
  return {
    chosenCall: legal ? matched.call : undefined,
    encoderKind: "relay-map",
    consideredCalls,
    blockedCalls: legal ? [] : [{ call: matched.call, reason: "mapped_call_not_legal" }],
  };
}

// ─── Public API ─────────────────────────────────────────────

export interface ResolveEncodingInput {
  readonly encoderKind: DeclaredEncoderKind;
  readonly defaultCall: Call;
  readonly legalCalls: readonly Call[];
  readonly encoderConfig?: EncoderConfig;
}

/**
 * Resolve the concrete call for a meaning based on its declared encoder kind.
 *
 * - `"direct"` / `"choice-set"`: use the defaultCall (existing behavior).
 * - `"frontier-step"`: select the next available step from a relay ladder.
 * - `"relay-map"`: look up the call from a position mapping table.
 */
export function resolveEncoding(input: ResolveEncodingInput): EncodingResolution {
  switch (input.encoderKind) {
    case "direct":
    case "choice-set":
      return resolveDirectOrChoiceSet(input.defaultCall, input.legalCalls);

    case "frontier-step": {
      const config = input.encoderConfig as FrontierStepConfig | undefined;
      if (!config || !("stepLadder" in config)) {
        return resolveDirectOrChoiceSet(input.defaultCall, input.legalCalls);
      }
      return resolveFrontierStep(config, input.legalCalls);
    }

    case "relay-map": {
      const config = input.encoderConfig as RelayMapConfig | undefined;
      if (!config || !("entries" in config)) {
        return resolveDirectOrChoiceSet(input.defaultCall, input.legalCalls);
      }
      return resolveRelayMap(config, input.legalCalls);
    }
  }
}
