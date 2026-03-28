/**
 * Branded authored-text types for convention surface metadata.
 *
 * Wraps raw strings with length validation to catch oversized labels
 * at definition time rather than at render time.
 */

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type BidName = Brand<string, "BidName">;
export type BidSummary = Brand<string, "BidSummary">;
export type ModuleDescription = Brand<string, "ModuleDescription">;
export type ModulePurpose = Brand<string, "ModulePurpose">;
export type TeachingTradeoff = Brand<string, "TeachingTradeoff">;
export type TeachingPrinciple = Brand<string, "TeachingPrinciple">;
export type TeachingItem = Brand<string, "TeachingItem">;

/** Structured teaching label for a bid meaning surface. */
export interface TeachingLabel {
  readonly name: BidName;
  readonly summary: BidSummary;
}

function validated<B extends string>(
  raw: string,
  brand: B,
  min: number,
  max: number,
): Brand<string, B> {
  const trimmed = raw.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new Error(
      `${brand}: length ${trimmed.length} out of range [${min}, ${max}]: "${trimmed.length > 60 ? trimmed.slice(0, 57) + "..." : trimmed}"`,
    );
  }
  return trimmed as Brand<string, B>;
}

export function bidName(raw: string): BidName {
  return validated(raw, "BidName", 2, 40);
}

export function bidSummary(raw: string): BidSummary {
  return validated(raw, "BidSummary", 5, 200);
}

export function moduleDescription(raw: string): ModuleDescription {
  return validated(raw, "ModuleDescription", 10, 300);
}

export function modulePurpose(raw: string): ModulePurpose {
  return validated(raw, "ModulePurpose", 10, 300);
}

export function teachingTradeoff(raw: string): TeachingTradeoff {
  return validated(raw, "TeachingTradeoff", 10, 500);
}

export function teachingPrinciple(raw: string): TeachingPrinciple {
  return validated(raw, "TeachingPrinciple", 10, 500);
}

export function teachingItem(raw: string): TeachingItem {
  return validated(raw, "TeachingItem", 5, 300);
}
