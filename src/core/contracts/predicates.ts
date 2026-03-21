import type { FactConstraint } from "./agreement-module";

// ─── Auction pattern matching ───────────────────────────────
export type AuctionPattern =
  | { readonly kind: "sequence"; readonly calls: readonly string[] }
  | { readonly kind: "contains"; readonly call: string; readonly byRole?: string }
  | { readonly kind: "by-role"; readonly role: string; readonly lastCall: string };

// ─── Public snapshot guard ──────────────────────────────────
export interface PublicGuard {
  readonly field: string;
  readonly operator: "eq" | "neq" | "in" | "exists";
  readonly value?: unknown;
}

// ─── Hand predicate (fact-based) ────────────────────────────
export interface HandPredicate {
  readonly clauses: readonly FactConstraint[];
  readonly conjunction: "all" | "any";
}

// ─── Deal constraints ───────────────────────────────────────
export interface DealConstraint {
  readonly kind: "fit-check" | "combined-hcp" | "custom";
  readonly params: Readonly<Record<string, unknown>>;
}

