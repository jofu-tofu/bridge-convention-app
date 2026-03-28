/**
 * ObsPattern → human-readable transition labels for learning viewport.
 */

import type { ObsPattern } from "../conventions";
import type { Call } from "../engine/types";
import { formatCall } from "../service/display/format";

const SUIT_DISPLAY: Record<string, string> = {
  spades: "spades", hearts: "hearts", diamonds: "diamonds", clubs: "clubs", notrump: "notrump",
};

const FEATURE_DISPLAY: Record<string, string> = {
  majorSuit: "a major", minorSuit: "a minor", heldSuit: "", shortMajor: "short major",
  longMajor: "long major", suitQuality: "suit quality", hcpRange: "HCP range",
  support: "support", balanced: "balanced hand", gameForce: "game force",
  slamInterest: "slam interest", stoppers: "stoppers",
};

function suitPhrase(suit?: string): string {
  return suit ? (SUIT_DISPLAY[suit] ?? suit) : "";
}

function featurePhrase(feature?: string, suit?: string): string {
  if (!feature) return suitPhrase(suit);
  if (feature === "heldSuit") return suitPhrase(suit) || "a suit";
  const base = FEATURE_DISPLAY[feature] ?? feature;
  const s = suitPhrase(suit);
  return s ? `${s} ${base}`.trim() : base;
}

export function formatObsAction(obs: ObsPattern): string {
  const f = obs.feature;
  const s = obs.suit ?? obs.strain;
  switch (obs.act) {
    case "open": return s ? `opening ${suitPhrase(s)}` : "opening";
    case "show": return `showing ${featurePhrase(f, obs.suit)}`;
    case "deny": return `denying ${featurePhrase(f, obs.suit)}`;
    case "inquire": return `asking for ${featurePhrase(f, obs.suit)}`;
    case "transfer": return `transferring to ${suitPhrase(obs.suit ?? obs.strain)}`;
    case "accept": return `accepting ${featurePhrase(f, obs.suit)}`;
    case "decline": return `declining ${featurePhrase(f, obs.suit)}`;
    case "raise": return s ? `raising ${suitPhrase(s)}` : "raising";
    case "place": return s ? `placing the contract in ${suitPhrase(s)}` : "placing the contract";
    case "signoff": return s ? `signing off in ${suitPhrase(s)}` : "signing off";
    case "force": return "forcing";
    case "agree": return s ? `agreeing on ${suitPhrase(s)}` : "agreeing";
    case "relay": return "relaying";
    case "overcall": return `overcalling ${featurePhrase(f, obs.suit)}`;
    case "double": return "doubling";
    case "pass": return "passing";
    case "redouble": return "redoubling";
    case "any": return "any action";
  }
  const unknownAct: string = obs.act;
  return `${unknownAct}(${[f, s].filter(Boolean).join(", ")})`;
}

export function formatTransitionLabel(
  obs: ObsPattern, triggerCall: Call | null, turn: string | null,
): string {
  const action = formatObsAction(obs);
  const actor = turn ? `${turn}` : null;
  if (triggerCall) {
    const callStr = formatCall(triggerCall);
    const parts = ["After"];
    if (actor) parts.push(actor);
    parts.push("bids", callStr);
    parts.push(`(${action})`);
    return parts.join(" ");
  }
  const parts = ["After"];
  if (actor) parts.push(actor);
  parts.push(action);
  return parts.join(" ");
}
