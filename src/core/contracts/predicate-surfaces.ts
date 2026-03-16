import type { FactConstraintIR } from "./agreement-module";

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
  readonly clauses: readonly FactConstraintIR[];
  readonly conjunction: "all" | "any";
}

// ─── Deal constraints ───────────────────────────────────────
export interface DealConstraintIR {
  readonly kind: "fit-check" | "combined-hcp" | "custom";
  readonly params: Readonly<Record<string, unknown>>;
}

