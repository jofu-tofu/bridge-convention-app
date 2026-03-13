// ─── Auction pattern matching ───────────────────────────────
export type AuctionPatternIR =
  | { readonly kind: "sequence"; readonly calls: readonly string[] }
  | { readonly kind: "contains"; readonly call: string; readonly byRole?: string }
  | { readonly kind: "by-role"; readonly role: string; readonly lastCall: string };

// ─── Public snapshot guard ──────────────────────────────────
export interface PublicGuardIR {
  readonly field: string;
  readonly operator: "eq" | "neq" | "in" | "exists";
  readonly value?: unknown;
}

// ─── Hand predicate (fact-based) ────────────────────────────
export interface HandPredicateIR {
  readonly clauses: readonly {
    readonly factId: string;
    readonly operator: "gte" | "lte" | "eq" | "range" | "boolean" | "in";
    readonly value: number | boolean | string | { min: number; max: number } | readonly string[];
  }[];
  readonly conjunction: "all" | "any";
}

// ─── Deal constraints ───────────────────────────────────────
export interface DealConstraintIR {
  readonly kind: "fit-check" | "combined-hcp" | "custom";
  readonly params: Readonly<Record<string, unknown>>;
}

export interface FullDealPredicateIR {
  readonly seatPredicates: readonly { role: string; predicate: HandPredicateIR }[];
  readonly jointConstraints?: readonly DealConstraintIR[];
}
